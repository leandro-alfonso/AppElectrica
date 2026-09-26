// Electricista App - núcleo y almacenamiento local
(() => {
  "use strict";

  const DB_NAME = "ElectricistaAppDB";
  const DB_VERSION = 1;
  const stores = Object.freeze({ works: "works", materials: "materials", photos: "photos" });

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB no está disponible en este navegador."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        Object.values(stores).forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir la base de datos."));
    });
  }

  async function dbPut(store, object) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(object);
      tx.oncomplete = () => { db.close(); resolve(object); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("No se pudo guardar.")); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error("Guardado cancelado.")); };
    });
  }

  async function dbGetAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, "readonly").objectStore(store).getAll();
      request.onsuccess = () => { db.close(); resolve(request.result || []); };
      request.onerror = () => { db.close(); reject(request.error || new Error("No se pudieron leer los datos.")); };
    });
  }

  async function dbGet(store, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, "readonly").objectStore(store).get(id);
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error || new Error("No se pudo leer el dato.")); };
    });
  }

  async function dbDelete(store, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("No se pudo eliminar.")); };
    });
  }

  async function dbClear(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("No se pudo limpiar.")); };
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function showError(error) {
    console.error("Electricista App:", error);
    alert(`Ocurrió un error: ${error?.message || error}`);
  }

  function initMenu() {
    const toggle = document.getElementById("menuToggle");
    const nav = document.getElementById("mainNav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  const THEME_KEY = "electricistaTheme";

  function applyTheme(theme) {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(saved);
    const btn = document.getElementById("themeToggle");
    btn?.addEventListener("click", () => {
      const next = document.documentElement.classList.contains("theme-dark") ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  async function exportBackup() {
    try {
      const [works, materials, photos] = await Promise.all([
        dbGetAll(stores.works), dbGetAll(stores.materials), dbGetAll(stores.photos)
      ]);
      const payload = { app: "ElectricistaApp", version: 1, exported: new Date().toISOString(), works, materials, photos };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `electricista-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showError(error);
    }
  }

  function importBackup(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          for (const item of data.works || []) await dbPut(stores.works, item);
          for (const item of data.materials || []) await dbPut(stores.materials, item);
          for (const item of data.photos || []) await dbPut(stores.photos, item);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo."));
      reader.readAsText(file);
    });
  }

  async function updateHomeCounters() {
    const workCount = document.getElementById("workCount");
    const materialCount = document.getElementById("materialCount");
    if (!workCount || !materialCount) return;
    try {
      const [works, materials] = await Promise.all([
        dbGetAll(stores.works),
        dbGetAll(stores.materials)
      ]);
      workCount.textContent = works.length;
      materialCount.textContent = materials.length;
    } catch (error) {
      showError(error);
    }
  }

  window.Electricista = Object.freeze({
    uid, dbPut, dbGetAll, dbGet, dbDelete, dbClear, readFile, escapeHtml, showError, stores,
    exportBackup, importBackup
  });

  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    initTheme();
    updateHomeCounters();
  });
})();
