/* =========================================================
   VIDEO API UI
   - UI + localStorage
   - Create Video Job
   - Poll Status
   - Download Result
   - Start direkt aus dem Modal
   ========================================================= */

const VIDEO_SETTINGS_KEY = "video_api_settings_v1";
const VIDEO_ENABLED_KEY = "video_api_enabled_v1";

const VIDEO_LAST_COMPLETED_ID_KEY = "video_api_last_completed_id_v1";
const VIDEO_LAST_CHARACTER_ID_KEY = "video_api_last_character_id_v1";

//const VIDEO_SAVED_VIDEOS_KEY = "video_api_saved_videos_v1";
const VIDEO_SAVED_CHARACTERS_KEY = "video_api_saved_characters_v1";

const VIDEO_DEFAULT_SETTINGS = {
  enabled: false,
  mode: "create",
  model: "sora-2",
  size: "1280x720",
  seconds: "4",
  characterName: "",
 // promptPrefix: "",
  autoPollEnabled: true,
  pollIntervalMs: 10000
};

let videoApiPollingAbort = {
  cancelled: false
};

let currentVideoDownloadUrl = null;
let videoApiSelectedAsset = null;

let selectedSourceVideoId = null;
let selectedCharacterId = null;
let sessionVideoSources = [];

if (!window.sessionUsage) {
  window.sessionUsage = {};
}
/* Video Calls */
if (!window.sessionUsage.video || typeof window.sessionUsage.video !== "object") {
  window.sessionUsage.video = {
    calls: 0,
    costUSD: 0
  };
}

function getVideoApiSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIDEO_SETTINGS_KEY) || "{}");

    return {
      ...VIDEO_DEFAULT_SETTINGS,
      ...saved
    };
  } catch {
    return { ...VIDEO_DEFAULT_SETTINGS };
  }
}

function saveVideoApiSettings(settings) {
  const next = {
    ...VIDEO_DEFAULT_SETTINGS,
    ...settings
  };

  localStorage.setItem(VIDEO_SETTINGS_KEY, JSON.stringify(next));
  localStorage.setItem(VIDEO_ENABLED_KEY, next.enabled ? "true" : "false");

  window.videoApiSettings = next;
  updateVideoApiButtonState();

  return next;
}

function isVideoApiEnabled() {
  return true;
}

function updateVideoApiStatusPill() {}

function updateVideoApiButtonState() {}
function updateVideoStartButtonLabel() {
  const startBtn = document.getElementById("videoApiStartTestBtn");
  const modeEl = document.getElementById("videoApiMode");

  if (!startBtn) return;

  const mode =
    modeEl?.value ||
    window.videoApiSettings?.mode ||
    VIDEO_DEFAULT_SETTINGS.mode;

  startBtn.textContent =
    mode === "character"
      ? "Character Erstellen"
      : "Video Generierung Starten";
}

function applyVideoApiSettingsToUi(settings) {
  const modeEl = document.getElementById("videoApiMode");
  const modelEl = document.getElementById("videoApiModel");
  const sizeEl = document.getElementById("videoApiSize");
  const secondsEl = document.getElementById("videoApiSeconds");
 // const promptPrefixEl = document.getElementById("videoApiPromptPrefix");
 // const enabledEl = document.getElementById("videoApiEnabled");
 // const referenceImageEl = document.getElementById("videoApiReferenceImageEnabled");
  const characterNameEl = document.getElementById("videoApiCharacterName");
  const autoPollEl = document.getElementById("videoApiAutoPollEnabled");
  const pollIntervalEl = document.getElementById("videoApiPollIntervalMs");

  if (modeEl) modeEl.value = settings.mode;
  if (modelEl) modelEl.value = settings.model;
  if (sizeEl) sizeEl.value = settings.size;
  if (secondsEl) secondsEl.value = settings.seconds;
 // if (promptPrefixEl) promptPrefixEl.value = settings.promptPrefix;
 // if (enabledEl) enabledEl.checked = !!settings.enabled;
 // if (referenceImageEl) referenceImageEl.checked = !!settings.referenceImageEnabled;
  if (characterNameEl) {
    characterNameEl.value = String(settings.characterName || "");
  }
  if (autoPollEl) autoPollEl.checked = !!settings.autoPollEnabled;
  if (pollIntervalEl) pollIntervalEl.value = String(settings.pollIntervalMs);
updateVideoStartButtonLabel();

 // updateVideoApiStatusPill(!!settings.enabled);
}

function collectVideoApiSettingsFromUi() {
  const next = {
    mode: document.getElementById("videoApiMode")?.value || VIDEO_DEFAULT_SETTINGS.mode,
    model: document.getElementById("videoApiModel")?.value || VIDEO_DEFAULT_SETTINGS.model,
    size: document.getElementById("videoApiSize")?.value || VIDEO_DEFAULT_SETTINGS.size,
    seconds: document.getElementById("videoApiSeconds")?.value || VIDEO_DEFAULT_SETTINGS.seconds,
    characterName: String(
      document.getElementById("videoApiCharacterName")?.value || ""
    ).trim(),
    autoPollEnabled: !!document.getElementById("videoApiAutoPollEnabled")?.checked,
    pollIntervalMs: normalizeVideoPollInterval(
      Number(document.getElementById("videoApiPollIntervalMs")?.value || VIDEO_DEFAULT_SETTINGS.pollIntervalMs)
    )
  };

  normalizeVideoSettings(next);
  return next;
}

function getEffectiveVideoApiSettings(overrideOptions = {}) {
  const liveUiSettings = collectVideoApiSettingsFromUi();

  const next = {
    ...getVideoApiSettings(),
    ...liveUiSettings,
    ...(overrideOptions || {})
  };

  normalizeVideoSettings(next);
  return next;
}

function normalizeVideoPollInterval(value) {
  if (!Number.isFinite(value)) return VIDEO_DEFAULT_SETTINGS.pollIntervalMs;
  return Math.min(60000, Math.max(3000, Math.round(value)));
}

