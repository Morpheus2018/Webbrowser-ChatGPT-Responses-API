/* =========================================================
   IMAGE CACHE (IndexedDB)
   ========================================================= */
const IMAGE_DB_NAME = "chat_image_cache";
const IMAGE_STORE = "images";

let __imageDBPromise = null;

async function requireImageDB() {
  const db = await openImageDB();

  if (!db) {
    __imageDBPromise = null;
    throw new Error("IndexedDB nicht verfügbar");
  }

  return db;
}

function openImageDB() {

  if (__imageDBPromise) return __imageDBPromise;

  __imageDBPromise = new Promise((resolve, reject) => {

    const request = indexedDB.open(IMAGE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        db.close();
        __imageDBPromise = null;
      };

      resolve(db);
    };

    request.onerror = () => {
      __imageDBPromise = null;
      reject(request.error);
    };
  });

  return __imageDBPromise;
}

async function saveImageToDB(id, base64) {
  const db = await requireImageDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB tx aborted"));

    tx.objectStore(IMAGE_STORE).put(base64, id);
  });
}

async function getImageFromDB(id) {
  const db = await requireImageDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readonly");
    const store = tx.objectStore(IMAGE_STORE);
    const req = store.get(id);

    let result = null;

    req.onsuccess = () => {
      result = req.result || null;
    };

    req.onerror = () => {
      reject(req.error || new Error("IndexedDB read failed"));
    };

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB tx error"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB tx aborted"));
  });
}
/* Bild Löschen im Chat */
async function deleteImageFromDB(id) {
  const db = await requireImageDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB tx aborted"));

    tx.objectStore(IMAGE_STORE).delete(id);
  });
}
/* Helper IndexedDB Char leeren */
async function clearImageCache() {
  const db = await requireImageDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);

    store.clear();

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB clear failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB clear aborted"));
  });
}

const messages = document.getElementById('messages');
const inputSection = document.getElementById('inputSection');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');

const tokensInEl = document.getElementById('tokensIn');
const tokensOutEl = document.getElementById('tokensOut');
const tokensTotalEl = document.getElementById('tokensTotal');
const costEl = document.getElementById('costUSD');

const STORAGE_KEY = 'chat_history_v1';
const MODEL_KEY = 'selected_model';
const DEFAULT_MODEL = 'gpt-4o-mini';

const LAST_RESPONSE_ID_KEY = 'last_response_id_v1';

const GREETING_VARIANTS = [
  '👋 Hallo! Ich bin ChatGPT. Wie kann ich Ihnen helfen?',
  '👋 Willkommen! Was kann ich heute für Sie tun?',
  '👋 Schön, Sie zu sehen! Wie kann ich behilflich sein?'
];

function getGreetingText() {
  // Greeting für diese Session merken (stabil)
  let saved = sessionStorage.getItem('activeGreeting');

  if (saved && GREETING_VARIANTS.includes(saved)) {
    return saved;
  }

  // zufällig wählen
  const random = GREETING_VARIANTS[
    Math.floor(Math.random() * GREETING_VARIANTS.length)
  ];

  sessionStorage.setItem('activeGreeting', random);

  return random;
}

const STREAM_KEY = 'stream_enabled';

function isStreamEnabled() {
  const saved = localStorage.getItem(STREAM_KEY);
  return saved === null ? true : saved === 'true'; // default = AN
}

function setStreamEnabled(state) {
  localStorage.setItem(STREAM_KEY, state ? 'true' : 'false');
}

/* =========================================================
   Usage Persist (dauerhaft bis Reset)
   ========================================================= */
const USAGE_KEY = 'usage_persist_v1';

function persistUsage() {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(window.sessionUsage));
  } catch {}
}

function restoreUsage() {
  const saved = localStorage.getItem(USAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(window.sessionUsage, parsed);

    // Safety für alte Daten
    if (!window.sessionUsage.byModel || typeof window.sessionUsage.byModel !== 'object') {
      window.sessionUsage.byModel = {};
    }
    // Image Tool Aufrufe
    if (!window.sessionUsage.imageTool || typeof window.sessionUsage.imageTool !== 'object') {
      window.sessionUsage.imageTool = { calls: 0, costUSD: 0 };
    }
// Video API Aufrufe
if (!window.sessionUsage.video || typeof window.sessionUsage.video !== 'object') {
  window.sessionUsage.video = { calls: 0, costUSD: 0 };
}
  } catch {}
}

/* =========================================================
   Token Usage – Session Counter (GLOBAL, damit Model-Manager es sieht)
   ========================================================= */
window.sessionUsage = {
  input: 0,
  output: 0,
  total: 0,
  calls: 0,
  costUSD: 0,
  byModel: {}, // pro Modell: { calls, costUSD }
  imageTool: {      // /v1/responses -> tool:image_generation
    calls: 0,
    costUSD: 0
  }
};
/* =========================================================
   Conversation Memory Persist Chat Gedächtnis
   ========================================================= */
window.lastResponseId = localStorage.getItem(LAST_RESPONSE_ID_KEY) || null;

