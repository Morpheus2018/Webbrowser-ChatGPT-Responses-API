/* =========================================================
   RESPONSES SETTINGS (GLOBAL)
========================================================= */

const RESPONSE_SETTINGS_KEY = "responses_settings_v1";

window.responseSettings = {
  max_output_tokens: 4000,
  temperature: 1,
  top_p: 1,
  parallel_tool_calls: true
};

function loadResponseSettings() {

  try {

    const saved = localStorage.getItem(RESPONSE_SETTINGS_KEY);

    if (!saved) return;

    const parsed = JSON.parse(saved);

    Object.assign(window.responseSettings, parsed);

  }
  catch {}

}

function persistResponseSettings() {

  try {

    localStorage.setItem(
      RESPONSE_SETTINGS_KEY,
      JSON.stringify(window.responseSettings)
    );

  }
  catch {}

}

loadResponseSettings();

/* =========================================================
   SETTINGS MODAL MANAGER
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const settingsOverlay   = document.getElementById('settingsOverlay');
  const settingsBtn       = document.getElementById('menuSettingsBtn');
  const settingsCloseBtn  = document.getElementById('settingsCloseBtn');
	const settingsCancelBtn = document.getElementById('settingsCancelBtn');
  const settingsSaveBtn   = document.getElementById('settingsSaveBtn');
  const maxResultsInput   = document.getElementById('maxResultsInput');

  if (!settingsOverlay || !settingsBtn || !settingsCloseBtn) {
    console.warn("Settings Modal: Elemente fehlen");
    return;
  }

  /* =====================================================
     Öffnen
  ===================================================== */
  settingsBtn.addEventListener('click', (e) => {

    e.preventDefault();
    e.stopPropagation();

    settingsOverlay.hidden = false;

/* IndexedDB Info aktualisieren */
updateIndexedDBInfo();
updateLocalStorageInfo();
const maxTokensInput = document.getElementById("maxTokensInput");
const temperatureInput = document.getElementById("temperatureInput");
const topPInput = document.getElementById("topPInput");
const parallelToolsToggleBtn = document.getElementById("parallelToolsToggleBtn");

if (maxTokensInput) {
  maxTokensInput.value = window.responseSettings.max_output_tokens;
}

if (temperatureInput) {
  temperatureInput.value = window.responseSettings.temperature;
}

if (topPInput) {
  topPInput.value = window.responseSettings.top_p;
}

if (parallelToolsToggleBtn) {
  parallelToolsToggleBtn.click = parallelToolsToggleBtn.click;
}
    /* aktuellen Wert anzeigen */
    if (window.fileSearchSettings && maxResultsInput) {

      maxResultsInput.value =
        window.fileSearchSettings.maxResults;

    }

  });

/* =====================================================
   Settings Modal Close Controller
   - X Button
   - Cancel Button
   - Outside Click
   - ESC Key
===================================================== */

function closeSettingsModal() {

  settingsOverlay.hidden = true;

  /* Fokus zurück ins Chat Input */
  const chatInput = document.getElementById("userInput");

  if (chatInput) {
    setTimeout(() => chatInput.focus(), 0);
  }

}

/* Buttons */
[settingsCloseBtn, settingsCancelBtn].forEach(btn => {
  if (!btn) return;
  btn.addEventListener("click", closeSettingsModal);
});

/* Outside Click */
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) {
    closeSettingsModal();
  }
});

/* ESC Key */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsOverlay.hidden) {
    closeSettingsModal();
  }
});
/* =====================================================
   ENTER = Save Settings
===================================================== */

