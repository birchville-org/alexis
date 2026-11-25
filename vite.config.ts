import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { type Plugin, defineConfig } from "vite";

function alexisLocalCorpusSyncPlugin(): Plugin {
  const CORPUS_FILES: Record<string, string> = {
    "hindi-bolo": resolve(__dirname, "data/corpora/hindi_bolo.json"),
    "payer-sanskrit": resolve(__dirname, "data/corpora/payer_sanskrit.json"),
  };
  let ignoreCorpusHmrUntil = 0;

  function writeFormattedCorpus(filePath: string, data: unknown) {
    ignoreCorpusHmrUntil = Date.now() + 1500;
    writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
    try {
      execFileSync(
        process.execPath,
        [
          resolve(__dirname, "node_modules/@biomejs/biome/bin/biome"),
          "format",
          "--write",
          filePath,
        ],
        { stdio: "ignore" },
      );
    } catch {
      // keep JSON.stringify formatting if biome binary fails
    }
  }

  return {
    name: "alexis-local-corpus-sync",
    configureServer(server) {
      server.middlewares.use("/__alexis_dev/corpus", (req, res) => {
        const remote = req.socket.remoteAddress ?? "";
        const isLoopback =
          remote === "127.0.0.1" ||
          remote === "::1" ||
          remote === "::ffff:127.0.0.1";
        const hostHeader = String(req.headers.host ?? "");
        const originHeader = String(req.headers.origin ?? "");
        const contentType = String(
          req.headers["content-type"] ?? "",
        ).toLowerCase();
        const hasCustomHeader = req.headers["x-alexis-dev"] === "1";
        const isLocalHostHeader =
          /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(hostHeader);
        const isLocalOrigin =
          /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(
            originHeader,
          );

        if (
          req.method !== "POST" ||
          !isLoopback ||
          !hasCustomHeader ||
          !contentType.startsWith("application/json") ||
          !isLocalHostHeader ||
          !isLocalOrigin
        ) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "Forbidden" }));
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const MAX_BYTES = 20 * 1024 * 1024;
        let aborted = false;

        req.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_BYTES) {
            aborted = true;
            res.statusCode = 413;
            res.end(JSON.stringify({ ok: false, error: "Payload too large" }));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on("end", () => {
          if (aborted) return;
          res.setHeader("Content-Type", "application/json");
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            const corpusId = String(payload?.corpusId ?? "");
            const filePath = CORPUS_FILES[corpusId];
            if (!filePath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: "Invalid corpusId" }));
              return;
            }

            if (payload.action === "patch" && Array.isArray(payload.patches)) {
              const diskBundle = JSON.parse(readFileSync(filePath, "utf-8"));
              const patchMap = new Map<string, any>(
                payload.patches.map((p: any) => [String(p.id), p]),
              );
              let updated = 0;
              for (const entry of diskBundle.entries ?? []) {
                const patch = patchMap.get(String(entry.id));
                if (!patch) continue;
                entry.lemma_native = patch.lemma_native;
                entry.lemma_translit = patch.lemma_translit;
                const nextPos = patch.pos || null;
                if (nextPos !== null || "pos" in entry) {
                  entry.pos = nextPos;
                }
                const nextGender =
                  patch.gender && patch.gender !== "-" ? patch.gender : null;
                if (nextGender !== null || "gender" in entry) {
                  entry.gender = nextGender;
                }
                if (patch.definitions !== undefined) {
                  entry.definitions = patch.definitions;
                }
                if (patch.tags !== undefined) {
                  entry.tags = patch.tags;
                }
                updated++;
              }
              if (updated > 0) {
                writeFormattedCorpus(filePath, diskBundle);
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, updated }));
              return;
            }

            if (payload.action === "save_bundle" && payload.bundle) {
              const b = payload.bundle;
              const isValidBundle =
                typeof b === "object" &&
                b !== null &&
                b.corpus?.id === corpusId &&
                Array.isArray(b.volumes) &&
                Array.isArray(b.lessons) &&
                Array.isArray(b.entries);
              if (!isValidBundle) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({ ok: false, error: "Invalid bundle schema" }),
                );
                return;
              }
              writeFormattedCorpus(filePath, b);
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: "Invalid action" }));
          } catch (err) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }
        });
      });
    },
    handleHotUpdate(ctx) {
      if (
        Date.now() < ignoreCorpusHmrUntil &&
        (ctx.file.endsWith("data/corpora/hindi_bolo.json") ||
          ctx.file.endsWith("data/corpora/payer_sanskrit.json"))
      ) {
        for (const mod of ctx.modules) {
          ctx.server.moduleGraph.invalidateModule(mod);
        }
        return [];
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [vue(), alexisLocalCorpusSyncPlugin()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5180,
  },
});