function persistLastResponseId(id) {
  window.lastResponseId = id || null;

  if (window.lastResponseId) {
    localStorage.setItem(LAST_RESPONSE_ID_KEY, window.lastResponseId);
  } else {
    localStorage.removeItem(LAST_RESPONSE_ID_KEY);
  }
}
/* =========================================================
   Initial Load
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  /* Confirm Modal sicher verstecken */
  const overlay = document.getElementById('confirmOverlay');
  if (overlay) overlay.hidden = true;

  /* Model laden */
  if (typeof modelSelect !== 'undefined' && modelSelect) {
    const savedModel = localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
    modelSelect.value = savedModel;

    // 🔥 WICHTIG: Model-Manager informieren
    modelSelect.dispatchEvent(new Event('change'));
  }

  /* Chat laden */
  const saved = localStorage.getItem(STORAGE_KEY);
  messages.innerHTML = '';

  let hasRealMessages = false;

  if (saved) {
    try {
      const history = JSON.parse(saved);

      if (Array.isArray(history) && history.length) {

        history.forEach(m => {
          /* Normale Nachricht */
          addMessage(m.role, m.text, false, m.timestamp);

const lastMsg = messages.lastElementChild;
const bubble = lastMsg?.querySelector(".bubble");

if (bubble && m.timestamp) {
  createMessageTimestamp(bubble, m.timestamp);
}

          /* =====================================================
            Bild wiederherstellen (Image Persist FIX)
            ===================================================== */

          if (m.imageId) {

            const lastMsg = messages.lastElementChild;
            const bubble = lastMsg?.querySelector('.bubble');

            if (!bubble) return;

            getImageFromDB(m.imageId).then(imageData => {

              if (!imageData) return;

              const img = document.createElement("img");
              img.src = imageData;
              img.className = "generated-image";

if (m.imageId)
  img.dataset.imageId = m.imageId;

              bubble.appendChild(img);

              const saveBtn = document.createElement("button");
              saveBtn.className = "img-save-btn";
              saveBtn.dataset.imageId = m.imageId;
              saveBtn.innerHTML = `<i class="fas fa-download"></i> Speichern`;
              /* saveBtn.title = "Im IndexedDB Speicher sichern"; */
              saveBtn.title = "Bereits im IndexedDB gespeichert";

              saveBtn.addEventListener("click", () => {

                const a = document.createElement("a");
                a.href = imageData;
                a.download = `image-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

              });

              bubble.appendChild(saveBtn);
							/* ==============================
								 DELETE BUTTON (Restore)
							============================== */
							const deleteBtn = document.createElement("button");
							deleteBtn.className = "img-delete-btn";
							deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Löschen`;
              deleteBtn.title = "Aus IndexedDB löschen";
							deleteBtn.addEventListener("click", async () => {

								try {

									const id = img.dataset.imageId;

									if (id) {
										await deleteImageFromDB(id);
									}
								/*	const messageEl = img.closest(".message");
									messageEl?.remove(); */

								/* lastMsg.remove(); */ //ALT
                  suppressAutoScroll = true;

                  bubble.innerHTML = "🗑️ Bild wurde gelöscht.";
                  saveHistory?.();

                  /* kleine Verzögerung → danach Scroll wieder erlauben */
                  setTimeout(() => {
                    suppressAutoScroll = false;
                  }, 50);

								}
								catch (err) {

									addMessage?.(
										"bot",
										"❌ Bild konnte nicht gelöscht werden: " + (err?.message || err)
									);
								}

							});

							bubble.appendChild(deleteBtn);
              attachImageExpandFeature(img, bubble);
/* Restore DALL·E Cost Button */
if (m.imageCostDall != null) {

  img.dataset.imageCostDall = m.imageCostDall;

  if (typeof attachImageCostButton === "function") {
    attachImageCostButton(
      bubble,
      Number(m.imageCostDall)
    );
  }
}
/* Restore Responses Image Tool Cost Button */
if (m.imageToolCost != null) {
  img.dataset.imageToolCost = m.imageToolCost;
}

if (m.imageToolCostLog != null) {
  img.dataset.imageToolCostLog = m.imageToolCostLog;
}

if (
  (m.imageToolCost != null || m.imageToolCostLog != null) &&
  typeof attachResponseImageCostButton === "function"
) {
  attachResponseImageCostButton(img, bubble);
}
              /* Usage Button Restore */
              if (m.imageUsage && m.imageCost) {
                try {

                  img.dataset.imageUsage = m.imageUsage;
                  img.dataset.imageCost = String(m.imageCost);

                  /* Cost Log wiederherstellen */
                  if (m.imageCostLog) {
                    img.dataset.imageCostLog = m.imageCostLog;
                  }

                  if (typeof attachImageUsageButton === 'function') {
                    attachImageUsageButton(
                      img,
                      bubble,
                      JSON.parse(m.imageUsage),
                      Number(m.imageCost)
                    );
                  }

                } catch {}
              }

              img.addEventListener('load', scrollToBottom, { once: true });

            });

          }
          /* Real Message detection bleibt unverändert */
          if (!GREETING_VARIANTS.includes(m.text)) {
            hasRealMessages = true;
          }
        });
      }

    } catch {}
  }

  /* Wenn kein Verlauf oder nur Begrüßung → Begrüßung neu setzen */
  if (!messages.children.length) {
    addMessage('bot', getGreetingText(), false);
  }

  /* Input Position korrekt setzen */
  if (hasRealMessages) {
    moveInputBottom();
  } else {
    moveInputCenter();
  }

  /* Initialen API-Status setzen */
  syncStatusWithApiConfig();

  /* Persistenten Verbrauch laden (bleibt bis Reset) */
  restoreUsage();
  updateTokenFooter();
  updateCostFooter();

  if (typeof window.renderModelManager === 'function') {
    window.renderModelManager();
  }

  /* =====================================================
    SCROLL RESTORE (nach History + Image Restore)
    ===================================================== */
  scrollToBottom();

  document.querySelectorAll('#messages img').forEach(img => {
    if (!img.complete) {
      img.addEventListener('load', scrollToBottom, { once: true });
    }
  });

  setTimeout(scrollToBottom, 50);
  setTimeout(scrollToBottom, 200);

  /* ======= Token Counter Verstecken ======= */
  const counter = document.querySelector(".token-counter.footer-accent-btn");

  if (!counter) return;

  counter.addEventListener("click", (e) => {
    e.stopPropagation();
    counter.classList.toggle("is-expanded");
  });

});

