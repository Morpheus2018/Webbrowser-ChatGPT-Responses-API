/* =========================================================
   Responses Tools Manager (Web + File Search via Vector Store)
   ========================================================= */

const TOOL_KEY = 'active_tools_v1';

const IMAGE_TOOL_CONTEXT_RESPONSE_ID_KEY = 'image_tool_context_response_id_v1';
const IMAGE_TOOL_LAST_RESPONSE_ID_KEY = 'image_tool_last_response_id_v1';
/* =========================================================
   File Search Settings (max_num_results)
========================================================= */

const FILESEARCH_SETTINGS_KEY = 'fileSearch_maxResults';
const DEFAULT_MAX_RESULTS = 2;

/* global verfügbar */
window.fileSearchSettings = {
  maxResults: DEFAULT_MAX_RESULTS
};

/* Laden */
function restoreFileSearchSettings() {

  const saved = localStorage.getItem(FILESEARCH_SETTINGS_KEY);

  if (!saved) return;

  const num = Number(saved);

  if (num >= 1 && num <= 50) {
    window.fileSearchSettings.maxResults = num;
  }

}

/* Speichern */
window.persistFileSearchSettings = function () {

  localStorage.setItem(
    FILESEARCH_SETTINGS_KEY,
    window.fileSearchSettings.maxResults
  );

};

/* ---------------- Vector Store Persist ---------------- */
window.activeVectorStoreId = localStorage.getItem('vectorStoreId') || null;
window.activeVectorStoreName = localStorage.getItem('vectorStoreName') || null;

window.activeTools = {
  web_search: false,
  file_search: false,
  image_generation: false
};
/* ---------------- Image Generation Tool Settings ---------------- */

window.imageGenToolSettings = {
  action: "auto",
  quality: "low",
  size: "1024x1024",
  format: "png",
  background: "auto",
  compression: null,
  partialImages: null
};

window.imageToolInputImagesEnabled =
  window.imageToolInputImagesEnabled ?? false;

window.imageToolMaskEnabled =
  window.imageToolMaskEnabled ?? false;

window.imageToolInputFidelityEnabled =
  window.imageToolInputFidelityEnabled ?? false;

window.imageToolInputFidelity =
  window.imageToolInputFidelity || "low";

window.imageToolInputImages = window.imageToolInputImages || [];
window.imageToolMask = window.imageToolMask || null;

/* Helper für compression */
function normalizeCompressionValue(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}
/* Helper Image Streaming */
function normalizePartialImagesValue(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 1 && num <= 3 ? num : null;
}
/* Helper für Compression Support */
function isCompressionSupported(format) {
  return format === "jpeg" || format === "webp";
}
/* Helper für Bubble Auswahl anzeige */
function formatResponsesImageToolSummary(state = {}) {
  const parts = [];

  const action = state.action || "auto";
  parts.push(action === "auto" ? "Action-auto" : action);

  const quality = (state.quality || "low");
  parts.push(quality.charAt(0).toUpperCase() + quality.slice(1));

  const size = state.size || "auto";
  const sizeLabel =
    size === "1024x1024" ? "Quadrat 1024x1024" :
    size === "1024x1536" ? "Porträt 1024x1536" :
    size === "1536x1024" ? "Landschaft 1536x1024" :
    "Size-auto";
  parts.push(sizeLabel);

  const format = state.format || "png";
  const formatLabel =
    format === "jpeg" ? "JPEG" :
    format === "webp" ? "WebP" :
    "PNG";
  parts.push(formatLabel);

  const bg = state.background || "auto";
  const bgLabel =
    bg === "auto" ? "BG-auto" :
    bg === "transparent" ? "BG-Transparent" :
    bg === "opaque" ? "BG-Normal" :
    "BG-auto";
  parts.push(bgLabel);

  const inputImagesCount = Number(state.inputImagesCount) || 0;
  if (inputImagesCount > 0) {
    parts.push(`${inputImagesCount}x Input-Bild`);
  }

  if (state.maskEnabled) {
    parts.push("Maske aktiv");
  }

  if (state.fidelityEnabled) {
    const fidelity = state.inputFidelity === "high" ? "High" : "Low";
    parts.push(`Detail-${fidelity}`);
  }

  const compression = Number(state.compression);
  if (
    isCompressionSupported(format) &&
    Number.isFinite(compression) &&
    compression > 0
  ) {
    parts.push(`Compression-${compression}%`);
  }

  const partialImages = Number(state.partialImages);
  if (Number.isFinite(partialImages) && partialImages > 0) {
    parts.push(`Stream-${partialImages}`);
  }

  return `🎨 Responses API Image Tool · ${parts.join(" · ")} · Aktiviert.\nBitte Prompt eingeben.`;
}
/* Laufzeit-Meta des letzten Image-Generations-Calls (für Kostenberechnung) */
window.lastImageGenerationMeta = {
  model: "gpt-image-1.5",
  quality: "low",
  size: "1024x1024",
  images: 0,
  pendingCost: false
};

window.imageToolContextResponseId =
  localStorage.getItem(IMAGE_TOOL_CONTEXT_RESPONSE_ID_KEY) || null;

window.imageToolLastResponseId =
  localStorage.getItem(IMAGE_TOOL_LAST_RESPONSE_ID_KEY) || null;
/* Helper für action */
function persistImageToolResponseContext() {
  if (window.imageToolContextResponseId) {
    localStorage.setItem(
      IMAGE_TOOL_CONTEXT_RESPONSE_ID_KEY,
      window.imageToolContextResponseId
    );
  } else {
    localStorage.removeItem(IMAGE_TOOL_CONTEXT_RESPONSE_ID_KEY);
  }

  if (window.imageToolLastResponseId) {
    localStorage.setItem(
      IMAGE_TOOL_LAST_RESPONSE_ID_KEY,
      window.imageToolLastResponseId
    );
  } else {
    localStorage.removeItem(IMAGE_TOOL_LAST_RESPONSE_ID_KEY);
  }
}

window.clearImageToolResponseContext = function () {
  window.imageToolContextResponseId = null;
  window.imageToolLastResponseId = null;
  persistImageToolResponseContext();
};

window.getImageToolResponseContext = function () {
  return {
    previousResponseId: window.imageToolContextResponseId || null,
    hasImageContext: !!window.imageToolContextResponseId
  };
};

/* Preview Meta für file_search */
window.fileSearchMeta = window.fileSearchMeta || [];

/* ---------------- Supported Files ---------------- */
const SUPPORTED_EXT = [
  '.c','.cpp','.cs','.css','.doc','.docx','.go','.html','.java','.js',
  '.json','.md','.pdf','.php','.pptx','.py','.rb','.sh','.tex','.ts','.txt'
];