function normalizeVideoSettings(settings) {
  if (!settings || typeof settings !== "object") return settings;

  const allowedModels = [
    "sora-2",
    "sora-2-pro",
    "sora-2-2025-10-06",
    "sora-2-pro-2025-10-06",
    "sora-2-2025-12-08"
  ];

  const allowedModes = ["create", "edit", "extend", "character"];

  const allowedSizes = [
    "1280x720",
    "720x1280",
    "1792x1024",
    "1024x1792"
  ];

  const createSeconds = ["4", "8", "12"];
  const extendSeconds = ["4", "8", "12", "16", "20"];

  if (!allowedModes.includes(settings.mode)) {
    settings.mode = VIDEO_DEFAULT_SETTINGS.mode;
  }

  if (!allowedModels.includes(settings.model)) {
    settings.model = VIDEO_DEFAULT_SETTINGS.model;
  }

  settings.seconds = String(settings.seconds || VIDEO_DEFAULT_SETTINGS.seconds);

  if (settings.mode === "extend") {
    if (!extendSeconds.includes(settings.seconds)) {
      settings.seconds = "4";
    }
  } else {
    if (!createSeconds.includes(settings.seconds)) {
      settings.seconds = VIDEO_DEFAULT_SETTINGS.seconds;
    }
  }

  if (!allowedSizes.includes(settings.size)) {
    settings.size = VIDEO_DEFAULT_SETTINGS.size;
  }

  const sora2OnlySizes = new Set([
    "1280x720",
    "720x1280"
  ]);

  if (
    settings.model === "sora-2" ||
    settings.model === "sora-2-2025-10-06" ||
    settings.model === "sora-2-2025-12-08"
  ) {
    if (!sora2OnlySizes.has(settings.size)) {
      settings.size = "1280x720";
    }
  }
  settings.characterName = String(settings.characterName || "").trim().slice(0, 80);
  settings.pollIntervalMs = normalizeVideoPollInterval(settings.pollIntervalMs);

  return settings;
}

/* Neu */
function updateVideoSizeAvailability() {
  const modelEl = document.getElementById("videoApiModel");
  const sizeEl = document.getElementById("videoApiSize");
  const secondsEl = document.getElementById("videoApiSeconds");
  const modeEl = document.getElementById("videoApiMode");

  if (!modelEl || !sizeEl) return;

  const model = modelEl.value;
  const mode = modeEl?.value || "create";

  const sora2Restricted =
    model === "sora-2" ||
    model === "sora-2-2025-10-06" ||
    model === "sora-2-2025-12-08";

  const restrictedSizes = new Set([
    "1792x1024",
    "1024x1792",
    "1920x1080",
    "1080x1920"
  ]);

  [...sizeEl.options].forEach(option => {
    option.disabled =
      sora2Restricted && restrictedSizes.has(option.value);
  });

  if (sora2Restricted && restrictedSizes.has(sizeEl.value)) {
    sizeEl.value = "1280x720";
  }

  if (secondsEl) {
    const extendOnly = new Set(["16", "20"]);

    [...secondsEl.options].forEach(option => {
      option.disabled =
        mode !== "extend" && extendOnly.has(option.value);
    });

    if (mode !== "extend" && extendOnly.has(secondsEl.value)) {
      secondsEl.value = "4";
    }
  }

  updateVideoStartButtonLabel();
}
/* Helper Referenz / Quelldatei */
function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
/* Helper für gekürzte IDs */
function shortenMediaSourceId(value) {
  const id = String(value || "").trim();

  if (!id || id.length <= 18) return id;

  return `${id.slice(0, 10)}...${id.slice(-5)}`;
}
/* Helper für gekürzte IDs ENDE */
function getVideoAssetUiRefs() {
  return {
    input: document.getElementById("videoApiAssetInput"),
    pickBtn: document.getElementById("videoApiPickAssetBtn"),
    clearInlineBtn: document.getElementById("videoApiAssetClearInlineBtn"),
    info: document.getElementById("videoApiAssetInfo"),
    text: document.getElementById("videoApiAssetText")
  };
}

function getVideoAssetKind(file) {
  if (!file) return "unknown";
  if ((file.type || "").startsWith("image/")) return "image";
  if ((file.type || "").toLowerCase() === "video/mp4") return "video";
  return "unknown";
}

function updateVideoAssetInfoUi() {
  const { pickBtn, clearInlineBtn, info, text } = getVideoAssetUiRefs();
  if (!info || !text || !pickBtn || !clearInlineBtn) return;

  if (!videoApiSelectedAsset) {
    text.textContent = "Keine Datei ausgewählt.";
    info.classList.add("is-empty");
    clearInlineBtn.hidden = true;
    pickBtn.classList.remove("is-active");
    return;
  }

  const kind = getVideoAssetKind(videoApiSelectedAsset.file);

  let suffix = "";
  if (kind === "image") {
    suffix = " · Bildreferenz aktiv";
  } else if (kind === "video") {
    suffix = " · Für Character/Edit/Extend vorgesehen";
  }

  text.textContent =
    `${videoApiSelectedAsset.file.name} · ${videoApiSelectedAsset.file.type || "unbekannt"} · ${formatBytes(videoApiSelectedAsset.file.size)}${suffix}`;

  info.classList.remove("is-empty");
  clearInlineBtn.hidden = false;
  pickBtn.classList.add("is-active");
}

function clearSelectedVideoAsset() {
  const { input } = getVideoAssetUiRefs();

  videoApiSelectedAsset = null;

  if (input) {
    input.value = "";
  }

  updateVideoAssetInfoUi();
}

function setSelectedVideoAsset(file) {
  if (!file) {
    clearSelectedVideoAsset();
    return;
  }

  const kind = getVideoAssetKind(file);

  if (kind === "unknown") {
    throw new Error("Erlaubt sind nur Bilddateien oder MP4-Videos.");
  }

  videoApiSelectedAsset = {
    file,
    kind
  };

  updateVideoAssetInfoUi();
}

function getSelectedVideoAsset() {
  return videoApiSelectedAsset;
}
/* Helper Datei anhängen */
async function readFileAsDataUrl(file) {
  if (!file) {
    throw new Error("Datei fehlt.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:")) {
        reject(new Error("Ungültige Data-URL für Bildreferenz."));
        return;
      }
      resolve(result);
    };

    reader.onerror = () => {
      reject(reader.error || new Error("Datei konnte nicht gelesen werden."));
    };

    reader.readAsDataURL(file);
  });
}
/* Helper Datei anhängen ENDE */
function openVideoApiModal() {
  const overlay = document.getElementById("videoApiOverlay");
  if (!overlay) return;

  const settings = getVideoApiSettings();

  applyVideoApiSettingsToUi(settings);
  updateVideoSizeAvailability();
  updateVideoAssetInfoUi();

//selectedSourceVideoId = getLastCompletedVideoId();
//selectedCharacterId = getLastCharacterId();
selectedSourceVideoId = null;
selectedCharacterId = getLastCharacterId();
renderVideoSourceLists();

  overlay.hidden = false;
 // document.getElementById("videoApiMode")?.focus();
}

