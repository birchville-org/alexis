import { createApp } from "vue";
import App from "./App.vue";
import "./styles/birchville.css";

// Register Service Worker for offline PWA capability
if ("serviceWorker" in navigator && !("__TAURI_INTERNALS__" in window)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("ServiceWorker registration failed:", err);
    });
  });
}

createApp(App).mount("#app");
