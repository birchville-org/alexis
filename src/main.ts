import { createApp } from "vue";
import App from "./App.vue";
import "./styles/birchville.css";

// Register Service Worker for offline PWA capability (skip on localhost dev servers)
if ("serviceWorker" in navigator && !("__TAURI_INTERNALS__" in window)) {
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  window.addEventListener("load", () => {
    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      return;
    }

    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn("ServiceWorker registration failed:", err);
      });
  });
}

window.addEventListener("vite:preloadError", () => {
  try {
    if (!sessionStorage.getItem("alexis_preload_recovery")) {
      sessionStorage.setItem("alexis_preload_recovery", "1");
      window.location.reload();
    }
  } catch {
    // ignore storage restrictions
  }
});

createApp(App).mount("#app");