function isSupportedFile(fileName) {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_EXT.includes(ext);
}

// EIGENE formatBytes Funktion für responses-tools.js - WICHTIG: gibt String zurück
function formatBytesForTools(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return b + ' Bytes';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}
/* =========================================================
   Remove Vector Store Bubble Attachments
   ========================================================= */
function removeAllVectorStoreBubbleAttachments() {
  document
    .querySelectorAll('.vectorstore-file')
    .forEach(el => el.remove());
}
/* =========================================================
   Preview Rendering (file_search)
   ========================================================= */

function renderFileSearchPreview() {

  const bar =
    document.getElementById("inputPreviewBar");

  if (!bar) return;

  const meta =
    window.fileSearchMeta || [];

  /* combine with other previews safely */

  const existing =
    Array.from(bar.querySelectorAll(".input-preview-item"))
      .filter(x => !x.dataset.fileSearch);

  const html =
    meta.map((item, index) => `
      <div class="input-preview-item"
           data-file-search="true">
        <i class="fas fa-database"></i>
        <span>${item.file_name}</span>
        <i class="fas fa-xmark input-preview-remove"
           data-file-search-index="${index}">
        </i>
      </div>
    `).join("");

  bar.innerHTML =
    existing.map(x => x.outerHTML).join("") +
    html;

  bar.hidden =
    bar.children.length === 0;

  bar.querySelectorAll("[data-file-search-index]")
    .forEach(btn => {

      btn.onclick = () => {

        removeFileSearchByIndex(
          Number(btn.dataset.fileSearchIndex)
        );

      };

    });

}
/* =========================================================
   Remove Funktion
   ========================================================= */
function removeFileSearchByIndex(index) {

  window.fileSearchMeta.splice(index, 1);

  window.activeTools.file_search = false;

  persistTools();

  const toolsBtn =
    document.getElementById("toolsMenuBtn");

  if (toolsBtn) {

    toolsBtn.classList.remove("active");

    toolsBtn.innerHTML =
      `<i class="fas fa-toolbox"></i> Tools`;

  }
  removeAllVectorStoreBubbleAttachments();
  /* renderFileSearchPreview(); */ /* PreviewBar deaktiviert (Bubble Anzeige wird verwendet) */
  addMessage('bot', '🧹 Vector Store deaktiviert.');

}

/* ---------------- Persist / Restore ---------------- */
function persistTools() {
  localStorage.setItem(TOOL_KEY, JSON.stringify(window.activeTools));
}

function restoreTools() {
  const saved = localStorage.getItem(TOOL_KEY);
  if (!saved) return;
  try {
    Object.assign(window.activeTools, JSON.parse(saved));
  } catch {}
}

/* ---------------- Helper für script.js ---------------- */
window.getActiveTools = function () {
  const tools = [];

  if (window.activeTools.web_search) {
    tools.push({ type: "web_search" });
  }

  if (window.activeTools.file_search && window.activeVectorStoreId) {
    tools.push({
      type: "file_search",
      vector_store_ids: [window.activeVectorStoreId],
      max_num_results: window.fileSearchSettings.maxResults
    });
  }

  if (window.activeTools.image_generation) {

    const settings = window.imageGenToolSettings || {};
    const format = settings.format || "png";
    const compression = normalizeCompressionValue(settings.compression);
    const partialImages = normalizePartialImagesValue(settings.partialImages);

    const imageToolConfig = {
      type: "image_generation",
      action: settings.action || "auto",
      quality: settings.quality || "low",
      size: settings.size || "1024x1024",
      output_format: format
    };

    if (settings.background && settings.background !== "auto") {
      imageToolConfig.background = settings.background;
    }

    if (
      isCompressionSupported(format) &&
      compression !== null
    ) {
      imageToolConfig.output_compression = compression;
    }

    if (partialImages !== null) {
      imageToolConfig.partial_images = partialImages;
    }

    if (
      window.imageToolMaskEnabled === true &&
      window.imageToolMask?.imageUrl
    ) {
      imageToolConfig.input_image_mask = {
        image_url: window.imageToolMask.imageUrl
      };
    }

    if (
      window.imageToolInputImagesEnabled &&
      window.imageToolInputFidelityEnabled &&
      ["low", "high"].includes(window.imageToolInputFidelity)
    ) {
      imageToolConfig.input_fidelity = window.imageToolInputFidelity;
    }

    tools.push(imageToolConfig);
  }

  return tools;
};

const __baseGetPendingInputs =
  typeof window.getPendingInputs === "function"
    ? window.getPendingInputs.bind(window)
    : () => [];

window.getPendingInputs = function () {
  const baseInputs = __baseGetPendingInputs() || [];

  if (!window.imageToolInputImagesEnabled) {
    return baseInputs;
  }

  const imageInputs = (window.imageToolInputImages || []).map(file => ({
    type: "input_image",
    image_url: file.imageUrl,
    detail: "auto"
  }));

  return [...baseInputs, ...imageInputs];
};
/* ---------------- neu ---------------- */
async function ensureVectorStore(apiKey) {
  let storeId = window.activeVectorStoreId;

  if (storeId) {
    try {
      const check = await fetch(
        `https://api.openai.com/v1/vector_stores/${storeId}`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );

      if (check.ok) {
        const vs = await check.json();
        addMessage('bot',
          `🧠 Datei wird zu bestehender Vector Store hinzugefügt\nName: ${vs.name}\nID: ${vs.id}`
        );
        return vs.id;
      }
    } catch {}
  }

  /* ❌ Store existiert NICHT mehr → neu erstellen */
  addMessage('bot',
    `🧠 Keine Vector Store gefunden! Neue wird erstellt...`
  );

  const vsRes = await fetch('https://api.openai.com/v1/vector_stores', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: "Chat File Store" })
  });

  const vs = await vsRes.json();

  window.activeVectorStoreId = vs.id;
  window.activeVectorStoreName = vs.name;

  localStorage.setItem('vectorStoreId', vs.id);
  localStorage.setItem('vectorStoreName', vs.name);

  addMessage('bot',
    `🧠 Neue Vector Store erstellt\nName: ${vs.name}\nID: ${vs.id}`
  );

  return vs.id;
}
/* Helper Upload- und Render */
async function readImageToolInputFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string"
        ? reader.result
        : null;

      if (!result || !result.startsWith("data:image/")) {
        reject(new Error("Ungültige Bilddatei"));
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        reject(new Error("Bild ist größer als 20 MB"));
        return;
      }

      resolve({
        localId: "img_input_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        fileName: file.name,
        bytes: file.size,
        mimeType: file.type || "image/*",
        imageUrl: result
      });
    };

    reader.onerror = () => {
      reject(reader.error || new Error("Bild konnte nicht gelesen werden"));
    };

    reader.readAsDataURL(file);
  });
}