function closeVideoApiModal() {
  const overlay = document.getElementById("videoApiOverlay");
  if (!overlay) return;
  overlay.hidden = true;
}

/* =========================================================
   API CONFIG HELPERS
   ========================================================= */

function getVideoApiConfig() {
  if (typeof getApiConfig === "function") {
    return getApiConfig();
  }

  const browserKey = localStorage.getItem("apiKey");
  if (browserKey && browserKey.startsWith("sk-")) {
    return { mode: "api", apiKey: browserKey };
  }

  if (
    window.CONFIG &&
    typeof window.CONFIG.OPENAI_API_KEY === "string" &&
    window.CONFIG.OPENAI_API_KEY.startsWith("sk-")
  ) {
    return { mode: "api", apiKey: window.CONFIG.OPENAI_API_KEY };
  }

  return { mode: "demo", apiKey: null };
}

function getVideoApiHeaders(includeContentType = true) {
  const api = getVideoApiConfig();

  if (api.mode === "demo") {
    throw new Error("Video API ist im Demo-Modus nicht verfügbar.");
  }

  if (!api.apiKey) {
    throw new Error("Kein API-Key für die Video API verfügbar.");
  }

  const headers = {
    Authorization: `Bearer ${api.apiKey}`
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function buildVideoPrompt(userPrompt) {
  const basePrompt = String(userPrompt || "").trim();

  if (!basePrompt) {
    throw new Error("Video Prompt fehlt.");
  }

  return basePrompt;
}

function persistLastCompletedVideoId(videoId) {
  const value = String(videoId || "").trim();

  if (!value) {
    localStorage.removeItem(VIDEO_LAST_COMPLETED_ID_KEY);
    return;
  }

  localStorage.setItem(VIDEO_LAST_COMPLETED_ID_KEY, value);
}

function getLastCompletedVideoId() {
  return localStorage.getItem(VIDEO_LAST_COMPLETED_ID_KEY) || null;
}

function persistLastCharacterId(characterId) {
  const value = String(characterId || "").trim();

  if (!value) {
    localStorage.removeItem(VIDEO_LAST_CHARACTER_ID_KEY);
    return;
  }

  localStorage.setItem(VIDEO_LAST_CHARACTER_ID_KEY, value);
}

function getLastCharacterId() {
  return localStorage.getItem(VIDEO_LAST_CHARACTER_ID_KEY) || null;
}
/* Helper gespeicherte Video */
function readVideoSourceList(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVideoSourceList(storageKey, list) {
  localStorage.setItem(storageKey, JSON.stringify(Array.isArray(list) ? list : []));
}

function getSavedVideoSources() {
  return Array.isArray(sessionVideoSources) ? sessionVideoSources : [];
 // return readVideoSourceList(VIDEO_SAVED_VIDEOS_KEY);
}

function getSavedCharacterSources() {
  return readVideoSourceList(VIDEO_SAVED_CHARACTERS_KEY);
}

function upsertSavedVideoSource(item) {
  if (!item?.id) return;

  const next = getSavedVideoSources().filter(entry => entry?.id !== item.id);
  next.unshift({
    id: String(item.id),
    model: String(item.model || ""),
    size: String(item.size || ""),
    seconds: String(item.seconds || ""),
    createdAt: Date.now()
  });

 // writeVideoSourceList(VIDEO_SAVED_VIDEOS_KEY, next.slice(0, 12));
  sessionVideoSources = next.slice(0, 12);
}

function upsertSavedCharacterSource(item) {
  if (!item?.id) return;

  const next = getSavedCharacterSources().filter(entry => entry?.id !== item.id);
  next.unshift({
    id: String(item.id),
    name: String(item.name || "Character"),
    model: String(item.model || ""),
    size: String(item.size || ""),
    seconds: String(item.seconds || ""),
    createdAt: Date.now()
  });

  writeVideoSourceList(VIDEO_SAVED_CHARACTERS_KEY, next.slice(0, 12));
}

function deleteSavedVideoSource(videoId) {
  const id = String(videoId || "").trim();
  if (!id) return;

 /* writeVideoSourceList(
    VIDEO_SAVED_VIDEOS_KEY,
    getSavedVideoSources().filter(entry => entry?.id !== id)
  ); */
  sessionVideoSources = getSavedVideoSources().filter(entry => entry?.id !== id);

  if (selectedSourceVideoId === id) {
    selectedSourceVideoId = null;
  }

  if (getLastCompletedVideoId() === id) {
    persistLastCompletedVideoId(null);
  }
}

function deleteSavedCharacterSource(characterId) {
  const id = String(characterId || "").trim();
  if (!id) return;

  writeVideoSourceList(
    VIDEO_SAVED_CHARACTERS_KEY,
    getSavedCharacterSources().filter(entry => entry?.id !== id)
  );

  if (selectedCharacterId === id) {
    selectedCharacterId = null;
  }

  if (getLastCharacterId() === id) {
    persistLastCharacterId(null);
  }
}

function formatVideoSourceLabel(item) {
  if (!item?.id) return "Unbekannte Videoquelle";

  //const parts = [item.id];
  const parts = [shortenMediaSourceId(item.id)];

  if (item.model) parts.push(item.model);
  if (item.size) parts.push(item.size);
  if (item.seconds) parts.push(`${item.seconds}s`);

  return parts.join(" · ");
}

function formatCharacterSourceLabel(item) {
  if (!item?.id) return "Unbekannter Character";

//  const parts = [item.id];
  const parts = [shortenMediaSourceId(item.id)];
  if (item.name) parts.push(item.name);
  if (item.model) parts.push(item.model);
  if (item.size) parts.push(item.size);
  if (item.seconds) parts.push(`${item.seconds}s`);

  return parts.join(" · ");
}

function renderVideoSourceLists() {
  const videoBox = document.getElementById("videoApiSourceVideoBox");
  const characterBox = document.getElementById("videoApiCharacterBox");

  if (videoBox) {
    const videos = getSavedVideoSources();

    if (!videos.length) {
      videoBox.classList.add("is-empty");
      videoBox.textContent = "Keine gespeicherten Videos.";
    } else {
      videoBox.classList.remove("is-empty");
      videoBox.innerHTML = "";

      videos.forEach(item => {
        const row = document.createElement("div");
        row.className = "video-api-source-item";
        if (selectedSourceVideoId === item.id) {
          row.classList.add("is-active");
        }

        const text = document.createElement("div");
        text.className = "video-api-source-text";
        text.textContent = formatVideoSourceLabel(item);

        const actions = document.createElement("div");
        actions.className = "video-api-source-actions";

const useBtn = document.createElement("button");
useBtn.type = "button";
useBtn.className = "video-api-source-btn";
useBtn.textContent = selectedSourceVideoId === item.id ? "Aktiv" : "Verwenden";
useBtn.addEventListener("click", () => {
  if (selectedSourceVideoId === item.id) {
    selectedSourceVideoId = null;
    persistLastCompletedVideoId(null);
  } else {
    selectedSourceVideoId = item.id;
    persistLastCompletedVideoId(item.id);
  }
  renderVideoSourceLists();
});

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "video-api-source-btn";
        deleteBtn.textContent = "X";
        deleteBtn.title = "Videoquelle löschen";
        deleteBtn.addEventListener("click", () => {
          deleteSavedVideoSource(item.id);
          renderVideoSourceLists();
        });

        actions.appendChild(useBtn);
        actions.appendChild(deleteBtn);
        row.appendChild(text);
        row.appendChild(actions);
        videoBox.appendChild(row);
      });
    }
  }

  if (characterBox) {
    const characters = getSavedCharacterSources();

    if (!characters.length) {
      characterBox.classList.add("is-empty");
      characterBox.textContent = "Keine gespeicherten Characters.";
    } else {
      characterBox.classList.remove("is-empty");
      characterBox.innerHTML = "";

      characters.forEach(item => {
        const row = document.createElement("div");
        row.className = "video-api-source-item";
        if (selectedCharacterId === item.id) {
          row.classList.add("is-active");
        }

        const text = document.createElement("div");
        text.className = "video-api-source-text";
        text.textContent = formatCharacterSourceLabel(item);

        const actions = document.createElement("div");
        actions.className = "video-api-source-actions";

const useBtn = document.createElement("button");
useBtn.type = "button";
useBtn.className = "video-api-source-btn";
useBtn.textContent = selectedCharacterId === item.id ? "Aktiv" : "Verwenden";
useBtn.addEventListener("click", () => {
  if (selectedCharacterId === item.id) {
    selectedCharacterId = null;
    persistLastCharacterId(null);
  } else {
    selectedCharacterId = item.id;
    persistLastCharacterId(item.id);
  }
  renderVideoSourceLists();
});

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "video-api-source-btn";
        deleteBtn.textContent = "X";
        deleteBtn.title = "Character löschen";
        deleteBtn.addEventListener("click", () => {
          deleteSavedCharacterSource(item.id);
          renderVideoSourceLists();
        });

        actions.appendChild(useBtn);
        actions.appendChild(deleteBtn);
        row.appendChild(text);
        row.appendChild(actions);
        characterBox.appendChild(row);
      });
    }
  }
}

function getVideoUsageDescription(settings = {}, overrideOptions = {}) {
  if (settings.mode === "character") {
    return "Verwendet: Neues Character-Video";
  }

  if (settings.mode === "edit") {
    const videoId = resolveSourceVideoId(overrideOptions);
    return videoId ? `Verwendet: Video ${videoId}` : "Verwendet: Video ID fehlt";
  }

  if (settings.mode === "extend") {
    const videoId = resolveSourceVideoId(overrideOptions);
    return videoId ? `Verwendet: Video ${videoId}` : "Verwendet: Video ID fehlt";
  }

  const reusable = getReusableCharacterIds(overrideOptions);
  if (reusable.length) {
    const characters = getSavedCharacterSources();
    const active = characters.find(entry => entry.id === reusable[0]);
    return active?.name
      ? `Verwendet: Character ${active.name}`
      : `Verwendet: Character ${reusable[0]}`;
  }

  if (getSelectedVideoAsset()?.kind === "image") {
    return "Verwendet: Neues Video mit Bildreferenz";
  }

  return "Verwendet: Neues Video";
}

function showVideoApiError(error, fallbackMessage = "Video-Aktion fehlgeschlagen.") {
  updateVideoJobStatusUi({
    visible: true,
    status: "error",
    videoId: getCurrentVideoJobIdFromUi() || "–",
    progress: Number(
      (document.getElementById("videoApiJobProgressText")?.textContent || "0").replace("%", "")
    ),
    message: error?.message || fallbackMessage
  });
}
/* Helper gespeicherte Video ENDE */
function getCurrentVideoJobIdFromUi() {
  const raw = document.getElementById("videoApiJobIdText")?.textContent || "";
  const value = raw.trim();

  if (!value || value === "–") return null;
  return value;
}

function resolveSourceVideoId(overrideOptions = {}) {
  const explicitId = String(
    overrideOptions.sourceVideoId ||
    overrideOptions.videoId ||
    ""
  ).trim();

  if (explicitId) return explicitId;

  if (selectedSourceVideoId) {
    return selectedSourceVideoId;
  }

  return getCurrentVideoJobIdFromUi() || getLastCompletedVideoId() || null;
}

function buildCharacterNameFromPrompt(prompt) {
  const base = String(prompt || "").trim();

  if (!base) {
    return "Video Character";
  }

  return base.replace(/\s+/g, " ").slice(0, 80);
}

function getReusableCharacterIds(overrideOptions = {}) {
  const explicit = overrideOptions.characterId || overrideOptions.characterIds || null;

  if (Array.isArray(explicit)) {
    return explicit
      .map(id => String(id || "").trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  if (explicit) {
    const single = String(explicit).trim();
    return single ? [single] : [];
  }

  if (selectedCharacterId) {
    return [selectedCharacterId];
  }

  const lastId = getLastCharacterId();
  return lastId ? [lastId] : [];
}

async function buildVideoCreatePayload(userPrompt, overrideOptions = {}) {
  const settings = getEffectiveVideoApiSettings(overrideOptions);

  if (settings.mode !== "create") {
    throw new Error(
      `Dieser Builder unterstützt nur den Modus "create". Aktuell gewählt: "${settings.mode}".`
    );
  }

  const payload = {
    model: settings.model,
    prompt: buildVideoPrompt(userPrompt),
    size: settings.size,
    seconds: settings.seconds
  };

  const reusableCharacterIds = getReusableCharacterIds(overrideOptions);

  if (reusableCharacterIds.length) {
    payload.characters = reusableCharacterIds.map(id => ({ id }));
  }

  const selectedAsset = getSelectedVideoAsset();

  if (!selectedAsset?.file) {
    return payload;
  }

  if (selectedAsset.kind === "video") {
    throw new Error(
      'Im Modus "create" ist nur eine Bildreferenz erlaubt. Für MP4 nutze "character".'
    );
  }

  payload.input_reference = {
    image_url: await readFileAsDataUrl(selectedAsset.file)
  };

  return payload;
}

async function parseJsonSafe(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchVideoApiJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorBody = await parseJsonSafe(response);
    const message =
      errorBody?.error?.message ||
      errorBody?.message ||
      errorBody?.raw ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }

  return parseJsonSafe(response);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* =========================================================
   PHASE 1 CORE
   ========================================================= */
async function createVideoJob(userPrompt, overrideOptions = {}) {
  const payload = await buildVideoCreatePayload(userPrompt, overrideOptions);

  const data = await fetchVideoApiJson(
    "https://api.openai.com/v1/videos",
    {
      method: "POST",
      headers: getVideoApiHeaders(true),
      body: JSON.stringify(payload)
    }
  );

  if (!data?.id) {
    throw new Error("Video Job konnte nicht gestartet werden: keine Job-ID erhalten.");
  }

  return data;
}

async function createVideoEditJob(userPrompt, overrideOptions = {}) {
  const sourceVideoId = resolveSourceVideoId(overrideOptions);

  if (!sourceVideoId) {
    throw new Error(
      'Für "edit" wird eine vorhandene Video-ID benötigt. Erzeuge zuerst ein Video oder übergib sourceVideoId.'
    );
  }

  const payload = {
    prompt: buildVideoPrompt(userPrompt),
    video: { id: sourceVideoId }
  };

  return fetchVideoApiJson(
    "https://api.openai.com/v1/videos/edits",
    {
      method: "POST",
      headers: getVideoApiHeaders(true),
      body: JSON.stringify(payload)
    }
  );
}

async function createVideoExtensionJob(userPrompt, overrideOptions = {}) {
  const settings = {
    ...getVideoApiSettings(),
    ...(overrideOptions || {})
  };

  normalizeVideoSettings(settings);

  const sourceVideoId = resolveSourceVideoId(overrideOptions);

  if (!sourceVideoId) {
    throw new Error(
      'Für "extend" wird eine vorhandene Video-ID benötigt. Erzeuge zuerst ein Video oder übergib sourceVideoId.'
    );
  }

  const payload = {
    prompt: buildVideoPrompt(userPrompt),
    seconds: String(settings.seconds || "4"),
    video: { id: sourceVideoId }
  };

  return fetchVideoApiJson(
    "https://api.openai.com/v1/videos/extensions",
    {
      method: "POST",
      headers: getVideoApiHeaders(true),
      body: JSON.stringify(payload)
    }
  );
}

async function createVideoCharacter(userPrompt = "", overrideOptions = {}) {
  const settings = getEffectiveVideoApiSettings(overrideOptions);
  const selectedAsset = getSelectedVideoAsset();

  if (!selectedAsset?.file || selectedAsset.kind !== "video") {
    throw new Error('Für "character" muss eine MP4-Datei ausgewählt sein.');
  }

  const name = String(
    settings.characterName ||
    overrideOptions.characterName ||
    buildCharacterNameFromPrompt(userPrompt)
  ).trim();

  if (!name) {
    throw new Error("Character-Name fehlt.");
  }

  const form = new FormData();
  form.append("name", name);
  form.append("video", selectedAsset.file, selectedAsset.file.name || "character.mp4");

  const data = await fetchVideoApiJson(
    "https://api.openai.com/v1/videos/characters",
    {
      method: "POST",
      headers: getVideoApiHeaders(false),
      body: form
    }
  );

  if (!data?.id) {
    throw new Error("Character konnte nicht erstellt werden: keine Character-ID erhalten.");
  }

persistLastCharacterId(data.id);
selectedCharacterId = data.id;

upsertSavedCharacterSource({
  id: data.id,
  name,
  model: settings.model,
  size: settings.size,
  seconds: settings.seconds
});

renderVideoSourceLists();

return data;
}

async function getVideoCharacter(characterId) {
  const id = String(characterId || "").trim();

  if (!id) {
    throw new Error("characterId fehlt.");
  }

  return fetchVideoApiJson(
    `https://api.openai.com/v1/videos/characters/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: getVideoApiHeaders(false)
    }
  );
}

async function getVideoJobStatus(videoId) {
  if (!videoId) {
    throw new Error("videoId fehlt.");
  }

  const data = await fetchVideoApiJson(
    `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}`,
    {
      method: "GET",
      headers: getVideoApiHeaders(false)
    }
  );

  if (!data?.id) {
    throw new Error("Ungültige Status-Antwort der Video API.");
  }

  return data;
}

async function pollVideoUntilReady(videoId, options = {}) {
  if (!videoId) {
    throw new Error("videoId fehlt.");
  }

  const settings = getVideoApiSettings();

  const intervalMs = normalizeVideoPollInterval(
    Number(options.intervalMs || settings.pollIntervalMs || 10000)
  );

  const timeoutMs = Math.max(
    30000,
    Number(options.timeoutMs || 15 * 60 * 1000)
  );

  const onProgress =
    typeof options.onProgress === "function"
      ? options.onProgress
      : null;

  const abortRef = options.abortRef || { cancelled: false };
  const startedAt = Date.now();

  while (true) {
    if (abortRef.cancelled) {
      throw new Error("Video Polling wurde manuell gestoppt.");
    }

    const job = await getVideoJobStatus(videoId);
    const status = String(job.status || "").toLowerCase();
    const progress = Number(job.progress || 0);

    if (onProgress) {
      onProgress({
        id: job.id,
        status,
        progress,
        job
      });
    }

    if (status === "completed") {
      return job;
    }

    if (status === "failed" || status === "cancelled" || status === "expired") {
      const errorMessage =
        job?.error?.message ||
        `Video Job wurde mit Status "${status}" beendet.`;
      throw new Error(errorMessage);
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Video Job Polling Timeout.");
    }

    await sleep(intervalMs);
  }
}

async function downloadVideoResult(videoId) {
  if (!videoId) {
    throw new Error("videoId fehlt.");
  }

  const response = await fetch(
    `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}/content`,
    {
      method: "GET",
      headers: getVideoApiHeaders(false)
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Video Download fehlgeschlagen (HTTP ${response.status}).`);
  }

  const blob = await response.blob();

  if (!blob || blob.size === 0) {
    throw new Error("Leere Video-Datei erhalten.");
  }

  const objectUrl = URL.createObjectURL(blob);

  return {
    blob,
    objectUrl,
    filename: `${videoId}.mp4`
  };
}

async function createAndWaitForVideo(userPrompt, options = {}) {
  const created = await createVideoJob(userPrompt, options);

  const job = await pollVideoUntilReady(created.id, {
    intervalMs: options.intervalMs,
    timeoutMs: options.timeoutMs,
    onProgress: options.onProgress,
    abortRef: options.abortRef
  });

  return job;
}

/* =========================================================
   UI STATUS
   ========================================================= */

function getVideoTestUiRefs() {
return {
  startBtn: document.getElementById("videoApiStartTestBtn"),
  stopBtn: document.getElementById("videoApiStopPollingBtn"),
  promptEl: document.getElementById("videoApiTestPrompt"),
  jobBox: document.getElementById("videoApiJobStatus"),
  statusText: document.getElementById("videoApiJobStatusText"),
  idText: document.getElementById("videoApiJobIdText"),
  progressText: document.getElementById("videoApiJobProgressText"),
  sourceText: document.getElementById("videoApiJobSourceText"),
  messageText: document.getElementById("videoApiJobMessageText"),
  progressBar: document.getElementById("videoApiProgressBar"),
  previewWrap: document.getElementById("videoApiPreviewWrap"),
  previewVideo: document.getElementById("videoApiPreviewVideo"),
  downloadLink: document.getElementById("videoApiDownloadLink")
};
}

function resetVideoDownloadLink() {
  const {
    previewWrap,
    previewVideo,
    downloadLink
  } = getVideoTestUiRefs();

  if (previewVideo) {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();
  }

  if (previewWrap) {
    previewWrap.hidden = true;
  }

  if (currentVideoDownloadUrl) {
    URL.revokeObjectURL(currentVideoDownloadUrl);
    currentVideoDownloadUrl = null;
  }

  if (downloadLink) {
    downloadLink.hidden = true;
    downloadLink.removeAttribute("href");
    downloadLink.removeAttribute("download");
  }
}

function setVideoPreview(objectUrl) {
  const {
    previewWrap,
    previewVideo
  } = getVideoTestUiRefs();

  if (!previewWrap || !previewVideo || !objectUrl) return;

  previewVideo.src = objectUrl;
  previewWrap.hidden = false;
}

function setVideoTestBusy(isBusy) {
  const { startBtn, stopBtn } = getVideoTestUiRefs();

  if (startBtn) startBtn.disabled = !!isBusy;
  if (stopBtn) stopBtn.disabled = !isBusy;
}

function updateVideoJobStatusUi({
  visible = true,
  status = "–",
  videoId = "–",
  progress = 0,
  source = "–",
  message = "Bereit."
} = {}) {
  const {
    jobBox,
    statusText,
    idText,
    progressText,
    sourceText,
    messageText,
    progressBar
  } = getVideoTestUiRefs();

  if (jobBox) jobBox.hidden = !visible;
  if (statusText) statusText.textContent = status;
  if (idText) idText.textContent = videoId || "–";
  if (progressText) {
    progressText.textContent = `${Math.max(0, Math.min(100, Number(progress) || 0))}%`;
  }
  if (sourceText) sourceText.textContent = source || "–";
  if (messageText) messageText.textContent = message;

  if (progressBar) {
    progressBar.style.width = `${Math.max(0, Math.min(100, Number(progress) || 0))}%`;
  }
}

function setVideoDownloadLink(objectUrl, filename) {
  const { downloadLink } = getVideoTestUiRefs();
  if (!downloadLink) return;

  resetVideoDownloadLink();

  currentVideoDownloadUrl = objectUrl;

  setVideoPreview(objectUrl);

  downloadLink.href = objectUrl;
  downloadLink.download = filename || "video.mp4";
  downloadLink.hidden = false;
}

function stopVideoPolling() {
  videoApiPollingAbort.cancelled = true;
  setVideoTestBusy(false);
  updateVideoJobStatusUi({
    visible: true,
    status: "gestoppt",
    videoId: document.getElementById("videoApiJobIdText")?.textContent || "–",
    progress: Number(
      (document.getElementById("videoApiJobProgressText")?.textContent || "0").replace("%", "")
    ),
    message: "Polling wurde manuell gestoppt."
  });
}

/* =========================================================
   ACTION
   ========================================================= */
async function startVideoGenerationFromPrompt(prompt, overrideOptions = {}) {
  const settings = getEffectiveVideoApiSettings(overrideOptions);
  const finalPrompt = String(prompt || "").trim();

  if (settings.mode !== "character" && !finalPrompt) {
    throw new Error("Bitte zuerst einen Prompt eingeben.");
  }

  resetVideoDownloadLink();
  setVideoTestBusy(true);
  videoApiPollingAbort = { cancelled: false };

updateVideoJobStatusUi({
  visible: true,
  status: "starting",
  videoId: "–",
  progress: 0,
  source: getVideoUsageDescription(settings, overrideOptions),
  message: "Video-Aktion wird gestartet..."
});

  try {
    let result = null;

    if (settings.mode === "character") {
      const character = await createVideoCharacter(finalPrompt, settings);

updateVideoJobStatusUi({
  visible: true,
  status: "character_created",
  videoId: character.id,
  progress: 100,
  source: `Verwendet: Neues Character-Video`,
  message: `Character erstellt: ${character.name || character.id} · Wiederverwendbar über ${character.id}`
});

      setVideoTestBusy(false);

      return {
        type: "character",
        character
      };
    }

    let created = null;

    if (settings.mode === "edit") {
      created = await createVideoEditJob(finalPrompt, settings);
    } else if (settings.mode === "extend") {
      created = await createVideoExtensionJob(finalPrompt, settings);
    } else {
      created = await createVideoJob(finalPrompt, settings);
    }

updateVideoJobStatusUi({
  visible: true,
  status: String(created.status || "queued"),
  videoId: created.id,
  progress: Number(created.progress || 0),
  source: getVideoUsageDescription(settings, overrideOptions),
  message: `Video-Job gestartet (${settings.mode}). Warte auf Status-Updates...`
});

    const job = await pollVideoUntilReady(created.id, {
      intervalMs: settings.pollIntervalMs,
      timeoutMs: settings.timeoutMs,
      abortRef: videoApiPollingAbort,
      onProgress: ({ id, status, progress }) => {
        updateVideoJobStatusUi({
          visible: true,
          status,
          videoId: id,
          progress,
source: getVideoUsageDescription(settings, overrideOptions),
message: `Video wird verarbeitet (${status}).`
        });
      }
    });

    persistLastCompletedVideoId(job.id);

selectedSourceVideoId = job.id;

upsertSavedVideoSource({
  id: job.id,
  model: settings.model,
  size: settings.size,
  seconds: settings.seconds
});

renderVideoSourceLists();

/* Kosten */
if (typeof window.calculateVideoGenerationCostUSD === "function") {
  const videoCost = window.calculateVideoGenerationCostUSD({
    model: settings.model,
    size: settings.size,
    seconds: settings.seconds
  });

  if (
    Number.isFinite(videoCost) &&
    videoCost > 0 &&
    window.sessionUsage
  ) {
    window.sessionUsage.costUSD =
      Number(window.sessionUsage.costUSD || 0) + videoCost;

    if (!window.sessionUsage.byModel || typeof window.sessionUsage.byModel !== "object") {
      window.sessionUsage.byModel = {};
    }

    if (!window.sessionUsage.video || typeof window.sessionUsage.video !== "object") {
      window.sessionUsage.video = {
        calls: 0,
        costUSD: 0
      };
    }

    const videoModelKey = String(settings.model || "").toLowerCase();

    if (!window.sessionUsage.byModel[videoModelKey]) {
      window.sessionUsage.byModel[videoModelKey] = {
        calls: 0,
        costUSD: 0
      };
    }

    window.sessionUsage.byModel[videoModelKey].calls += 1;
    window.sessionUsage.byModel[videoModelKey].costUSD += videoCost;

    window.sessionUsage.video.calls += 1;
    window.sessionUsage.video.costUSD += videoCost;

    if (typeof updateCostFooter === "function") {
      updateCostFooter();
    }

    if (typeof window.renderModelManager === "function") {
      window.renderModelManager();
    }
  }
}
/* Kosten ENDE */

updateVideoJobStatusUi({
  visible: true,
  status: String(job.status || "completed"),
  videoId: job.id,
  progress: 100,
  source: getVideoUsageDescription(settings, overrideOptions),
  message: "Video ist fertig. MP4 wird geladen..."
});

    const downloaded = await downloadVideoResult(job.id);

    setVideoDownloadLink(downloaded.objectUrl, downloaded.filename);

updateVideoJobStatusUi({
  visible: true,
  status: "completed",
  videoId: job.id,
  progress: 100,
  source: getVideoUsageDescription(settings, overrideOptions),
  message:
    window.lastVideoCost > 0
      ? `Video erfolgreich erzeugt. Download ist bereit. Kosten: $ ${window.lastVideoCost.toFixed(6)}`
      : "Video erfolgreich erzeugt. Download ist bereit."
});

    setVideoTestBusy(false);

    result = {
      type: settings.mode,
      created,
      job,
      downloaded
    };

    return result;
  } catch (err) {
    setVideoTestBusy(false);

updateVideoJobStatusUi({
  visible: true,
  status: "error",
  videoId: getCurrentVideoJobIdFromUi() || "–",
  progress: Number(
    (document.getElementById("videoApiJobProgressText")?.textContent || "0").replace("%", "")
  ),
  source: getVideoUsageDescription(settings, overrideOptions),
  message: err?.message || String(err)
});

    throw err;
  }
}

/* =========================================================
   UI BINDING
   ========================================================= */

function bindVideoApiUi() {
  const overlay = document.getElementById("videoApiOverlay");
  const openBtn = document.getElementById("videoGenBtn");
  const saveBtn = document.getElementById("videoApiSaveBtn");
  const closeBtn = document.getElementById("videoApiCloseBtn");
const footerCloseBtn = document.getElementById("videoApiFooterCloseBtn");
  const resetBtn = document.getElementById("videoApiResetBtn");
const modelEl = document.getElementById("videoApiModel");
const assetInput = document.getElementById("videoApiAssetInput");
const pickAssetBtn = document.getElementById("videoApiPickAssetBtn");
const clearAssetInlineBtn = document.getElementById("videoApiAssetClearInlineBtn");
const startTestBtn = document.getElementById("videoApiStartTestBtn");
const stopPollingBtn = document.getElementById("videoApiStopPollingBtn");
const modeEl = document.getElementById("videoApiMode");

if (modeEl && modeEl.dataset.videoApiBound !== "true") {
  modeEl.dataset.videoApiBound = "true";
  modeEl.addEventListener("change", () => {
    const liveSettings = collectVideoApiSettingsFromUi();
    saveVideoApiSettings(liveSettings);
    updateVideoSizeAvailability();
    updateVideoAssetInfoUi();
    updateVideoStartButtonLabel();
  });
}

  if (openBtn && openBtn.dataset.videoApiBound !== "true") {
    openBtn.dataset.videoApiBound = "true";
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openVideoApiModal();
    });
  }

if (saveBtn && saveBtn.dataset.videoApiBound !== "true") {
  saveBtn.dataset.videoApiBound = "true";
  saveBtn.addEventListener("click", () => {
    const settings = collectVideoApiSettingsFromUi();
    saveVideoApiSettings(settings);
    applyVideoApiSettingsToUi(settings);
    updateVideoSizeAvailability();
  });
}

  if (closeBtn && closeBtn.dataset.videoApiBound !== "true") {
    closeBtn.dataset.videoApiBound = "true";
    closeBtn.addEventListener("click", closeVideoApiModal);
  }

if (footerCloseBtn && footerCloseBtn.dataset.videoApiBound !== "true") {
  footerCloseBtn.dataset.videoApiBound = "true";
  footerCloseBtn.addEventListener("click", closeVideoApiModal);
}

  if (resetBtn && resetBtn.dataset.videoApiBound !== "true") {
    resetBtn.dataset.videoApiBound = "true";
    resetBtn.addEventListener("click", () => {
      saveVideoApiSettings(VIDEO_DEFAULT_SETTINGS);
      applyVideoApiSettingsToUi(VIDEO_DEFAULT_SETTINGS);
      updateVideoJobStatusUi({
        visible: false,
        status: "–",
        videoId: "–",
        progress: 0,
        message: "Bereit."
      });
      resetVideoDownloadLink();
      setVideoTestBusy(false);
clearSelectedVideoAsset();
selectedSourceVideoId = null;
selectedCharacterId = null;
applyVideoApiSettingsToUi(VIDEO_DEFAULT_SETTINGS);
updateVideoSizeAvailability();
renderVideoSourceLists();
    });
  }

if (modelEl && modelEl.dataset.videoApiBound !== "true") {
  modelEl.dataset.videoApiBound = "true";
  modelEl.addEventListener("change", () => {
    updateVideoSizeAvailability();
    updateVideoStartButtonLabel();
  });
}
/* Referenz / Quelldatei */
if (pickAssetBtn && pickAssetBtn.dataset.videoApiBound !== "true") {
  pickAssetBtn.dataset.videoApiBound = "true";
  pickAssetBtn.addEventListener("click", () => {
    assetInput?.click();
  });
}

if (clearAssetInlineBtn && clearAssetInlineBtn.dataset.videoApiBound !== "true") {
  clearAssetInlineBtn.dataset.videoApiBound = "true";
  clearAssetInlineBtn.addEventListener("click", clearSelectedVideoAsset);
}

if (assetInput && assetInput.dataset.videoApiBound !== "true") {
  assetInput.dataset.videoApiBound = "true";
  assetInput.addEventListener("change", () => {
    const file = assetInput.files?.[0] || null;

    try {
      setSelectedVideoAsset(file);
    } catch (err) {
      clearSelectedVideoAsset();
      updateVideoJobStatusUi({
        visible: true,
        status: "error",
        videoId: "–",
        progress: 0,
message: `Dateifehler: ${err?.message || String(err)}`
      });
    }
  });
}
/* Referenz / Quelldatei ENDE */
if (startTestBtn && startTestBtn.dataset.videoApiBound !== "true") {
  startTestBtn.dataset.videoApiBound = "true";
  startTestBtn.addEventListener("click", async () => {
    const prompt = document.getElementById("videoApiTestPrompt")?.value || "";

    try {
      await startVideoGenerationFromPrompt(prompt);
    } catch (err) {
      showVideoApiError(err, "Video fehlgeschlagen.");
    }
  });
}

  if (stopPollingBtn && stopPollingBtn.dataset.videoApiBound !== "true") {
    stopPollingBtn.dataset.videoApiBound = "true";
    stopPollingBtn.addEventListener("click", stopVideoPolling);
  }

if (overlay && overlay.dataset.videoApiBound !== "true") {
  overlay.dataset.videoApiBound = "true";
}

document.addEventListener("keydown", (e) => {
  const isOpen = overlay && overlay.hidden === false;
  if (!isOpen) return;

  if (e.key === "Escape") {
    e.preventDefault();
    document.getElementById("videoApiFooterCloseBtn")?.click();
    return;
  }

  if (e.key === "Enter") {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const isTextarea = tag === "textarea";
    const isButton = tag === "button";

    if (isTextarea || isButton) return;

    e.preventDefault();
    document.getElementById("videoApiSaveBtn")?.click();
  }
});

  updateVideoApiButtonState();
  setVideoTestBusy(false);
}