/* =========================================================
   Message Handling
   ========================================================= */
function addMessage(role, content, save = true, timestamp = null) {
  const message = document.createElement("div");
  message.className = `message ${role}`;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = role === "user" ? "U" : "AI";

const bubble = document.createElement("div");
bubble.className = "bubble";
bubble.dataset.rawText = content || "";
/*
bubble.textContent = content;
*/
if (typeof renderFormattedContent === "function") {
  renderFormattedContent(bubble, content);
} else {
  bubble.textContent = content;
}
/* Timestamp erzeugen */
createMessageTimestamp(bubble, timestamp);

const isRealTextMessage =
  typeof content === "string" &&
  content.trim() !== "";

/* Layout nur für echte Text-Bubbles */
if ((role === "user" || role === "bot") && isRealTextMessage) {
  bubble.classList.add("text-bubble");
}

/* Delete Button nur für echte Text-Bubbles */
if ((role === "user" || role === "bot") && isRealTextMessage) {
  attachBubbleDeleteButton(bubble);
}
  message.appendChild(label);
  message.appendChild(bubble);

  messages.appendChild(message);

  scrollToBottom();

  /* =====================================================
     Input nur verschieben wenn es NICHT die Begrüßung ist
     ===================================================== */
  const isGreeting =
    role === 'bot' &&
    GREETING_VARIANTS.includes((content || '').trim());

  if (!isGreeting && inputSection.classList.contains('input-center')) {
    moveInputBottom();
  }

  if (save) saveHistory();
}
let suppressAutoScroll = false;

function scrollToBottom() {

  if (suppressAutoScroll) return;

  messages.parentElement.scrollTop =
    messages.parentElement.scrollHeight;
}

/* =========================================================
   Typing Indicator Bubble mit animierten Punktens
   ========================================================= */

let typingIndicatorEl = null;

function addTypingIndicator() {

  if (typingIndicatorEl) return;

  const message = document.createElement("div");
  message.className = "message bot typing";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";

  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;

  bubble.appendChild(indicator);
  message.appendChild(label);
  message.appendChild(bubble);
  messages.appendChild(message);
  typingIndicatorEl = message;
  scrollToBottom();
}

function removeTypingIndicator() {

  if (!typingIndicatorEl) return;

  typingIndicatorEl.remove();
  typingIndicatorEl = null;
}

/* =========================================================
   Cost Footer Update
   ========================================================= */
function updateCostFooter() {
  if (!costEl) return;

  // 6 Nachkommastellen, sonst oft 0.0000
  costEl.textContent = (window.sessionUsage.costUSD || 0).toFixed(6);
  // dauerhaft sichern
  persistUsage();
}

/* =========================================================
   Token Footer Update
   ========================================================= */
function updateTokenFooter() {
  if (!tokensInEl || !tokensOutEl || !tokensTotalEl) return;

  tokensInEl.textContent = (window.sessionUsage.input || 0).toLocaleString();
  tokensOutEl.textContent = (window.sessionUsage.output || 0).toLocaleString();
  tokensTotalEl.textContent = (window.sessionUsage.total || 0).toLocaleString();

  // dauerhaft sichern
  persistUsage();
}

/* =========================================================
   Input State
   ========================================================= */
function moveInputBottom() {
  inputSection.classList.remove('input-center');
  inputSection.classList.add('input-bottom');
}

function moveInputCenter() {
  inputSection.classList.remove('input-bottom');
  inputSection.classList.add('input-center');
}

/* =========================================================
   Storage (Chat Verlauf)
   Unterstützt Text + Images IndexedDB
   ========================================================= */