function renderImageToolInputImagesPreview({
  previewEl,
  toggleEl,
  metaEl,
  pickBtn,
  selectedFiles,
  enabled
}) {
  if (!toggleEl || !metaEl || !pickBtn) return;

  const files = Array.isArray(selectedFiles) ? selectedFiles : [];
  const isEnabled = enabled === true;
  const count = files.length;

  toggleEl.classList.toggle("active", isEnabled);
  pickBtn.disabled = !isEnabled;

  if (previewEl) {
    previewEl.hidden = true;
    previewEl.innerHTML = "";
  }

  if (!isEnabled) {
    metaEl.innerHTML = "Deaktiviert";
    return;
  }

  if (!count) {
    metaEl.innerHTML = "Keine Dateien";
    return;
  }

  metaEl.innerHTML = files.map((file, index) => `
    <div class="imggpt-file-row image-tool-input-preview" data-index="${index}">
      <span class="file-name">${index + 1}: ${file.fileName}</span>
      <button
        type="button"
        class="file-remove-btn"
        data-image-tool-remove="${index}">❌</button>
    </div>
  `).join("");

  metaEl.querySelectorAll("[data-image-tool-remove]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();

      const idx = Number(btn.dataset.imageToolRemove);
      if (!Number.isInteger(idx)) return;

      selectedFiles.splice(idx, 1);

      renderImageToolInputImagesPreview({
        previewEl,
        toggleEl,
        metaEl,
        pickBtn,
        selectedFiles,
        enabled: isEnabled
      });
    };
  });
}
/* Helper-Render für Masken-UI */
function renderImageToolMaskPreview({
  sectionEl,
  toggleEl,
  infoEl,
  enabled,
  maskFile,
  inputImagesEnabled,
  onRemove
}) {
  if (!sectionEl || !toggleEl || !infoEl) return;

  const isParentEnabled = inputImagesEnabled === true;
  const isEnabled = enabled === true;
  const hasMask = !!maskFile?.imageUrl;

  sectionEl.hidden = !isParentEnabled || !isEnabled;

  toggleEl.classList.toggle("active", isEnabled);
  toggleEl.classList.toggle("compression-disabled", !isParentEnabled);
  toggleEl.setAttribute(
    "aria-disabled",
    isParentEnabled ? "false" : "true"
  );
  toggleEl.style.pointerEvents = isParentEnabled ? "" : "none";
  toggleEl.style.opacity = isParentEnabled ? "" : "0.45";

  if (!isParentEnabled) {
    infoEl.innerHTML = "Deaktiviert";
    return;
  }

  if (!isEnabled) {
    infoEl.innerHTML = "Maske aus";
    return;
  }

  if (!hasMask) {
    infoEl.innerHTML = "Keine Maske";
    return;
  }

  infoEl.innerHTML = `
    <div class="imggpt-file-row image-tool-mask-preview">
      <span class="file-name">${maskFile.fileName}</span>
      <button
        type="button"
        class="file-remove-btn"
        data-mask-remove="1">❌</button>
    </div>
  `;

  const removeBtn = infoEl.querySelector("[data-mask-remove]");
  if (removeBtn) {
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof onRemove === "function") {
        onRemove();
      }
    };
  }
}
/* Render INPUT FIDELITY */
function renderImageToolInputFidelityUI({
  toggleEl,
  optionEls,
  parentEnabled,
  enabled,
  value
}) {
  if (!toggleEl || !optionEls?.length) return;

  const canUse = parentEnabled === true;
  const isEnabled = canUse && enabled === true;
  const currentValue = value === "high" ? "high" : "low";

  toggleEl.classList.toggle("active", isEnabled);
  toggleEl.classList.toggle("compression-disabled", !canUse);
  toggleEl.setAttribute("aria-disabled", canUse ? "false" : "true");
  toggleEl.style.pointerEvents = canUse ? "" : "none";
  toggleEl.style.opacity = canUse ? "" : "0.45";

  optionEls.forEach(el => {
    el.classList.toggle("compression-disabled", !isEnabled);
    el.setAttribute("aria-disabled", isEnabled ? "false" : "true");
    el.style.pointerEvents = isEnabled ? "" : "none";
    el.style.opacity = isEnabled ? "" : "0.45";

    const elValue = el.dataset.value;
    el.classList.toggle("active", isEnabled && elValue === currentValue);
  });
}

/* =========================================================
   DOM Ready
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  restoreFileSearchSettings();
  restoreTools();

  const webBtn = document.getElementById('webSearchBtn');
  const toolsBtn = document.getElementById('toolsMenuBtn');
  const dropdown = document.getElementById('toolsDropdown');
  const fileBtn = document.getElementById('fileBrowseBtn');
  const fileInput = document.getElementById('hiddenFileInput');
  const userInput = document.getElementById('userInput');
  const imageGenBtn = document.getElementById('imageGenBtn');

  const imgGenInputImagesToggle = document.getElementById('imgGenInputImagesToggle');
  const imgGenInputImagesMeta = document.getElementById('imgGenInputImagesMeta');
  const imgGenInputImagesPickBtn = document.getElementById('imgGenInputImagesPickBtn');
  const imgGenInputImagesInput = document.getElementById('imgGenInputImagesInput');
  const imgGenInputImagesPreview = document.getElementById('imgGenInputImagesPreview') || null;

  const imgGenMaskToggle = document.getElementById('imgGenMaskToggle');
  const imgGenMaskSection = document.getElementById('imgGenMaskSection');
  const imgGenMaskInput = document.getElementById('imgGenMaskInput');
  const imgGenPickMaskBtn = document.getElementById('imgGenPickMaskBtn');
  const imgGenMaskInfo = document.getElementById('imgGenMaskInfo');

  const imgGenInputFidelityToggle = document.getElementById('imgGenInputFidelityToggle');
  const imgGenInputFidelityItems = document.querySelectorAll('.input-fidelity-item');
  /* Zentrale Button Render */
