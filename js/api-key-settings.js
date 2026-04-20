const modal = document.getElementById("apiKeyModal");

const infoMode = document.getElementById("infoMode");
const infoSource = document.getElementById("infoSource");
const infoKey = document.getElementById("infoKey");
const infoKeyRow = document.getElementById("infoKeyRow");

const demoInfo = document.getElementById("demoInfo");
const apiLocal = document.getElementById("apiKeyLocalSection");
const configSection = document.getElementById("configSection");

const apiInput = document.getElementById("apiKeyInput");

let tempMode = null;

/* =========================================================
   UI Dialog Helpers (Alert / Confirm) – im Site-Design
   ========================================================= */
const uiDialog = {
  overlay: document.getElementById('uiDialogOverlay'),
  title: document.getElementById('uiDialogTitle'),
  icon: document.getElementById('uiDialogIcon'),
  message: document.getElementById('uiDialogMessage'),
  actions: document.getElementById('uiDialogActions'),
  closeBtn: document.getElementById('uiDialogCloseBtn')
};

function _ensureDialog() {
  if (!uiDialog.overlay) {
    throw new Error('uiDialogOverlay fehlt in index.html');
  }
}

function _openDialog() {
  uiDialog.overlay.hidden = false;
  // Fokus auf Close oder ersten Button
  setTimeout(() => {
    const firstBtn = uiDialog.actions.querySelector('button');
    (firstBtn || uiDialog.closeBtn)?.focus?.();
  }, 0);
}

function _closeDialog() {
  uiDialog.overlay.hidden = true;
  uiDialog.actions.innerHTML = '';
}

function uiAlert(message, opts = {}) {
  _ensureDialog();
  const title = opts.title || 'Hinweis';
  const icon = opts.icon || 'fas fa-info-circle';
  const okText = opts.okText || 'OK';

  uiDialog.title.innerHTML = `<i id="uiDialogIcon" class="${icon}"></i> ${title}`;
  uiDialog.message.textContent = message;

  uiDialog.actions.innerHTML = '';
  const okBtn = document.createElement('button');
  okBtn.className = 'btn primary';
  okBtn.textContent = okText;
  okBtn.addEventListener('click', _closeDialog);
  uiDialog.actions.appendChild(okBtn);

  const onKey = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      _closeDialog();
      cleanup();
    }
  };

  const onBackdrop = (e) => {
    if (e.target === uiDialog.overlay) {
      _closeDialog();
      cleanup();
    }
  };

  const onClose = () => {
    _closeDialog();
    cleanup();
  };

  function cleanup() {
    document.removeEventListener('keydown', onKey);
    uiDialog.overlay.removeEventListener('click', onBackdrop);
    uiDialog.closeBtn.removeEventListener('click', onClose);
  }

  document.addEventListener('keydown', onKey);
  uiDialog.overlay.addEventListener('click', onBackdrop);
  uiDialog.closeBtn.addEventListener('click', onClose);

  _openDialog();
}

function uiConfirm(message, opts = {}) {
  _ensureDialog();
  const title = opts.title || 'Bestätigung';
  const icon = opts.icon || 'fas fa-question-circle';
  const okText = opts.okText || 'Ja, löschen';
  const cancelText = opts.cancelText || 'Abbrechen';
  const okClass = opts.okClass || 'danger';

  uiDialog.title.innerHTML = `<i id="uiDialogIcon" class="${icon}"></i> ${title}`;
  uiDialog.message.textContent = message;

  return new Promise((resolve) => {
    uiDialog.actions.innerHTML = '';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = cancelText;

    const okBtn = document.createElement('button');
    okBtn.className = `btn ${okClass}`;
    okBtn.textContent = okText;

    const finish = (val) => {
      _closeDialog();
      cleanup();
      resolve(val);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      }
    };

    const onBackdrop = (e) => {
      if (e.target === uiDialog.overlay) finish(false);
    };

    cancelBtn.addEventListener('click', () => finish(false));
    okBtn.addEventListener('click', () => finish(true));
    uiDialog.closeBtn.addEventListener('click', () => finish(false));

    document.addEventListener('keydown', onKey);
    uiDialog.overlay.addEventListener('click', onBackdrop);

    function cleanup() {
      document.removeEventListener('keydown', onKey);
      uiDialog.overlay.removeEventListener('click', onBackdrop);
      uiDialog.closeBtn.replaceWith(uiDialog.closeBtn.cloneNode(true));
      // ^ einfacher Reset für click handler, danach Referenz neu holen:
      uiDialog.closeBtn = document.getElementById('uiDialogCloseBtn');
    }

    uiDialog.actions.appendChild(cancelBtn);
    uiDialog.actions.appendChild(okBtn);

    _openDialog();
  });
}