function saveHistory() {

  const history = [...messages.children]
    .filter(m => m.dataset.deleted !== "true")
    .map(m => {

      const bubble = m.querySelector('.bubble');
      if (!bubble) {
        return {
          role: m.classList.contains('user') ? 'user' : 'bot',
          text: '',
          imageId: null
        };
      }

    const img = bubble.querySelector('img');
    const saveBtn = bubble.querySelector('.img-save-btn');
    const timeEl = bubble.querySelector(".bubble-time");

    // ✅ ID kann am img ODER am Save-Button hängen
    const imageId =
      img?.dataset?.imageId ||
      saveBtn?.dataset?.imageId ||
      null;

    const imageUsage =
      img?.dataset?.imageUsage || null;

const imageCost =
  img?.dataset?.imageCost ?? null;

const imageCostLog =
  img?.dataset?.imageCostLog ?? null;

const imageCostDall =
  img?.dataset?.imageCostDall ?? null;

const imageToolCost =
  img?.dataset?.imageToolCost ?? null;

const imageToolCostLog =
  img?.dataset?.imageToolCostLog ?? null;

    // ✅ Wenn Bild vorhanden -> KEIN textContent speichern (Buttons würden sonst Text reinziehen)
    if (img) {
      return {
        role: m.classList.contains('user') ? 'user' : 'bot',
        text: '',
timestamp: timeEl?.dataset.timestamp || null,
        imageId,
        imageUsage,
        imageCost,
        imageCostLog,
        imageCostDall,
        imageToolCost,
        imageToolCostLog
      };
    }

    // ✅ Normale Textnachricht

      return {
        role: m.classList.contains('user') ? 'user' : 'bot',
        text: bubble.dataset.rawText || bubble.textContent || "",
        timestamp: timeEl?.dataset.timestamp || null,
        imageId: null
      };
    });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn("History speichern fehlgeschlagen:", err);
  }
}

/* =========================================================
   API Healthcheck UI
   ========================================================= */
function setApiStatus(state) {
  const statusEl = document.getElementById('status');
  const textEl = statusEl.querySelector('.api-text');
  const iconEl = statusEl.querySelector('i');

  statusEl.classList.remove('api-idle', 'api-online', 'api-error');

  if (state === 'online') {
    statusEl.classList.add('api-online');
    iconEl.className = 'fas fa-check-circle';
    textEl.textContent = 'API: Online';
  }
  else if (state === 'error') {
    statusEl.classList.add('api-error');
    iconEl.className = 'fas fa-exclamation-circle';
    textEl.textContent = 'API: Fehler';
  }
  else {
    statusEl.classList.add('api-idle');

    if (statusEl.classList.contains('api-demo')) {
      iconEl.className = 'fas fa-play-circle';
      textEl.textContent = 'Demo-Modus';
    } else {
      iconEl.className = 'fas fa-clock';
      textEl.textContent = 'API: Bereit';
    }
  }
}

/* =========================================================
   Status-Sync mit API-Konfiguration
   ========================================================= */
function syncStatusWithApiConfig() {
  if (typeof getApiConfig !== 'function') return;

  const api = getApiConfig();
  status.classList.remove('api-demo');

  // Tooltip: Quelle/Modus anzeigen (nicht Modell!)
  const source = localStorage.getItem('apiSource') || 'Unbekannt';
  if (api.mode === 'demo') {
    status.title = 'Modus: Demo-Modus';
    status.classList.add('api-demo');
    setApiStatus('idle');
  } else {
    // Browser oder config.js
    status.title = `Modus: ${source}`;
    setApiStatus('idle');
  }
}

/* 🔑 Reagiere sofort auf Modus-Wechsel */
window.addEventListener('api-mode-changed', () => {
  syncStatusWithApiConfig();
});

/* =========================================================
   Textarea
   ========================================================= */
function resizeTextarea() {
  userInput.style.height = 'auto';
  const maxHeight = parseFloat(getComputedStyle(userInput).maxHeight);

  if (userInput.scrollHeight > maxHeight) {
    userInput.style.height = maxHeight + 'px';
    userInput.style.overflowY = 'auto';
  } else {
    userInput.style.height = userInput.scrollHeight + 'px';
    userInput.style.overflowY = 'hidden';
  }
}

/* =========================================================
   Events
   ========================================================= */

sendBtn.onclick = async () => {

  const text = userInput.value.trim();

  if (!text) return;
  /* USER MESSAGE ANZEIGEN */
  addMessage('user', text);
  /* INPUT RESET */
  userInput.value = '';
  resizeTextarea();
  moveInputBottom();
  try {

    /* =====================================================
       IMAGE ENGINE PRIORITY CHECK
       ===================================================== */
    if (typeof window.generateSelectedImage === "function") {

      const handled =
        await window.generateSelectedImage(text);

      /* Wenn Image Engine die Anfrage verarbeitet hat → STOP */
      if (handled === true) {
        setApiStatus('online');
        return;
      }
      /* Demo mode → Status korrekt lassen */
      if (handled === "demo") {
        syncStatusWithApiConfig();
        return;
      }
    }
    /* Image GPT Status */
    if (typeof window.generateImageGPT === "function") {

      const handled =
        await window.generateImageGPT(text);

      if (handled === true) {
        setApiStatus('online');
        return;
      }

      if (handled === "demo") {
        syncStatusWithApiConfig();
        return;
      }
    }

    /* =====================================================
       NORMAL RESPONSES API FALLBACK
       ===================================================== */
    await callResponsesAPI(text);

  }

catch (err) {
  removeTypingIndicator();
  console.error(err);
  setApiStatus('error');

  /* Fehler für Image GPT Tool */
  if (
    typeof handleImageToolApiError === 'function' &&
    handleImageToolApiError(err)
  ) {
    return;
  }

  addMessage('bot', '❌ Fehler: ' + (err?.message || err));
}
};