document.addEventListener("keydown", (e) => {

  if (e.key === "Enter" && !settingsOverlay.hidden) {

    const active = document.activeElement;

    if (active && active.tagName === "TEXTAREA") return;

    e.preventDefault();

    if (settingsSaveBtn) {
      settingsSaveBtn.click();
    }

  }

});
/* =====================================================
   Speichern Settings:
   - File Search: max_num_results
   - Responses: max_output_tokens, temperature, top_p, parallel_tool_calls
===================================================== */
if (settingsSaveBtn && maxResultsInput) {

  settingsSaveBtn.addEventListener('click', () => {

    /* -----------------------------
       File Search: max_num_results
    ------------------------------ */
    const maxResultsVal = Number(maxResultsInput.value);

    if (maxResultsVal >= 1 && maxResultsVal <= 50) {

      if (window.fileSearchSettings) {
        window.fileSearchSettings.maxResults = maxResultsVal;
      }

      if (window.persistFileSearchSettings) {
        window.persistFileSearchSettings();
      }
    }

    /* -----------------------------
       Responses Settings
    ------------------------------ */
    const maxTokensInput = document.getElementById("maxTokensInput");
    const temperatureInput = document.getElementById("temperatureInput");
    const topPInput = document.getElementById("topPInput");
    const parallelToolsToggleBtn = document.getElementById("parallelToolsToggleBtn");

    if (window.responseSettings) {

      if (maxTokensInput) {
        const val = Number(maxTokensInput.value);
        // sinnvolle UI-Grenzen (du kannst später feiner begrenzen)
        if (val >= 100 && val <= 128000) {
          window.responseSettings.max_output_tokens = val;
        }
      }

      if (temperatureInput) {
        const val = Number(temperatureInput.value);
        if (val >= 0 && val <= 2) {
          window.responseSettings.temperature = val;
        }
      }

      if (topPInput) {
        const val = Number(topPInput.value);
        if (val >= 0 && val <= 1) {
          window.responseSettings.top_p = val;
        }
      }

      if (typeof persistResponseSettings === "function") {
        persistResponseSettings();
      }
    }

    /* -----------------------------
       Modal schließen
    ------------------------------ */
  /*  settingsOverlay.hidden = true; */
    closeSettingsModal();

  });

}

});

/* =========================================================
   Stream: Schalter ON / OFF
   ========================================================= */
const streamToggleBtn = document.getElementById('streamToggleBtn');

if (streamToggleBtn) {

  function updateStreamToggleUI() {
    const enabled = isStreamEnabled();

    streamToggleBtn.textContent =
      enabled ? 'Stream: ON' : 'Stream: OFF';

    streamToggleBtn.classList.toggle('active', enabled);
  }

  streamToggleBtn.onclick = () => {
    setStreamEnabled(!isStreamEnabled());
    updateStreamToggleUI();
  };

  document.addEventListener('DOMContentLoaded', updateStreamToggleUI);
}
/* =========================================================
   Parallel Tool Calls Toggle
   ========================================================= */

const parallelToolsToggleBtn =
  document.getElementById("parallelToolsToggleBtn");

if (parallelToolsToggleBtn) {

  function updateParallelToolsUI() {

    const enabled =
      window.responseSettings?.parallel_tool_calls ?? true;

    parallelToolsToggleBtn.textContent =
      `Parallel Tool Calls: ${enabled ? "ON" : "OFF"}`;

    parallelToolsToggleBtn.classList.toggle("active", enabled);

  }

  parallelToolsToggleBtn.onclick = () => {

    const next =
      !window.responseSettings.parallel_tool_calls;

    window.responseSettings.parallel_tool_calls = next;

    updateParallelToolsUI();

    if (typeof persistResponseSettings === "function") {
      persistResponseSettings();
    }

  };

  document.addEventListener(
    "DOMContentLoaded",
    updateParallelToolsUI
  );

}
/* =========================================================
   Fake-AI Engine
   ========================================================= */
function fakeDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/* =========================================================
   IndexedDB Stats
========================================================= */