/* =========================================================
   Event Bridge → informiert script.js über Modus-Änderung
   ========================================================= */
function notifyApiModeChanged() {
  window.dispatchEvent(new CustomEvent('api-mode-changed'));
}

/* =========================================================
   Gemeinsame API-Quelle (aus script.js)
   ========================================================= */
function readActiveApiConfig() {
  if (typeof getApiConfig !== "function") {
    return { mode: "demo", apiKey: null };
  }
  return getApiConfig();
}

/* =========================================================
   Modal Open / Close
   ========================================================= */
const statusBtn = document.getElementById("status");
const closeBtn = document.getElementById("apiKeyCloseBtn");

function openModal() {
  modal.hidden = false;
	// gespeicherten API-Key ins Input laden
	const storedKey = localStorage.getItem("apiKey");
	if (storedKey && apiInput) {
		apiInput.value = storedKey;
	}
  updateInfo();

  const source = localStorage.getItem("apiSource");
  const defaultMode =
    source === "Browser" ? "local" :
    source === "config.js" ? "config" :
    source === "Demo-Modus" ? "demo" :
    "demo";

  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === defaultMode);
  });

  tempMode = defaultMode;
  demoInfo.hidden = tempMode !== "demo";
  apiLocal.hidden = tempMode !== "local";
  configSection.hidden = tempMode !== "config";
}

function closeModal() {
  modal.hidden = true;
}

if (statusBtn) {
  statusBtn.style.cursor = "pointer";
  statusBtn.setAttribute("role", "button");
  statusBtn.setAttribute("tabindex", "0");

  statusBtn.addEventListener("click", openModal);
  statusBtn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal();
    }
  });
}

if (closeBtn) closeBtn.addEventListener("click", closeModal);

modal.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});

document.addEventListener("keydown", e => {
  if (!modal.hidden && e.key === "Escape") closeModal();
});

/* =========================================================
   Helpers
   ========================================================= */
function maskKey(key) {
  return key ? key.slice(0, 7) + "…" + key.slice(-4) : "";
}

/* =========================================================
   STATUS-INFO Anzeige
   ========================================================= */
function updateInfo() {
  const api = readActiveApiConfig();

  if (api.mode === "demo") {
    infoMode.textContent = "Demo-Modus";
    infoSource.textContent = "Demo-Modus";
    infoKeyRow.hidden = true;
    return;
  }

  infoMode.textContent = "API-Modus";

  if (window.CONFIG && api.apiKey === window.CONFIG.OPENAI_API_KEY) {
    infoSource.textContent = "config.js";
  } else {
    infoSource.textContent = "Browser";
  }

  if (api.apiKey) {
    infoKey.textContent = maskKey(api.apiKey);
    infoKeyRow.hidden = false;
  } else {
    infoKeyRow.hidden = true;
  }
}

/* =========================================================
   Mode Selection (UI only)
   ========================================================= */
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    tempMode = btn.dataset.mode;
    demoInfo.hidden = tempMode !== "demo";
    apiLocal.hidden = tempMode !== "local";
    configSection.hidden = tempMode !== "config";
  });
});

/* =========================================================
   Demo Mode
   ========================================================= */
document.getElementById("activateDemoBtn").onclick = () => {
  localStorage.setItem("apiMode", "Demo-Modus");
  localStorage.setItem("apiSource", "Demo-Modus");
  // localStorage.removeItem("apiKey");

  updateInfo();
  notifyApiModeChanged();
  closeModal();
  focusUserInput(50);
};