/* =========================================================
   ENTER KEY SUPPORT
   ========================================================= */
userInput.addEventListener('input',resizeTextarea);
userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  }
);

/* =========================================================
   Custom Confirm Modal
   ========================================================= */
function customConfirm(message, options = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirmOverlay');
    const okBtn = document.getElementById('confirmOkBtn');
	const defaultOkText = 'Ja, XXXX';
	okBtn.textContent = options.okText || defaultOkText;

    const cancelBtn = document.getElementById('confirmCancelBtn');
    const textEl = overlay.querySelector('.modal-text');
    const extraBtn = document.getElementById('confirmExtraBtn');
    const titleTextEl = document.getElementById('confirmTitleText');
    const iconEl = document.querySelector('#confirmTitle i');
    const defaultTitle = 'Chatverlauf löschen js';
    const defaultIcon = 'fas fa-trash';

    /* ---------- Titel & Icon setzen ---------- */
    if (titleTextEl) {
      titleTextEl.textContent = options.title || defaultTitle;
    }

    if (iconEl) {
      iconEl.className = options.icon || defaultIcon;
    }

	/* ---------- Extra Button Handling ---------- */
	if (extraBtn) {
	  if (options.extraText) {
		extraBtn.hidden = false;
		extraBtn.textContent = options.extraText;
	  } else {
		extraBtn.hidden = true;
	  }
	}

    /* ---------- Text setzen ---------- */
    textEl.textContent = message;
    overlay.hidden = false;

    const cleanup = (result) => {
      overlay.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      if (extraBtn) extraBtn.removeEventListener('click', onExtra); // 🔥 NEU
      overlay.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);

      /* Titel & Icon zurücksetzen */
      if (titleTextEl) titleTextEl.textContent = defaultTitle;
      if (iconEl) iconEl.className = defaultIcon;
      okBtn.textContent = defaultOkText; // 🔥 wichtig

      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
	const onExtra = () => cleanup('extra');   // NEU

    const onBackdrop = (e) => {
      if (e.target === overlay) onCancel();
    };

    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        e.preventDefault();
        onOk();
      }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
	if (extraBtn && options.extraText) {
	  extraBtn.addEventListener('click', onExtra);
	}
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);

    okBtn.focus();
  });
}

/* =========================================================
   Clear Chat
   ========================================================= */
clearBtn.onclick = async () => {
  // ✅ Löschen erlauben, wenn es irgendeine Nachricht gibt, die NICHT die Begrüßung ist
  const hasAnythingToClear =
    [...messages.querySelectorAll('.message .bubble')]
      .some(b => !GREETING_VARIANTS.includes((b.textContent || '').trim()));

  if (!hasAnythingToClear) return;

  const ok = await customConfirm(
    'Wirklich den gesamten Chatverlauf löschen?',
    {
      title: 'Chatverlauf löschen',
      icon: 'fas fa-trash',
      okText: 'Ja, löschen'
    }
  );

  if (!ok) return;
  /* ---- Chat History löschen --------- */
  localStorage.removeItem(STORAGE_KEY);
  window.clearImageToolResponseContext?.();
  messages.innerHTML = '';

	persistLastResponseId(null); /* Chat Gedächtnis löschen */
  /* ------ Image Cache (IndexedDB) löschen ----------- */
  try {
    await clearImageCache();
  } catch (err) {
    addMessage?.('bot', '⚠️ Image Cache konnte nicht vollständig gelöscht werden.');
  }
  /* ------ Begrüßung wiederherstellen ------- */
  addMessage('bot', getGreetingText(), false);

  moveInputCenter();
  resizeTextarea();
  scrollToBottom();
};

/* =========================================================
   Theme
   ========================================================= */
const themeBtn = document.getElementById("pageThemeToggle");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = themeBtn.querySelector("i");
  icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
}

const savedTheme = localStorage.getItem("theme") || "dark";
applyTheme(savedTheme);

themeBtn.onclick = () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("theme", next);
};

if (typeof modelSelect !== 'undefined' && modelSelect) {
  modelSelect.addEventListener('change', () => {
    const model = modelSelect.value;
    localStorage.setItem(MODEL_KEY, model);
    if (typeof updateModelActiveState === 'function') {
      updateModelActiveState(model);
    }
  });
}

/* =========================================================
   Responses API (GENERIC TOOL TRACKING VERSION)
   Unterstützt automatisch:
   - Tokens
   - web_search
   - file_search
   - image_generation
   - alle zukünftigen Tools
   - Stream + Non-Stream
   - Demo Mode
   ========================================================= */