function renderImageToolInputFeatureUI() {
  renderImageToolInputImagesPreview({
    previewEl: imgGenInputImagesPreview,
    toggleEl: imgGenInputImagesToggle,
    metaEl: imgGenInputImagesMeta,
    pickBtn: imgGenInputImagesPickBtn,
    selectedFiles: selectedImageToolInputImages,
    enabled: selectedImageToolInputImagesEnabled
  });

  renderImageToolMaskPreview({
    sectionEl: imgGenMaskSection,
    toggleEl: imgGenMaskToggle,
    infoEl: imgGenMaskInfo,
    enabled: selectedImageToolMaskEnabled,
    maskFile: selectedImageToolMask,
    inputImagesEnabled: selectedImageToolInputImagesEnabled,
    onRemove: () => {
      selectedImageToolMask = null;
      renderImageToolInputFeatureUI();
    }
  });

  renderImageToolInputFidelityUI({
    toggleEl: imgGenInputFidelityToggle,
    optionEls: imgGenInputFidelityItems,
    parentEnabled: selectedImageToolInputImagesEnabled,
    enabled: selectedImageToolInputFidelityEnabled,
    value: selectedImageToolInputFidelity
  });
}

  fileInput.setAttribute('accept', SUPPORTED_EXT.join(','));

  /* ---------------- Button Label Handling ---------------- */
function setToolsActiveLabel(active) {

  /* echten Zustand bestimmen */
  if (typeof active === "undefined") {
    active =
      window.activeTools.file_search === true &&
      !!window.activeVectorStoreId;
  }

  if (active) {

    toolsBtn.classList.add('active');

    toolsBtn.innerHTML =
      `<i class="fas fa-file-circle-check"></i> Datei Durchsuchen Aktiviert`;

  } else {

    toolsBtn.classList.remove('active');

    toolsBtn.innerHTML =
      `<i class="fas fa-toolbox"></i> Tools`;

  }

  dropdown.classList.remove("show");
}

/* ---------------- Image Tool Label ---------------- */
function setImageToolLabel(active) {
  const toolsBtn = document.getElementById("toolsMenuBtn");
  if (!toolsBtn) return;

  if (active) {
    toolsBtn.classList.add("active");
    toolsBtn.innerHTML =
      `<i class="fas fa-image"></i> Responses API Image Tool Aktiviert`;
  } else {
    toolsBtn.classList.remove("active");
    toolsBtn.innerHTML =
      `<i class="fas fa-toolbox"></i> Tools`;
  }
}
function refreshToolsMenuButton() {

  if (window.activeTools.image_generation) {
    setImageToolLabel(true);
    return;
  }

  if (
    window.activeTools.file_search === true &&
    !!window.activeVectorStoreId
  ) {
    setToolsActiveLabel(true);
    return;
  }

  toolsBtn.classList.remove("active");
  toolsBtn.innerHTML = `<i class="fas fa-toolbox"></i> Tools`;
  dropdown.classList.remove("show");
}
  /* ---------------- Web Search Toggle ---------------- */
  function updateWebBtn() {
    webBtn.classList.toggle('active', window.activeTools.web_search);
  }

  webBtn.addEventListener('click', () => {
    window.activeTools.web_search = !window.activeTools.web_search;
    persistTools();
    updateWebBtn();
    userInput.focus();
  });

  updateWebBtn();

 /* ---------------- Image Generation Tool Toggle ---------------- */
  function updateImageGenBtn() {

    if (!imageGenBtn) return;

    imageGenBtn.classList.toggle(
      'active',
      window.activeTools.image_generation
    );

  }

imageGenBtn?.addEventListener('click', () => {
  if (imgGenToolOverlay) {
    imgGenToolOverlay.hidden = false;
    dropdown.classList.remove("show");
  }
});

  updateImageGenBtn();
  

/* Dropdown Menü bei Aktiven Tools ausblende */
function shouldOpenToolsDropdown() {

  const t = window.activeTools || {};

  return !(
    window.imageGenState?.active ||
    window.imageGPTEngineState?.active ||
    t.file_search ||
    t.image_generation
  );
}

/* ---------------- Dropdown Handling ---------------- */

toolsBtn.addEventListener('click', (e) => {
  e.stopPropagation();

  if (!shouldOpenToolsDropdown()) {
    dropdown.classList.remove("show");
    return;
  }

  dropdown.classList.toggle("show");
});