async function getIndexedDBStats() {

  try {

    const db = await openImageDB();

    return new Promise((resolve) => {

      const tx = db.transaction(IMAGE_STORE, "readonly");
      const store = tx.objectStore(IMAGE_STORE);

      const images = [];
      const req = store.openCursor();

      req.onsuccess = (e) => {

        const cursor = e.target.result;

        if (!cursor) {

          let totalBytes = 0;

          images.forEach(img => {

            totalBytes += img.length;

          });

          resolve({
            count: images.length,
            size: totalBytes
          });

          return;
        }

        images.push(cursor.value);
        cursor.continue();

      };

    });

  }
  catch {

    return { count: 0, size: 0 };

  }

}
/*  Indexed DB Format Helper */
function formatBytes(bytes) {

  if (bytes < 1024)
    return bytes + " B";

  if (bytes < 1024 * 1024)
    return (bytes / 1024).toFixed(1) + " KB";

  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";

  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";

}
/*  Indexed DB UI Update Funktion */
async function updateIndexedDBInfo() {

  const countBtn = document.getElementById("idbImageCount");
  const sizeBtn = document.getElementById("idbStorageSize");

  if (!countBtn || !sizeBtn) return;

  const stats = await getIndexedDBStats();

  countBtn.textContent = `Images: ${stats.count}`;
  sizeBtn.textContent = `Größe: ${formatBytes(stats.size)}`;

}
/* =========================================================
   IndexedDB Clear Button
========================================================= */

const idbClearBtn = document.getElementById("idbClearBtn");

if (idbClearBtn) {

  idbClearBtn.onclick = async () => {

    const ok = await customConfirm(
      'Die gesamte Indexed DB löschen?',
      {
        title: 'Indexed DB löschen',
        icon: 'fas fa-trash',
        okText: 'Ja, löschen'
      }
    );

    if (!ok) return;

    try {

      await clearImageCache();

      await updateIndexedDBInfo();

    }
    catch (err) {

      console.error(err);

    }

  };

}
/* =========================================================
   LocalStorage Stats
========================================================= */

function getLocalStorageSizeBytes(keys = null) {
  try {
    let bytes = 0;

    // Wenn keys angegeben → nur diese messen, sonst alles
    if (Array.isArray(keys) && keys.length) {
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        // grobe Byte-Schätzung (UTF-16 in JS ≈ 2 bytes/char)
        bytes += (k.length + v.length) * 2;
      }
      return bytes;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) || "";
      bytes += (k.length + v.length) * 2;
    }

    return bytes;
  } catch {
    return 0;
  }
}

function getChatHistoryCount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY); // chat_history_v1 aus script.js
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

async function updateLocalStorageInfo() {
  const chatBtn = document.getElementById("lsChatCount");
  const sizeBtn = document.getElementById("lsStorageSize");
  if (!chatBtn || !sizeBtn) return;

  const chatCount = getChatHistoryCount();

  // Empfohlen: nur App-relevante Keys messen (stabiler, keine Fremdkeys)
  const appKeys = [
    STORAGE_KEY,              // chat_history_v1
    MODEL_KEY,                // selected_model
    STREAM_KEY,               // stream_enabled
    USAGE_KEY,                // usage_persist_v1
    RESPONSE_SETTINGS_KEY,    // responses_settings_v1 (aus customization-tools.js)
    "theme",
    "apiMode",
    "apiSource",
    "apiKey",
    "vs_settings_v1",         // falls vorhanden (optional)
  ];

  const bytes = getLocalStorageSizeBytes(appKeys);

  chatBtn.textContent = `Chats: ${chatCount}`;
  sizeBtn.textContent = `Größe: ${formatBytes(bytes)}`;
}

/* =========================================================
   LocalStorage Clear Button
========================================================= */

const lsClearBtn = document.getElementById("lsClearBtn");

if (lsClearBtn) {

  lsClearBtn.onclick = async () => {

    const ok = await customConfirm(
      'Den gesamten Local Storage löschen?',
      {
        title: 'Local Storage löschen',
        icon: 'fas fa-trash',
        okText: 'Ja, löschen'
      }
    );

    if (!ok) return;

    try {

      // gezielt App-Keys löschen (nicht localStorage.clear())
      const keysToRemove = [
        STORAGE_KEY,
        MODEL_KEY,
        STREAM_KEY,
       // USAGE_KEY,
        RESPONSE_SETTINGS_KEY,
        "theme",
        "apiMode",
        "apiSource",
        "apiKey"
      ];

      keysToRemove.forEach(k => localStorage.removeItem(k));

      // UI Updates
      await updateLocalStorageInfo();

      // Optional: Wenn du willst, kann hier auch UI reset passieren,
      // aber du wolltest erstmal nur Settings/Storage Prinzip.

    } catch (err) {
      console.error("LocalStorage clear failed:", err);
    }

  };

}