async function callResponsesAPI(userText) {
  const streamEnabled = isStreamEnabled();
  const api = getApiConfig();
  addTypingIndicator();

  /* =====================================================
     DEMO MODE
     ===================================================== */
  if (api.mode === 'demo') {

    await fakeDelay(300 + Math.random() * 700);
    removeTypingIndicator();
    const demoText = generateDemoResponse(userText);
    addMessage('bot', demoText);
    syncStatusWithApiConfig();
    saveHistory();
    return demoText;
  }

  if (!api.apiKey) throw new Error('Kein API-Key verfügbar');

  /* =====================================================
     INITIAL SETUP
     ===================================================== */
  const selectedModel = modelSelect?.value || 'gpt-4o-mini';
  const tools =
    window.getActiveTools
      ? window.getActiveTools()
      : [];
let toolChoice = undefined;

if (window.activeTools?.image_generation) {
  toolChoice = { type: "image_generation" };
}
  const extraInputs =
    window.getPendingInputs
      ? window.getPendingInputs()
      : [];

  const imageToolContext =
    typeof window.getImageToolResponseContext === "function"
      ? window.getImageToolResponseContext()
      : { previousResponseId: null, hasImageContext: false };

  const shouldAttachPreviousResponseId =
    window.activeTools?.image_generation === true &&
    !!imageToolContext.previousResponseId;

  const requestBody = {
    model: selectedModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          ...extraInputs
        ]
      }
    ],

    tools,
    tool_choice: toolChoice,
    stream: streamEnabled,
    max_output_tokens: window.responseSettings?.max_output_tokens ?? 4000,
    temperature: window.responseSettings?.temperature ?? 1,
    top_p: window.responseSettings?.top_p ?? 1,
    parallel_tool_calls: window.responseSettings?.parallel_tool_calls ?? true
  };
/* =====================================================
   Conversation chaining 
   ===================================================== */
if (shouldAttachPreviousResponseId) {
  requestBody.previous_response_id =
    imageToolContext.previousResponseId;
} else if (window.lastResponseId) {
  requestBody.previous_response_id =
    window.lastResponseId;
}