document.addEventListener('click', (e) => {
  if (!shouldOpenToolsDropdown()) {
    dropdown.classList.remove("show");
    return;
  }

  if (!dropdown.contains(e.target) && !toolsBtn.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

/* Menü schließen wenn ein Tool gewählt wurde */
dropdown.addEventListener("click", (e) => {
  const btn = e.target.closest("button");

  if (btn) {
    dropdown.classList.remove("show");
  }
});

  /* ---------------- Deactivate File Search ---------------- */
  
  toolsBtn.addEventListener('click', async () => {
    if (!window.activeTools.file_search) return;

    const result = await customConfirm(
      'Datei durchsuchen deaktivieren?',
      {
        title: 'File Search',
        icon: 'fas fa-file-circle-xmark',
        okText: 'Ja, deaktivieren',
        extraText: 'Neue Datei'
      }
    );

    // Abbrechen
    if (result === false) return;

    // Neue Datei auswählen
    if (result === 'extra') {
      fileInput.click();
      return;
    }

    // Deaktivieren
    window.activeTools.file_search = false;
    persistTools();
    setToolsActiveLabel(false);
    /* Neu */
	window.fileSearchMeta = [];
    removeAllVectorStoreBubbleAttachments();
	/* renderFileSearchPreview(); */ /* PreviewBar deaktiviert (Bubble Anzeige wird verwendet) */
  addMessage('bot', '🧹 Vector Store deaktiviert.');

  });
  /* ---------------- Deactivate Responses API Image Tool ---------------- */
toolsBtn.addEventListener('click', async () => {
  if (!window.activeTools.image_generation) return;

  const result = await customConfirm(
    'Responses API Image Tool deaktivieren?',
    {
      title: 'Responses API Image Tool',
      icon: 'fas fa-image',
      okText: 'Ja, deaktivieren',
      extraText: 'Neu auswählen'
    }
  );

  if (result === false) return;

  if (result === 'extra') {
    if (imgGenToolOverlay) {
      imgGenToolOverlay.hidden = false;
    }
    return;
  }

  window.activeTools.image_generation = false;
window.clearImageToolResponseContext?.();
  persistTools();
  updateImageGenBtn();
  refreshToolsMenuButton();
  addMessage('bot', '🧹 Responses API Image Tool deaktiviert.');
});
  /* ---------------- Datei auswählen ---------------- */
  fileBtn.addEventListener('click', () => {
    dropdown.hidden = true;
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const api = getApiConfig();

    /* =========================================================
      1️⃣ Dateiformat prüfen (deine bestehende Logik)
      ========================================================= */
    if (!isSupportedFile(file.name)) {
      addMessage('bot',
        `❌ Das Datei Format "${file.name}" wird im file_search nicht unterstützt!`);
      fileInput.value = '';
      return;
    }

    /* =========================================================
      2️⃣ Demo / Kein API Guard (NEU, extrem wichtig)
      ========================================================= */
    if (api.mode === 'demo' || !api.apiKey) {
      addMessage(
        'bot',
        `⚠️ Datei-Suche ist im Demo-Modus nicht verfügbar.\nBitte Browser oder config.js Modus verwenden.`
      );
      fileInput.value = '';
      return;
    }

    try {
      // WICHTIG: Eigene formatBytesForTools Funktion verwenden
      addMessage('bot',
        `📂 Lade Datei "${file.name}" (${formatBytesForTools(file.size)}) hoch...`);

      /* 1️⃣ Upload */
      const form = new FormData();
      form.append('file', file);
      form.append('purpose', 'assistants');

      const uploadRes = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${api.apiKey}` },
        body: form
      });

      const uploaded = await uploadRes.json();

      /* 2️⃣ Vector Store holen oder erstellen */
      const vectorStoreId = await ensureVectorStore(api.apiKey);

      /* 3️⃣ Datei hinzufügen */
      await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_id: uploaded.id })
      });

      addMessage('bot', '⏳ Verarbeite Datei für Suche...');

      /* 4️⃣ Warten */
      let ready = false;
      while (!ready) {
        await new Promise(r => setTimeout(r, 1500));
        const check = await fetch(
          `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
          { headers: { 'Authorization': `Bearer ${api.apiKey}` } }
        );
        const status = await check.json();
        ready = status.status === 'completed';
      }

      /* 5️⃣ Aktivieren */
      window.activeTools.file_search = true;
      persistTools();
      setToolsActiveLabel(true);
      /* Neu */
	  window.fileSearchMeta = [{
	    file_name: file.name
	  }];

	/* renderFileSearchPreview(); */ /* PreviewBar deaktiviert (Bubble Anzeige wird verwendet) */

      // WICHTIG: Eigene formatBytesForTools Funktion verwenden
      addMessage('bot',
        `✅ Datei "${file.name}" (${formatBytesForTools(file.size)}) ist jetzt durchsuchbar!`
      );
      attachVectorStoreFileBubble(file.name);

      userInput.focus();

    } catch (err) {
      addMessage('bot', `❌ Fehler: ${err.message}`);
    }
  });

  /* Initial State */
/*  setToolsActiveLabel(); */ /* alt */
refreshToolsMenuButton();
/* =========================================================
   Sync Button nach jeder neuen Chat-Nachricht
   ========================================================= */

const messagesContainer = document.getElementById('messages');

if (messagesContainer) {

const observer = new MutationObserver(() => {

  if (
    window.activeTools.file_search &&
    window.activeVectorStoreId
  ) {
    setToolsActiveLabel(true);
  }

  /* 🔥 NEU — Image Tool persistent halten */
  if (window.activeTools.image_generation) {
    setImageToolLabel(true);
  }

});

  observer.observe(messagesContainer, {
    childList: true,
    subtree: true
  });

}
/* ---------------- Image Gen Tool Overlay ---------------- */

const imgGenToolOverlay = document.getElementById('imgGenToolOverlay');
const imgGenToolCloseBtn = document.getElementById('imgGenToolCloseBtn');
const imgGenToolCancelBtn = document.getElementById('imgGenToolCancelBtn');
const imgGenToolSelectBtn = document.getElementById('imgGenToolSelectBtn');

let selectedImageGenOptions = {
  action: "auto",
  quality: "low",
  size: "1024x1024",
  format: "png",
  background: "auto",
  compression: null,
  partialImages: null
};

let selectedImageToolInputImagesEnabled =
  window.imageToolInputImagesEnabled === true;

let selectedImageToolMaskEnabled =
  window.imageToolMaskEnabled === true;

let selectedImageToolInputFidelityEnabled =
  window.imageToolInputFidelityEnabled === true;

let selectedImageToolInputFidelity =
  ["low", "high"].includes(window.imageToolInputFidelity)
    ? window.imageToolInputFidelity
    : "low";

let selectedImageToolInputImages = [...(window.imageToolInputImages || [])];
let selectedImageToolMask =
  window.imageToolMask ? { ...window.imageToolMask } : null;

function syncImageFormatDependentUI() {
  if (!imgGenToolOverlay) return;

  const format = selectedImageGenOptions.format || "png";
  const compressionSupported = isCompressionSupported(format);
  const transparentSupported = format === "png" || format === "webp";

  imgGenToolOverlay
    .querySelectorAll('.compression-item')
    .forEach(item => {
      item.classList.toggle('compression-disabled', !compressionSupported);
      item.setAttribute(
        'aria-disabled',
        compressionSupported ? 'false' : 'true'
      );
      item.style.pointerEvents = compressionSupported ? '' : 'none';
      item.style.opacity = compressionSupported ? '' : '0.45';
    });

  const transparentBtn = imgGenToolOverlay.querySelector(
    '.imggpt-item[data-type="background"][data-value="transparent"]'
  );

  if (transparentBtn) {
    transparentBtn.classList.toggle('compression-disabled', !transparentSupported);
    transparentBtn.setAttribute(
      'aria-disabled',
      transparentSupported ? 'false' : 'true'
    );
    transparentBtn.style.pointerEvents = transparentSupported ? '' : 'none';
    transparentBtn.style.opacity = transparentSupported ? '' : '0.45';
  }

  if (!compressionSupported) {
    selectedImageGenOptions.compression = null;

    imgGenToolOverlay
      .querySelectorAll('.compression-item')
      .forEach(x => x.classList.remove('active'));
  } else {
    const activeCompression =
      normalizeCompressionValue(selectedImageGenOptions.compression);

    imgGenToolOverlay
      .querySelectorAll('.compression-item')
      .forEach(x => {
        x.classList.toggle(
          'active',
          Number(x.dataset.value) === activeCompression
        );
      });
  }

  if (!transparentSupported && selectedImageGenOptions.background === "transparent") {
    selectedImageGenOptions.background = "auto";

    imgGenToolOverlay
      .querySelectorAll('.imggpt-item[data-type="background"]')
      .forEach(x => x.classList.remove('active'));

    imgGenToolOverlay
      .querySelector('.imggpt-item[data-type="background"][data-value="auto"]')
      ?.classList.add('active');
  }
}

/* Items auswählen */
imgGenToolOverlay?.querySelectorAll('.imggpt-item')
  .forEach(item => {

    item.addEventListener('click', () => {

      const rawType = item.dataset.type;
      const value = item.dataset.value;

      if (!rawType) return;

      const type =
        rawType === "output_compression"
          ? "compression"
          : rawType === "partial_images"
            ? "partialImages"
            : rawType;

      const currentFormat = selectedImageGenOptions.format || "png";

      if (
        type === "background" &&
        value === "transparent" &&
        !["png", "webp"].includes(currentFormat)
      ) {
        return;
      }

      if (
        type === "compression" &&
        !isCompressionSupported(currentFormat)
      ) {
        return;
      }

      const isAlreadyActive = item.classList.contains('active');

      if (type === "compression") {
        if (isAlreadyActive) {
          item.classList.remove('active');
          selectedImageGenOptions.compression = null;
          imgGenToolSelectBtn.disabled = false;
          return;
        }

        imgGenToolOverlay
          .querySelectorAll('.compression-item')
          .forEach(x => x.classList.remove('active'));

        item.classList.add('active');
        selectedImageGenOptions.compression =
          normalizeCompressionValue(value);

        imgGenToolSelectBtn.disabled = false;
        return;
      }

      if (type === "partialImages") {
        if (isAlreadyActive) {
          item.classList.remove('active');
          selectedImageGenOptions.partialImages = null;
          imgGenToolSelectBtn.disabled = false;
          return;
        }

        imgGenToolOverlay
          .querySelectorAll('.partial-images-item')
          .forEach(x => x.classList.remove('active'));

        item.classList.add('active');
        selectedImageGenOptions.partialImages =
          normalizePartialImagesValue(value);

        imgGenToolSelectBtn.disabled = false;
        return;
      }

      imgGenToolOverlay
        .querySelectorAll(`.imggpt-item[data-type="${rawType}"]`)
        .forEach(x => x.classList.remove('active'));

      item.classList.add('active');
      selectedImageGenOptions[type] = value;

      if (type === "format") {
        syncImageFormatDependentUI();
      }

      imgGenToolSelectBtn.disabled = false;
    });

  });

syncImageFormatDependentUI();

/* Overlay-UI für Referenzbilder initialisieren */
renderImageToolInputFeatureUI();

imgGenInputImagesPickBtn?.addEventListener("click", () => {
  if (!selectedImageToolInputImagesEnabled) return;
  imgGenInputImagesInput?.click();
});
/* Toggle Imput */
imgGenInputImagesToggle?.addEventListener("click", () => {
  selectedImageToolInputImagesEnabled =
    !selectedImageToolInputImagesEnabled;

  if (!selectedImageToolInputImagesEnabled) {
    selectedImageToolInputImages = [];
    selectedImageToolMaskEnabled = false;
    selectedImageToolMask = null;
    selectedImageToolInputFidelityEnabled = false;
    selectedImageToolInputFidelity = "low";
    imgGenInputImagesInput.value = "";
    if (imgGenMaskInput) imgGenMaskInput.value = "";
  }

  renderImageToolInputFeatureUI();
});
/* Toggle + Upload für Maske */
imgGenMaskToggle?.addEventListener("click", () => {
  if (!selectedImageToolInputImagesEnabled) return;

  selectedImageToolMaskEnabled =
    !selectedImageToolMaskEnabled;

  if (!selectedImageToolMaskEnabled) {
    selectedImageToolMask = null;
    if (imgGenMaskInput) imgGenMaskInput.value = "";
  }

  renderImageToolInputFeatureUI();
});

imgGenPickMaskBtn?.addEventListener("click", () => {
  if (
    !selectedImageToolInputImagesEnabled ||
    !selectedImageToolMaskEnabled ||
    !imgGenMaskInput
  ) return;

  imgGenMaskInput.click();
});

imgGenMaskInput?.addEventListener("change", async () => {
  const file = imgGenMaskInput?.files?.[0];
  if (
    !file ||
    !selectedImageToolInputImagesEnabled ||
    !selectedImageToolMaskEnabled
  ) {
    if (imgGenMaskInput) imgGenMaskInput.value = "";
    return;
  }

  try {
    selectedImageToolMask = await readImageToolInputFile(file);
  } catch (err) {
    console.warn("Masken-Datei Fehler:", err);
  } finally {
    renderImageToolInputFeatureUI();

    if (imgGenMaskInput) imgGenMaskInput.value = "";
  }
});

imgGenInputFidelityToggle?.addEventListener("click", () => {
  if (!selectedImageToolInputImagesEnabled) return;

  selectedImageToolInputFidelityEnabled =
    !selectedImageToolInputFidelityEnabled;

  if (!selectedImageToolInputFidelityEnabled) {
    selectedImageToolInputFidelity = "low";
  }

  renderImageToolInputFeatureUI();
});

imgGenInputFidelityItems.forEach(item => {
  item.addEventListener("click", () => {
    if (
      !selectedImageToolInputImagesEnabled ||
      !selectedImageToolInputFidelityEnabled
    ) {
      return;
    }

    const value = item.dataset.value;
    if (!["low", "high"].includes(value)) return;

    if (
      selectedImageToolInputFidelity === value &&
      item.classList.contains("active")
    ) {
      selectedImageToolInputFidelityEnabled = false;
      selectedImageToolInputFidelity = "low";
    } else {
      selectedImageToolInputFidelityEnabled = true;
      selectedImageToolInputFidelity = value;
    }

    renderImageToolInputFeatureUI();
  });
});

imgGenInputImagesInput?.addEventListener("change", async () => {
  const files = Array.from(imgGenInputImagesInput.files || []);
  if (!files.length || !selectedImageToolInputImagesEnabled) {
    imgGenInputImagesInput.value = "";
    return;
  }

  const api = getApiConfig();

  if (api.mode === "demo" || !api.apiKey) {
    imgGenInputImagesInput.value = "";
    return;
  }

  try {
    const preparedFiles = await Promise.all(
      files
        .filter(file => file.type.startsWith("image/"))
        .map(file => readImageToolInputFile(file))
    );

    const existingKeys = new Set(
      selectedImageToolInputImages.map(x => x.imageUrl)
    );

    preparedFiles.forEach(file => {
      if (!existingKeys.has(file.imageUrl)) {
        selectedImageToolInputImages.push(file);
      }
    });

    renderImageToolInputFeatureUI();

  } catch (err) {
    console.warn("Referenzbilder Fehler:", err);
  } finally {
    imgGenInputImagesInput.value = "";
  }
});
/* Overlay-UI für Referenzbilder initialisieren ENDE */

/* Schließen */
function closeImgGenToolOverlay() {
  selectedImageToolInputImagesEnabled =
    window.imageToolInputImagesEnabled === true;

  selectedImageToolMaskEnabled =
    window.imageToolMaskEnabled === true;

  selectedImageToolInputFidelityEnabled =
    window.imageToolInputFidelityEnabled === true;

  selectedImageToolInputFidelity =
    ["low", "high"].includes(window.imageToolInputFidelity)
      ? window.imageToolInputFidelity
      : "low";

  selectedImageToolInputImages = [...(window.imageToolInputImages || [])];
  selectedImageToolMask =
    window.imageToolMask ? { ...window.imageToolMask } : null;

  renderImageToolInputFeatureUI();

  if (imgGenToolOverlay) imgGenToolOverlay.hidden = true;
}

imgGenToolCloseBtn?.addEventListener('click', closeImgGenToolOverlay);
imgGenToolCancelBtn?.addEventListener('click', closeImgGenToolOverlay);

document.addEventListener("keydown", (e) => {
  if (!imgGenToolOverlay || imgGenToolOverlay.hidden) return;

  if (e.key === "Escape") {
    e.preventDefault();
    closeImgGenToolOverlay();
    return;
  }

  if (e.key === "Enter") {
    const target = e.target;
    const isTextarea =
      target &&
      (target.tagName === "TEXTAREA" ||
       target.tagName === "INPUT" ||
       target.isContentEditable);

    if (isTextarea) return;

    e.preventDefault();
    imgGenToolSelectBtn?.click();
  }
});
/* ---------------- Image Tool Select ---------------- */
imgGenToolSelectBtn?.addEventListener('click', () => {

  window.activeTools.image_generation = true;

  window.imageGenToolSettings = {
    ...selectedImageGenOptions,
    compression: normalizeCompressionValue(selectedImageGenOptions.compression),
    partialImages: normalizePartialImagesValue(selectedImageGenOptions.partialImages)
  };

  window.imageToolInputImagesEnabled =
    selectedImageToolInputImagesEnabled === true;

  window.imageToolMaskEnabled =
    selectedImageToolInputImagesEnabled === true &&
    selectedImageToolMaskEnabled === true;

  window.imageToolInputFidelityEnabled =
    selectedImageToolInputFidelityEnabled === true;

  window.imageToolInputFidelity =
    selectedImageToolInputFidelity === "high" ? "high" : "low";

  window.imageToolInputImages =
    selectedImageToolInputImages.map(file => ({ ...file }));

  window.imageToolMask =
    window.imageToolMaskEnabled && selectedImageToolMask
      ? { ...selectedImageToolMask }
      : null;

  persistTools();

  const selectedCompression =
    normalizeCompressionValue(selectedImageGenOptions.compression);

  const selectedPartialImages =
    normalizePartialImagesValue(selectedImageGenOptions.partialImages);

  const inputImagesCount =
    selectedImageToolInputImages.length;

  addMessage(
    'bot',
    formatResponsesImageToolSummary({
      action: selectedImageGenOptions.action,
      quality: selectedImageGenOptions.quality,
      size: selectedImageGenOptions.size,
      format: selectedImageGenOptions.format,
      background: selectedImageGenOptions.background,
      compression: selectedCompression,
      partialImages: selectedPartialImages,
      inputImagesCount,
      maskEnabled: window.imageToolMaskEnabled,
      fidelityEnabled: window.imageToolInputFidelityEnabled,
      inputFidelity: window.imageToolInputFidelity
    })
  );

  updateImageGenBtn();
  refreshToolsMenuButton();

  closeImgGenToolOverlay();
  userInput.focus();

});

});
/* DOM-ENDE */