/* =========================================================
   Browser API-Key
   ========================================================= */
document.getElementById("saveKeyBtn").onclick = () => {
  const key = apiInput.value.trim();
  if (!key) return uiAlert("⚠️ Kein API-Key eingegeben!", { title: "Fehler !", icon: "fas fa-exclamation-circle" });

  localStorage.setItem("apiKey", key);
  localStorage.setItem("apiMode", "API-Modus");
  localStorage.setItem("apiSource", "Browser");

  updateInfo();
  notifyApiModeChanged();
  closeModal();
  focusUserInput(50);
};

document.getElementById("deleteKeyBtn").onclick = async () => {
  if (!localStorage.getItem("apiKey")) return;

  const ok = await uiConfirm("⚠️ Gespeicherten API-Schlüssel wirklich löschen?", {
    title: "API-Key löschen",
    icon: "fas fa-trash",
    okText: "Ja, löschen",
    cancelText: "Abbrechen",
    okClass: "danger"
  });
  if (!ok) return;
 
  localStorage.removeItem("apiKey");

	if (apiInput) apiInput.value = "";

  updateInfo();
  notifyApiModeChanged();
  uiAlert("✅ API-Schlüssel wurde gelöscht!", { title: "Erledigt", icon: "fas fa-check-circle" });
};
/* ALTE EINSTELLUNG 
document.getElementById("toggleKeyBtn").onclick = () => {
  const icon = document.querySelector('#toggleKeyBtn i');

  if (apiInput.type === "password") {
    apiInput.type = "text";
    icon.className = "fas fa-eye-slash";
  } else {
    apiInput.type = "password";
    icon.className = "fas fa-eye";
  }
}; */
const toggleBtn = document.getElementById("toggleKeyBtn");
const icon = toggleBtn.querySelector("i");

// Tooltip beim Laden korrekt setzen
document.addEventListener("DOMContentLoaded", () => {
  toggleBtn.title =
    apiInput.type === "password" ? "Anzeigen" : "Verbergen";
});

// Click-Handler
toggleBtn.onclick = () => {
  const isHidden = apiInput.type === "password";

  apiInput.type = isHidden ? "text" : "password";
  icon.className = isHidden ? "fas fa-eye-slash" : "fas fa-eye";
  toggleBtn.title = isHidden ? "Verbergen" : "Anzeigen";
};

document.getElementById("testKeyBtn").onclick = async () => {
  const key = apiInput.value.trim();
  if (!key) return uiAlert("⚠️ Kein API-Key eingegeben!", { title: "Fehler !", icon: "fas fa-exclamation-circle" });

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` }
    });

    if (res.ok) {
      uiAlert("🎉 API-Schlüssel ist gültig und funktioniert!", { title: "Test erfolgreich !", icon: "fas fa-check-circle" });
    } else {
      uiAlert("❌ API-Schlüssel ist ungültig, gesperrt oder hat keine Berechtigung.", { title: "Test fehlgeschlagen !", icon: "fas fa-exclamation-circle" });
    }
  } catch {
    uiAlert("❌ API-Test fehlgeschlagen!", { title: "Netzwerkfehler", icon: "fas fa-wifi" });
  }
};

/* =========================================================
   Config.js Mode
   ========================================================= */
document.getElementById("activateConfigBtn").onclick = () => {
  localStorage.setItem("apiMode", "API-Modus");
  localStorage.setItem("apiSource", "config.js");

  updateInfo();
  notifyApiModeChanged();
  closeModal();
  focusUserInput(50);
};

/* Init */
updateInfo();

/* =========================================================
   API Status Browser-Tooltip (title="")
   ========================================================= */
(function initStatusTitleTooltip() {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;

  function updateTitle() {
    const source = localStorage.getItem('apiSource') || '–';
    statusEl.title = `Modus: ${source}`;
  }

  // Initial setzen
  updateTitle();

  // Bei Moduswechsel aktualisieren
  window.addEventListener('api-mode-changed', updateTitle);
})();