/* action */
  const currentImageAction =
    window.imageGenToolSettings?.action || "auto";

  if (
    window.activeTools?.image_generation === true &&
    currentImageAction === "edit" &&
    !requestBody.previous_response_id
  ) {
    removeTypingIndicator();
    addMessage(
      "bot",
      "⚠️ Bearbeiten benötigt vorhandenen Bildkontext. Verwende zuerst Auto oder Generieren, damit eine Bild-Response-ID entsteht."
    );
    return;
  }

  const response = await fetch(
    'https://api.openai.com/v1/responses',
    {
      method: 'POST',

      headers: {
        'Authorization': `Bearer ${api.apiKey}`,
        'Content-Type': 'application/json'
      },

      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok)
    throw new Error(await response.text());

  /* =====================================================
     GENERIC TOOL USAGE TRACKER
     ===================================================== */
  const toolUsage = {};

  function trackTool(toolName, extra = {}) {

    if (!toolUsage[toolName])
      toolUsage[toolName] = { calls: 0 };

    toolUsage[toolName].calls++;

    /* Image quality tracking */
    if (toolName === 'image_generation_call') {

      const quality =
        extra.quality || 'low'; /* medium */

      if (!toolUsage[toolName][quality])
        toolUsage[toolName][quality] = 0;

      toolUsage[toolName][quality]++;
    }
  }

  let usage = null;
  let fullText = '';

  /* =====================================================
     NON-STREAM MODE
     ===================================================== */
  if (!streamEnabled) {
    const data = await response.json();

if (data?.id) {
  persistLastResponseId(data.id);
}

    /* action */
    if (data?.id) {
      window.imageToolLastResponseId = data.id;
      if (typeof persistImageToolResponseContext === "function") {
        persistImageToolResponseContext();
      }
    }

/* 🔥 Image Tool Usage extrahieren */

window.lastImageAPIUsage = null;

if (Array.isArray(data.output)) {

  for (const item of data.output) {

    if (item?.type === "image_generation_call") {

      window.lastImageAPIUsage =
        item.usage || null;

      break;
    }
  }
}
    removeTypingIndicator();

    fullText = extractTextFromResponse(data);
    addMessage('bot', fullText);
appendResponseImagesToLastBubble(data);
    usage = data.usage || null;

    /* Generic tool detection */
    if (Array.isArray(data.output)) {

      for (const item of data.output) {

        if (!item?.type)
          continue;

        if (item.type.endsWith('_call')) {

          trackTool(item.type, {
            quality: item.quality
          });
        }
      }
    }
  }

  /* =====================================================
     STREAM MODE
     ===================================================== */

  else {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
/* Bot Message vorbereiten (Stream Bubble mit stabilem Inhalt) */

removeTypingIndicator(); // falls vorhanden (Non-Stream Fallback)

const message = document.createElement("div");
message.className = "message bot";

const label = document.createElement("div");
label.className = "label";
label.textContent = "AI";

const bubble = document.createElement("div");
bubble.className = "bubble";

const indicator = document.createElement("div");
indicator.className = "typing-indicator";
indicator.innerHTML = `
  <div class="typing-dot"></div>
  <div class="typing-dot"></div>
  <div class="typing-dot"></div>
`;

const textContentEl = document.createElement("div");
textContentEl.className = "stream-text-content";
textContentEl.hidden = true;

bubble.appendChild(indicator);
bubble.appendChild(textContentEl);

message.appendChild(label);
message.appendChild(bubble);
messages.appendChild(message);

scrollToBottom();

/* Flag: ob schon Text angekommen ist */
let firstDeltaReceived = false;

let liveImagePreviewEl = null;
let liveImagePreviewCallId = null;

    let buffer = '';

    while (true) {

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode( value, { stream: true } );
      // SSE kann CRLF liefern → vereinheitlichen
      buffer = buffer.replace(/\r\n/g, '\n');

      let boundary;

      while ((boundary = buffer.indexOf('\n\n')) !== -1) {

        const frame = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);

        if (!frame) continue;

        const dataLines = frame
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim());

        if (!dataLines.length) continue;

        const jsonStr = dataLines.join('\n');

        if (!jsonStr || jsonStr === '[DONE]') continue;

        let event;

        try {
          event = JSON.parse(jsonStr);
        }
        catch {
          continue;
        }
        /* Text streaming */
if (event.type === 'response.output_text.delta') {

  const delta = event.delta || '';

  /* Beim ersten Text → Indicator sauber ausblenden */
  if (!firstDeltaReceived) {
    indicator.remove();
    textContentEl.hidden = false;
    firstDeltaReceived = true;
  }

  fullText += delta;
  bubble.dataset.rawText = fullText;
  /*
  textContentEl.textContent = fullText;
*/
if (typeof renderFormattedContent === "function") {
  renderFormattedContent(textContentEl, fullText);
} else {
  textContentEl.textContent = fullText;
}
  scrollToBottom();
}
/* stream live verhalten */
if (event.type === 'response.image_generation_call.partial_image') {

  if (indicator.parentNode) {
    indicator.remove();
  }

  if (
    typeof upsertPartialResponseImagePreview === "function"
  ) {
    liveImagePreviewEl = upsertPartialResponseImagePreview({
      bubble,
      imageEl: liveImagePreviewEl,
      callId: event.item_id || event.output_index || "image_generation_call",
      imageBase64: event.partial_image_b64
    });

    liveImagePreviewCallId =
      event.item_id || event.output_index || "image_generation_call";
  }

  scrollToBottom();
}
        /* Generic tool detection */
        if (
          event.type?.startsWith('response.') &&
          event.type?.endsWith('.completed')
        ) {

          const toolName =
            event.type
              .replace('response.', '')
              .replace('.completed', '');

          trackTool(
            toolName,
            event.image_generation_call
          );
        }
        /* Image rendering */
        /* Usage detection */
if (
  event.type === 'response.completed' ||
  event.type === 'response.incomplete'
) {

if (event.response?.id) {
  persistLastResponseId(event.response.id);
}

  if (event.response?.id) {
    window.imageToolLastResponseId = event.response.id;
    if (typeof persistImageToolResponseContext === "function") {
      persistImageToolResponseContext();
    }
  }

  window.lastImageAPIUsage = null;

  const out = event.response?.output;

  if (Array.isArray(out)) {
    for (const item of out) {
      if (item?.type === "image_generation_call") {
        window.lastImageAPIUsage =
          item.usage || null;
        break;
      }
    }
  }

  usage = event.response?.usage || null;

  if (typeof removePartialResponseImagePreview === "function") {
    removePartialResponseImagePreview(bubble, liveImagePreviewCallId);
    liveImagePreviewEl = null;
    liveImagePreviewCallId = null;
  }

  const hasRenderableImage =
    Array.isArray(out) && out.some(item =>
      item?.type === "image_generation_call" &&
      (item?.result || item?.image_base64 || item?.b64_json || item?.image?.b64_json)
    );

  if (hasRenderableImage) {
    appendResponseImagesToLastBubble(event.response);
  }

  if (
    event.type === 'response.incomplete' &&
    event.response?.incomplete_details?.reason
  ) {
    const reason = event.response.incomplete_details.reason;

    const msg =
      `⚠️ Antwort wurde vorzeitig beendet (${reason}). Das Bild wurde bereits erzeugt.`;

    addMessage('bot', msg);
  }
}
      }
    }
    /* Stream beendet → Indicator endgültig entfernen */
    if (indicator.parentNode) {
      indicator.remove();
    }

    /* Falls kein Text kam → leeren Container anzeigen */
    if (!firstDeltaReceived) {
      textContentEl.hidden = false;
    }

    /* Stream Text & Delete Button */
    if (fullText.trim() && !bubble.querySelector("img")) {
      bubble.classList.add("text-bubble");
      attachBubbleDeleteButton(bubble);
      createMessageTimestamp(bubble);
    }

  }
    /* =====================================================
      TOKEN + COST UPDATE
      ===================================================== */

    if (usage) {

      /* ---------- TEXT MODEL USAGE (Responses API) ---------- */

      const inputTokens  = usage.input_tokens  || 0;
      const outputTokens = usage.output_tokens || 0;
      const totalTokens  = usage.total_tokens  || 0;
      const cachedTokens = usage.input_cached_tokens || 0;

      /* =====================================================
        IMAGE MODEL USAGE (Images API)
        Erwartet: window.lastImageAPIUsage
        ===================================================== */

      const imgUsage = window.lastImageAPIUsage;

      let inputTextTokens  = 0;  // gpt-image-1 text input
      let outputImageTokens = 0; // gpt-image-1 image output
      let outputTextTokens  = 0; // selten vorhanden

      if (imgUsage && typeof imgUsage === "object") {

        /* ===== IMAGE INPUT ===== */

        inputTextTokens =
          imgUsage?.input_tokens_details?.text_tokens ??
          imgUsage?.input_text_tokens ??
          0;

        /* ===== IMAGE OUTPUT ===== */

        outputImageTokens =
          imgUsage?.output_tokens_details?.image_tokens ??
          imgUsage?.output_text_tokens ??
          0;

        outputTextTokens =
          imgUsage?.output_tokens_details?.text_tokens ??
          imgUsage?.output_text_tokens ??
          0;

      }

      /* =====================================================
        SESSION COUNTER UPDATE (TEXT MODEL)
        ===================================================== */

      window.sessionUsage.input  += inputTokens;
      window.sessionUsage.output += outputTokens;
      window.sessionUsage.total  += totalTokens;
      window.sessionUsage.calls++;

      updateTokenFooter();

      /* =====================================================
        COST CALCULATION
        ===================================================== */

      if (typeof calculateCostUSD === 'function') {

        const cost = calculateCostUSD({

          model: selectedModel,

          /* TEXT MODEL */
          inputTokens,
          outputTokens,
          cachedInputTokens: cachedTokens,

          /* IMAGE MODEL */
          inputTextTokens,
          outputTextTokens,
          outputImageTokens,

          toolUsage
        });

        window.sessionUsage.costUSD += cost;

        const modelKey =
          normalizeModelName(selectedModel) ||
          selectedModel;

        if (!window.sessionUsage.byModel[modelKey]) {
          window.sessionUsage.byModel[modelKey] = {
            calls: 0,
            costUSD: 0
          };
        }

        window.sessionUsage.byModel[modelKey].calls++;
        window.sessionUsage.byModel[modelKey].costUSD += cost;

        updateCostFooter();

        if (typeof window.renderModelManager === 'function') {
          window.renderModelManager();
        }
      }
    }

    setApiStatus('online');
    saveHistory();
    return fullText;
}
/* =========================================================
   Reset Session (Tokens + Kosten)
   ========================================================= */