/* =========================================================
   File Search Bubble Attachment Renderer
   ========================================================= */

function attachVectorStoreFileBubble(fileName) {

  const lastMsg = messages.lastElementChild;
  const bubble = lastMsg?.querySelector(".bubble");

  if (!bubble) return;

  const wrapper = document.createElement("div");
  wrapper.className = "vectorstore-file";

  wrapper.innerHTML = `
    <span class="vectorstore-file-name">${fileName}</span>
    <i class="fas fa-xmark vectorstore-file-remove"></i>
  `;

  wrapper.querySelector(".vectorstore-file-remove").onclick = () => {

    window.activeTools.file_search = false;

    persistTools();

    window.fileSearchMeta = [];

    const toolsBtn =
      document.getElementById("toolsMenuBtn");

    if (toolsBtn) {

      toolsBtn.classList.remove("active");

      toolsBtn.innerHTML =
        `<i class="fas fa-toolbox"></i> Tools`;

    }

    removeAllVectorStoreBubbleAttachments();
    addMessage('bot', '🧹 Vector Store deaktiviert.');

  };

  bubble.appendChild(wrapper);
}
/* Helper Live stream */
function upsertPartialResponseImagePreview({
  bubble,
  imageEl,
  callId,
  imageBase64
}) {
  if (!bubble || !imageBase64) return imageEl || null;

  const src = normalizeResponseImageSrc(imageBase64);
  if (!src) return imageEl || null;

  let previewEl = imageEl;

  if (!previewEl || !previewEl.isConnected) {
    previewEl = bubble.querySelector('.generated-image.partial-preview');
  }

  if (!previewEl) {
    previewEl = document.createElement("img");
    previewEl.className = "generated-image partial-preview";
    previewEl.dataset.partialPreview = "true";
    previewEl.dataset.callId = String(callId || "image_generation_call");
    previewEl.alt = "Generiere Vorschau...";
    previewEl.title = "Live-Vorschau";

    const existingImage = bubble.querySelector(".generated-image:not(.partial-preview)");

    if (existingImage) {
      existingImage.replaceWith(previewEl);
    } else {
      bubble.appendChild(previewEl);
    }
  }

  previewEl.src = src;
  previewEl.addEventListener("load", scrollToBottom, { once: true });

  let timeEl = bubble.querySelector(".bubble-time");
  if (!timeEl) {
    createMessageTimestamp?.(bubble, new Date().toISOString());
  }

  return previewEl;
}

