/* =========================================================
   Delete Bubble
========================================================= */
window.deleteBubble = function(bubble) {

  if (!bubble) return;

  const messageEl = bubble.closest(".message");
  if (!messageEl) return;

  suppressAutoScroll = true;

  messageEl.dataset.deleted = "true";
  bubble.innerHTML = "🗑️ Nachricht wurde gelöscht.";

  saveHistory?.();

  setTimeout(() => {
    suppressAutoScroll = false;
  }, 50);

  /* Fokus auf Chat setzen */
  const container = messages.parentElement;
  if (container) {
    container.tabIndex = -1;   // falls noch nicht gesetzt
    container.focus({ preventScroll: true });
  }
};

/* Delete Button erzeugen */
window.attachBubbleDeleteButton = function(bubble) {

  if (!bubble) return;

  const deleteBtn = document.createElement("button");

  deleteBtn.className = "bubble-delete-btn";
  deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
  deleteBtn.title = "Nachricht löschen";

  deleteBtn.onclick = () => {
    window.deleteBubble(bubble);
  };

  bubble.appendChild(deleteBtn);
};

/* =========================================================
   Message Timestamp
   ========================================================= */

function createMessageTimestamp(bubble, timestamp) {

  if (!bubble) return;

  let timeEl = bubble.querySelector(".bubble-time");

  /* Element erstellen falls noch nicht vorhanden */
  if (!timeEl) {
    timeEl = document.createElement("span");
    timeEl.className = "bubble-time";
    bubble.appendChild(timeEl);
  }

  /* feste Zeit bestimmen */
  const ts =
    timestamp ||
    timeEl.dataset.timestamp ||
    new Date().toISOString();

  timeEl.dataset.timestamp = ts;

  const d = new Date(ts);

  timeEl.textContent =
    d.toLocaleDateString("de-DE") +
    " " +
    d.toLocaleTimeString("de-DE");
		/* 🔥 Sichtbarkeit anwenden */
		if (!isTimestampVisible()) {
		  timeEl.style.display = "none";
		} else {
		  timeEl.style.display = "";
		}

}
/* =========================================================
   TIMESTAMP VISIBILITY
   ========================================================= */

const TIMESTAMP_KEY = "show_timestamps";

function isTimestampVisible() {
  const saved = localStorage.getItem(TIMESTAMP_KEY);
  return saved === null ? true : saved === "true";
}

function setTimestampVisible(state) {
  localStorage.setItem(TIMESTAMP_KEY, state ? "true" : "false");
  updateTimestampVisibility();
}

function updateTimestampVisibility() {

  const visible = isTimestampVisible();

  document
    .querySelectorAll(".bubble-time")
    .forEach(el => {
      el.style.display = visible ? "" : "none";
    });
}

/* =========================================================
   Timestamp: Schalter ON / OFF
   ========================================================= */

const timestampToggleBtn =
  document.getElementById("toggleTimestampBtn");

if (timestampToggleBtn) {

  function updateTimestampToggleUI() {

    const enabled = isTimestampVisible();

    timestampToggleBtn.textContent =
      enabled ? "Zeitstempel: ON" : "Zeitstempel: OFF";

    timestampToggleBtn.classList.toggle("active", enabled);
  }

  timestampToggleBtn.onclick = () => {

    setTimestampVisible(!isTimestampVisible());

    updateTimestampVisibility();   // sichtbare Timestamps updaten
    updateTimestampToggleUI();     // Button UI updaten
  };

  document.addEventListener(
    "DOMContentLoaded",
    updateTimestampToggleUI
  );
}