/* =========================================================
   PUBLIC API
   ========================================================= */

window.getVideoApiSettings = getVideoApiSettings;
window.isVideoApiEnabled = isVideoApiEnabled;
window.openVideoApiModal = openVideoApiModal;

window.videoApi = {
  getSettings: getVideoApiSettings,
  saveSettings: saveVideoApiSettings,
  isEnabled: isVideoApiEnabled,
  buildPrompt: buildVideoPrompt,

  getSelectedAsset: getSelectedVideoAsset,
  clearSelectedAsset: clearSelectedVideoAsset,
  getLastCompletedVideoId,
  getLastCharacterId,
  getReusableCharacterIds,
  resolveSourceVideoId,

  getSavedVideoSources,
  getSavedCharacterSources,
  deleteSavedVideoSource,
  deleteSavedCharacterSource,
  renderVideoSourceLists,

  createVideoJob,

  createVideoEditJob,
  createVideoExtensionJob,
  createVideoCharacter,
  getVideoCharacter,

  getVideoJobStatus,
  pollVideoUntilReady,
  downloadVideoResult,
  createAndWaitForVideo,
  readFileAsDataUrl,
  startVideoGenerationFromPrompt,
  stopVideoPolling,
  updateVideoJobStatusUi
};

document.addEventListener("DOMContentLoaded", () => {
  window.videoApiSettings = getVideoApiSettings();
  bindVideoApiUi();
  applyVideoApiSettingsToUi(window.videoApiSettings);
  updateVideoSizeAvailability();
updateVideoAssetInfoUi();
updateVideoStartButtonLabel();
//selectedSourceVideoId = getLastCompletedVideoId();
//selectedCharacterId = getLastCharacterId();
selectedSourceVideoId = null;
selectedCharacterId = getLastCharacterId();
sessionVideoSources = [];
renderVideoSourceLists();
  updateVideoApiButtonState();
updateVideoJobStatusUi({
  visible: false,
  status: "–",
  videoId: "–",
  progress: 0,
  source: "–",
  message: "Bereit."
});
});