function removePartialResponseImagePreview(bubble, callId = null) {
  if (!bubble) return;

  const selector = callId
    ? `.generated-image.partial-preview[data-call-id="${String(callId)}"]`
    : '.generated-image.partial-preview';

  bubble.querySelectorAll(selector).forEach(el => el.remove());
}
/* =========================================================
   Responses API Image Tool Helpers (Render)
   ========================================================= */
function getResponseImageBase64(item) {
  if (!item || typeof item !== "object") return null;

  return (
    item.result ||
    item.image_base64 ||
    item.b64_json ||
    item?.image?.b64_json ||
    item?.image?.base64 ||
    null
  );
}

function normalizeResponseImageSrc(raw) {
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("data:image/")) {
    return value;
  }

  const mime =
    value.startsWith("/9j/") ? "image/jpeg" : "image/png";

  return `data:${mime};base64,${value}`;
}

function appendResponseImagesToLastBubble(data) {
  if (!data || !Array.isArray(data.output)) return;

  const lastMsg = messages.lastElementChild;
  const bubble = lastMsg?.querySelector(".bubble");
  if (!bubble) return;

  removePartialResponseImagePreview(bubble);

  let hasRenderedImage = false;
  let imageCountThisResponse = 0;
  let lastQuality = window.imageGenToolSettings?.quality || "low";
  let lastSize = window.imageGenToolSettings?.size || "1024x1024";

  for (const item of data.output) {
    if (item?.type !== "image_generation_call") continue;

    const quality =
      item.quality ||
      window.imageGenToolSettings?.quality ||
      "low";

    const size =
      item.size ||
      window.imageGenToolSettings?.size ||
      "1024x1024";

    const rawBase64 = getResponseImageBase64(item);
    const src = normalizeResponseImageSrc(rawBase64);

    if (!src) continue;

    imageCountThisResponse++;
    lastQuality = quality;
    lastSize = size;

    window.imageGenToolSettings.quality = quality;
    window.imageGenToolSettings.size = size;

    const img = document.createElement("img");
    img.className = "generated-image";
    img.src = src;

    img.addEventListener("load", scrollToBottom, { once: true });

    /* Timestamp für frisch erzeugte Bildnachricht nur einmal setzen */
    let timeEl = bubble.querySelector(".bubble-time");

    if (!timeEl) {
      const createdAt = new Date().toISOString();
      createMessageTimestamp?.(bubble, createdAt);
      saveHistory?.();
    }

    const saveBtn = document.createElement("button");
    saveBtn.className = "img-save-btn";
    saveBtn.innerHTML = `<i class="fas fa-download"></i> Speichern`;
    saveBtn.title = "Im IndexedDB Speicher sichern";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "img-delete-btn";
    deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Löschen`;
    deleteBtn.title = "Aus IndexedDB löschen";
    deleteBtn.hidden = true;

    saveBtn.onclick = async () => {
      try {
        const a = document.createElement("a");
        a.href = img.src;
        a.download = `image-${Date.now()}.png`;
        a.click();

        if (!img.dataset.imageId) {
          const id = "img_" + Date.now();

          await saveImageToDB(id, img.src);

          img.dataset.imageId = id;
          saveBtn.dataset.imageId = id;

          deleteBtn.hidden = false;
          saveBtn.title = "Bereits im IndexedDB gespeichert";

          saveHistory?.();
        }

      } catch (err) {
        addMessage?.(
          "bot",
          "❌ Bild konnte nicht gespeichert werden: " +
          (err?.message || err)
        );
      }
    };

    deleteBtn.onclick = async () => {
      try {
        const id = img.dataset.imageId;

        if (id) {
          await deleteImageFromDB(id);
        }

        suppressAutoScroll = true;
        bubble.innerHTML = "🗑️ Bild wurde gelöscht.";
        saveHistory?.();

        setTimeout(() => {
          suppressAutoScroll = false;
        }, 50);

      } catch (err) {
        addMessage?.(
          "bot",
          "❌ Bild konnte nicht gelöscht werden: " +
          (err?.message || err)
        );
      }
    };

    bubble.appendChild(img);
    bubble.appendChild(saveBtn);
    bubble.appendChild(deleteBtn);

    attachResponseImageCostButton(img, bubble);

    if (typeof attachImageExpandFeature === "function") {
      attachImageExpandFeature(img, bubble);
    }

    hasRenderedImage = true;
  }

  if (imageCountThisResponse > 0) {
    window.lastImageGenerationMeta = {
      model: "gpt-image-1.5",
      quality: lastQuality,
      size: lastSize,
      images: imageCountThisResponse,
      pendingCost: true,
      usageTracked: false
    };
  }

  if (hasRenderedImage) {
    if (data?.id) {
      window.imageToolContextResponseId = data.id;
      window.imageToolLastResponseId = data.id;
      persistImageToolResponseContext();
    }

    scrollToBottom();
    createMessageTimestamp(bubble);
  } else if (data?.id) {
    window.imageToolLastResponseId = data.id;
    persistImageToolResponseContext();
  }
}
/* ================= IMAGE Responses API KOSTEN BUTTON / Fenster ================= */
function attachResponseImageCostButton(img, bubble) {
  if (!img || !bubble) return;

  let usageBtn = bubble.querySelector(".img-usage-btn");

  if (!usageBtn) {
    usageBtn = document.createElement("button");
    usageBtn.className = "img-usage-btn";
    usageBtn.title = "Kostenberechnung";
    usageBtn.innerHTML = `<i class="fas fa-coins"></i> Kosten`;
    bubble.appendChild(usageBtn);
  }

  function syncImageToolCostUI() {
    const totalCost =
      Number(
        img.dataset.imageToolCost ||
        window.lastImageToolCostTotal ||
        0
      );

    const logText =
      img.dataset.imageToolCostLog ||
      window.lastImageToolCostLog ||
      "";

    if (totalCost > 0) {
      img.dataset.imageToolCost = String(totalCost);
      usageBtn.innerHTML =
        `<i class="fas fa-coins"></i> $${totalCost.toFixed(6)}`;
    }

    if (logText) {
      img.dataset.imageToolCostLog = logText;
    }

    if (
      totalCost > 0 &&
      window.lastImageGenerationMeta &&
      window.lastImageGenerationMeta.usageTracked === false
    ) {
      if (!window.sessionUsage.imageTool || typeof window.sessionUsage.imageTool !== "object") {
        window.sessionUsage.imageTool = { calls: 0, costUSD: 0 };
      }

      window.sessionUsage.imageTool.calls += 1;
      window.sessionUsage.imageTool.costUSD += totalCost;
      window.lastImageGenerationMeta.usageTracked = true;

      persistUsage?.();
      window.renderModelManager?.();
    }

    saveHistory?.();
  }

  usageBtn.onclick = () => {
    syncImageToolCostUI();

    const overlay = document.getElementById("imgUsageOverlay");
    const content = document.getElementById("imgUsageContent");
    const closeBtn = document.getElementById("imgUsageCloseBtn");
    const okBtn = document.getElementById("imgUsageOkBtn");

    if (!overlay || !content) return;

    content.textContent =
      img.dataset.imageToolCostLog ||
      window.lastImageToolCostLog ||
      "";

    overlay.hidden = false;

    if (!overlay._init) {
      const close = () => overlay.hidden = true;

      closeBtn?.addEventListener("click", close);
      okBtn?.addEventListener("click", close);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });

      document.addEventListener("keydown", (e) => {
        if (overlay.hidden) return;

        if (e.key === "Escape") {
          close();
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          close();
        }
      });

      overlay._init = true;
    }
  };

  /* Nach calculateCostUSD verfügbar */
  setTimeout(syncImageToolCostUI, 0);
  setTimeout(syncImageToolCostUI, 60);
}