const resetSessionBtn = document.getElementById('resetSessionBtn');

if (resetSessionBtn) {
  resetSessionBtn.addEventListener('click', async () => {

    const ok = await customConfirm(
      'Den gesamten Verbrauch wirklich zurücksetzen?',
      {
        title: 'Verbrauch zurücksetzen',
        icon: 'fas fa-rotate-left',
        okText: 'Ja, zurücksetzen'
      }
    );

    if (!ok) return;

    // Session-Daten zurücksetzen
    window.sessionUsage.input = 0;
    window.sessionUsage.output = 0;
    window.sessionUsage.total = 0;
    window.sessionUsage.calls = 0;
    window.sessionUsage.costUSD = 0;
    window.sessionUsage.byModel = {};
		window.sessionUsage.image = {
			calls: 0,
			costUSD: 0
		};
    window.sessionUsage.imageGPT = {
      calls: 0,
      costUSD: 0
    };
    window.sessionUsage.imageTool = {
      calls: 0,
      costUSD: 0
    };
window.sessionUsage.video = {
  calls: 0,
  costUSD: 0
};

    window.clearImageToolResponseContext?.();
		// persistLastResponseId(null);  /* Chat Gedächtnis löschen */
    // Persistenten Verbrauch löschen
    localStorage.removeItem(USAGE_KEY);

    // UI aktualisieren
    updateTokenFooter();
		updateCostFooter();

	if (typeof window.renderModelManager === 'function') {
	  window.renderModelManager();
	}

    // Kurzes Feedback
    resetSessionBtn.title = 'Session zurückgesetzt ✔';
    setTimeout(() => {
      resetSessionBtn.title = 'Token & Kosten zurücksetzen';
    }, 1500);
  });
}
/* =========================================================
   API CONFIG
   ========================================================= */
function getApiConfig() {
  const modeLabel = localStorage.getItem('apiMode');
  const source = localStorage.getItem('apiSource');

  if (modeLabel === 'Demo-Modus') {
    return { mode: 'demo', apiKey: null };
  }

  if (source === 'Browser') {
    const key = localStorage.getItem('apiKey');
    return { mode: 'api', apiKey: key && key.startsWith('sk-') ? key : null };
  }

  if (source === 'config.js') {
    if (
      window.CONFIG &&
      typeof window.CONFIG.OPENAI_API_KEY === 'string' &&
      window.CONFIG.OPENAI_API_KEY.startsWith('sk-')
    ) {
      return { mode: 'api', apiKey: window.CONFIG.OPENAI_API_KEY };
    }
    return { mode: 'api', apiKey: null };
  }

  return { mode: 'demo', apiKey: null };
}

function fakeDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractTextFromResponse(data) {
  let result = '';
  if (!Array.isArray(data.output)) return '';

  for (const item of data.output) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block?.type === 'output_text' || block?.type === 'text') {
          result += block.text || '';
        }
      }
    }
    // Fallback falls API anders liefert
    if (item.type === 'output_text' && item.text) {
      result += item.text;
    }
  }
  return result.trim();
}

