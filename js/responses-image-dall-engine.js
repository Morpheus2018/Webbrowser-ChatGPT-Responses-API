/* =========================================================
   Unified Image Generation Engine
   Unterstützt:
   - DALL·E 2
   - DALL·E 3
   - Demo Mode
   - Tool Activation / Deactivation
   - Modal Selection
   - Tools Button UI Integration
   =========================================================
   GLOBAL STATE
   ========================================================= */
window.imageGenState = {
  active: false,
  model: null,
  quality: null,
  size: null
};
function attachImageExpandFeature(img, bubble) {

  const expandBtn = document.createElement("button");
  expandBtn.className = "img-expand-btn";

  const applyState = () => {
    const expanded = img.classList.toggle("expanded");
    expandBtn.innerHTML = expanded
      ? `<i class="fas fa-compress"></i> Verkleinern`
      : `<i class="fas fa-expand"></i> Vergrößern`;
    expandBtn.title = expanded
      ? "Bild verkleinern"
      : "Bild vergrößern";
  };

  expandBtn.onclick = applyState;
  img.onclick = applyState;

  bubble.appendChild(expandBtn);

  /* Initial Zustand setzen */
  img.classList.remove("expanded");
  expandBtn.innerHTML = `<i class="fas fa-expand"></i> Vergrößern`;
  expandBtn.title = "Bild vergrößern";
}
/* =========================================================
   DALL·E COST BUTTON
   ========================================================= */

function attachImageCostButton(bubble, cost) {

  if (!bubble || typeof cost !== "number") return;

  const existing = bubble.querySelector(".img-cost-btn");
  if (existing) return;

  const costBtn = document.createElement("button");

  costBtn.className = "img-cost-btn";
  costBtn.title = "Kosten für die Bilderzeugung";

  costBtn.innerHTML =
    `<i class="fas fa-coins"></i> $${cost.toFixed(4)}`;

  bubble.appendChild(costBtn);
}
/* =========================================================
   UX HELPERS (Focus / Scroll)
   ========================================================= */
function focusUserInput(delay = 0) {
  const el = document.getElementById("userInput");
  if (!el) return;

  // Timeout hilft bei Modals/Overlays, damit der Focus nach DOM-Updates kommt
  window.setTimeout(() => {
    el.focus({ preventScroll: true });
    // Optional: Cursor ans Ende setzen
    try { el.setSelectionRange(el.value.length, el.value.length); } catch {}
  }, delay);
}

/* =========================================================
   TOOLS BUTTON UI UPDATE
   ========================================================= */
function updateImageGenToolsButtonUI() {
  const toolsBtn = document.getElementById("toolsMenuBtn");

  if (!toolsBtn) return;

  if (!window.imageGenState.active) {

    toolsBtn.classList.remove("active");
    toolsBtn.innerHTML = `<i class="fas fa-wrench"></i> Tools`;
    return;
  }
  toolsBtn.classList.add("active");

  const modelName =
    window.imageGenState.model === "dall-e-3"
      ? "DALL·E 3"
      : "DALL·E 2";

  toolsBtn.innerHTML =
    `<i class="fas fa-wand-magic-sparkles"></i> ${modelName} Aktiviert`;
}

/* =========================================================
   MODAL CONTROLLER
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {

  const overlay = document.getElementById("imgGenOverlay");
  const closeBtn = document.getElementById("imgGenCloseBtn");
  const cancelBtn = document.getElementById("imgGenCancelBtn");
  const selectBtn = document.getElementById("imgGenSelectBtn");
  const openBtn = document.getElementById("openImgGenModalBtn");
  const toolsBtn = document.getElementById("toolsMenuBtn");

  // Fokus nach Modal-Aktionen zurück ins Input
  selectBtn?.addEventListener("click", () => focusUserInput(50));
  cancelBtn?.addEventListener("click", () => focusUserInput(50));
  closeBtn?.addEventListener("click", () => focusUserInput(50));


  if (!overlay || !selectBtn)
    return;

  let selected = null;

  function openModal() {
    overlay.hidden = false;
    selected = null;
    selectBtn.disabled = true;

    overlay
      .querySelectorAll(".imggen-item")
      .forEach(b => b.classList.remove("active"));
  }
  function closeModal() {
    overlay.hidden = true;
  }
  /* OPEN BUTTON */
  openBtn?.addEventListener("click", e => {
    e.preventDefault();
    openModal();
  });
  /* OVERLAY CLICK 
  overlay.addEventListener("click", e => {
    if (e.target === overlay)
      closeModal();
  }); */
  closeBtn?.addEventListener(
    "click",
    closeModal
  );
  cancelBtn?.addEventListener(
    "click",
    closeModal
  );
  /* ITEM SELECT */
  overlay.addEventListener("click", e => {
    const btn = e.target.closest(".imggen-item");

    if (!btn) return;

    overlay
      .querySelectorAll(".imggen-item")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    selected = {
      model: btn.dataset.model,
      quality: btn.dataset.quality,
      size: btn.dataset.size
    };
    selectBtn.disabled = false;
  });
  /* SELECT CONFIRM */
  selectBtn.addEventListener("click", () => {
    if (!selected) return;
    window.imageGenState.active = true;
    window.imageGenState.model = selected.model;
    window.imageGenState.quality = selected.quality;
    window.imageGenState.size = selected.size;
    updateImageGenToolsButtonUI();
    closeModal();

    const modelName =
      selected.model === "dall-e-3"
        ? "DALL·E 3"
        : "DALL·E 2";

    addMessage?.("bot",
      `🖼️ ${modelName} ${selected.quality.toUpperCase()} ${selected.size} Aktiviert.\nBitte Prompt eingeben.`
    );
  });
  /* ESC - CLOSE - ENTER*/
  document.addEventListener("keydown", e => {
    if (overlay.hidden)
      return;
    if (e.key === "Escape") {
      closeModal();
    }
    if (e.key === "Enter" && selected) {
      e.preventDefault();
      selectBtn.click();
    }
  });

  /* =====================================================
     TOOLS BUTTON CLICK (DEACTIVATE / RESELECT)
     ===================================================== */
  toolsBtn?.addEventListener(
    "click",
    async () => {

      if (!window.imageGenState.active)
        return;

      const modelName =
        window.imageGenState.model === "dall-e-3"
          ? "DALL·E 3"
          : "DALL·E 2";

      const result =
        await customConfirm(
          `Image generation ${modelName} deaktivieren?`,
          {
            title: "Image generation DALL·E",
            icon: "fas fa-wand-magic-sparkles",
            okText: "Ja, deaktivieren",
            extraText: "Neu auswählen"
          }
        );

      if (result === false)
        return;
      if (result === "extra") {
        openModal();
        return;
      }

      window.imageGenState.active = false;
      updateImageGenToolsButtonUI();

      addMessage?.("bot", `🧹 ${modelName} deaktiviert.`);
    }
  );
  // Fokus auch für dynamische Confirm-Buttons
  document.addEventListener("click", (e) => {
    const id = e.target?.closest?.("#confirmCancelBtn, #confirmOkBtn")?.id;
    if (!id) return;
    focusUserInput(50);
  });

});

/* =========================================================
   - Persistenz
   - Save Button
   - script.js Integration kompatibel
   ========================================================= */
window.generateSelectedImage = async function(prompt) {

  /* Engine nicht aktiv → script.js soll normal fortfahren */
  if (!window.imageGenState.active)
    return false;

  const api =
    typeof getApiConfig === "function"
      ? getApiConfig()
      : { mode: "demo", apiKey: null };

  const model   = window.imageGenState.model;
  const quality = window.imageGenState.quality;
  const size    = window.imageGenState.size;
  const modelName =
    model === "dall-e-3"
      ? "DALL·E 3"
      : "DALL·E 2";
  /* =====================================================
     DEMO MODE GUARD
     ===================================================== */
  if (api.mode === "demo" || !api.apiKey) {

    addMessage?.(
      "bot", `⚠️ ${modelName} ist im Demo-Modus nicht verfügbar (kein API-Key).`);
    return "demo"; // statt true
  }
  try {

    if (typeof addTypingIndicator === "function")
      addTypingIndicator();
    /* =====================================================
       BODY DYNAMIC BUILD (FIX: DALL·E-2 ohne quality)
       ===================================================== */
    const body = {
      model: model,
      prompt: prompt,
      size: size,
		  response_format: "b64_json"   // 🔥 WICHTIG
    };
    /* quality nur wenn Modell unterstützt */
    if (model !== "dall-e-2" && quality)
      body.quality = quality;

    const res = await fetch("https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${api.apiKey}`,
          'Content-Type': "application/json"
        },
        body: JSON.stringify(body)
      }
    );
    const json = await res.json();

    if (typeof removeTypingIndicator === "function")
      removeTypingIndicator();

    if (!res.ok)
      throw new Error(json.error?.message || "Image API Fehler");
    const base64 = json.data?.[0]?.b64_json;

    /* =====================================================
      COST + IMAGE CALL COUNTER (MINIMAL)
      ===================================================== */
let cost = 0;

    if (typeof calculateImageGenerationCostUSD === "function") {

      cost = calculateImageGenerationCostUSD({
        model,
        size,
        quality
      });

      /* safety init */
      if (!window.sessionUsage)
        window.sessionUsage = {};

      /* init image tracker */
      if (!window.sessionUsage.image)
        window.sessionUsage.image = {
          calls: 0,
          costUSD: 0
        };

      /* increment */
      window.sessionUsage.image.calls++;
      window.sessionUsage.image.costUSD += cost;

      /* add to global total */
      window.sessionUsage.costUSD =
        (window.sessionUsage.costUSD || 0) + cost;

      updateCostFooter?.();
    }
    if (!base64)
		  throw new Error("Keine Bilddaten erhalten");
    /* =====================================================
       MESSAGE CREATE
       ===================================================== */
    const message = document.createElement("div");
    message.className = "message bot";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "AI";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
/* Timestamp sofort setzen */
createMessageTimestamp(bubble);
    /* IMAGE */
    const img = document.createElement("img");
    img.src = "data:image/png;base64," + base64;
    img.className = "generated-image";
/* Cost am Bild merken */
img.dataset.imageCost = cost;
    /* Persistenz Marker */
   /* img.dataset.src = url; */
    bubble.appendChild(img);
    /* =====================================================
       SAVE BUTTON
       ===================================================== */
    const saveBtn = document.createElement("button");
    saveBtn.className = "img-save-btn";
    saveBtn.innerHTML =
      `<i class="fas fa-download"></i> Speichern`;

saveBtn.addEventListener("click", async () => {

  try {

    const fullBase64 = "data:image/png;base64," + base64;

    /* ===============================
       1️⃣ Immer lokalen Download erlauben
    =============================== */
    const a = document.createElement("a");
    a.href = fullBase64;
    a.download = `image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    /* ===============================
       2️⃣ Nur speichern wenn noch NICHT in IndexedDB
    =============================== */
    if (!img.dataset.imageId) {

      const id = "img_" + Date.now();

      await saveImageToDB(id, fullBase64);

      img.dataset.imageId = id;
      saveBtn.dataset.imageId = id;
if (img.dataset.imageCost) {
  img.dataset.imageCostDall = img.dataset.imageCost;
}
			deleteBtn.hidden = false; // 🔥 jetzt sichtbar, weil gespeichert
      saveHistory?.();
    }

  }
  catch (err) {

    addMessage?.(
      "bot",
      "❌ Bild konnte nicht gespeichert werden: " + (err?.message || err)
    );
  }

});

    bubble.appendChild(saveBtn);

/* ==============================
   DELETE BUTTON
============================== */
const deleteBtn = document.createElement("button");
deleteBtn.className = "img-delete-btn";
deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Löschen`;
deleteBtn.hidden = true; // 🔥 erst zeigen wenn imageId existiert
deleteBtn.addEventListener("click", async () => {

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

  }
  catch (err) {

    addMessage?.(
      "bot",
      "❌ Bild konnte nicht gelöscht werden: " + (err?.message || err)
    );
  }

});

bubble.appendChild(deleteBtn);
attachImageCostButton(bubble, cost);
attachImageExpandFeature(img, bubble);
    message.appendChild(label);
    message.appendChild(bubble);
    messages.appendChild(message);
    /* Persist */
    if (typeof saveHistory === "function")
      saveHistory();

	if (typeof scrollToBottom === "function") {
	  // Scroll direkt nach DOM-Append
	  scrollToBottom();
	  // Und nochmal, sobald Bild wirklich gerendert ist
	  img.addEventListener("load", () => scrollToBottom(), { once: true });
	}

  }
  catch (err) {
    if (typeof removeTypingIndicator === "function")
      removeTypingIndicator();

    addMessage?.("bot", `❌ ${modelName} Fehler: ${err.message || err}`);
  }
  return true;
};

/* =========================================================
   Demo AI Responder (Local Fake AI)
   ========================================================= */

function generateDemoResponse(userText) {

  const text = userText.toLowerCase();

  /* einfache Intent-Erkennung */

  if (text.includes("hallo") || text.includes("hi") || text.includes("alo")) {
    return "👋 Hallo! Ich bin im 🤖 Demo-Modus aktiv. Wie kann ich helfen?";
  }
  if (text.includes("wer bist du")) {
    return "🤖 Demo-Modus: Ich bin ein lokaler Demo-Responder. Im echten Modus würde hier die OpenAI API antworten.";
  }
if (text.includes("javascript") || text.includes("js")) {
  return '🤖 Demo-Modus: JavaScript macht Webseiten interaktiv.' +
         '\n &lt;script&gt;' +
         '\n function sayHello() {' +
         '\n   alert("Hallo Welt!");' +
         '\n }' +
         '\n &lt;/script&gt;';
}
  if (text.includes("html")) {
    return '🤖 Demo-Modus: HTML ist die Struktur-Sprache für Webseiten. Sie definiert Elemente wie Text, Bilder und Layout.\n &lt;a href="#" class="button"&gt;Klick mich!&lt;/a&gt;';
  }
if (text.includes("css")) {
  return '🤖 Demo-Modus: CSS gestaltet das Aussehen von Webseiten (Farben, Layout, Animationen).' +
         '\n &lt;style&gt;' +
         '\n .button {' +
         '\n   background: #4CAF50; / Grüne Hintergrundfarbe /' +
         '\n   color: white;  / Weiße Schriftfarbe /' +
         '\n   padding: 10px 20px;  / Innenabstand /' +
         '\n   text-align: center; / Text zentrieren /' +
         '\n }' +
         '\n &lt;/style&gt;';
}
if (text.includes("python") || text.includes("py")) {
  return '🤖 Demo-Modus: Python ist eine vielseitige Programmiersprache.' +
         '\n print("Hallo Welt!")';
}
  if (text.includes("api")) {
    return "🤖 Demo-Modus: Eine API ermöglicht Kommunikation zwischen verschiedenen Software-Systemen.";
  }
  if (text.includes("demo") || text.includes("fake")) {
    return "Du befindest dich aktuell im 🤖 Demo-Modus. Keine echte API wird verwendet.";
  }
  if (text.includes("?") || text.includes(".")) {
    return "🤖 Demo-Modus: Das ist eine interessante Frage. Im Demo-Modus simuliere ich nur Antworten ohne echte KI.";
  }
  /* fallback */

  const templates = [
    " 🤖 Demo-Modus: Ich habe deine Nachricht erhalten: \"" + userText + "\"",
    " 🤖 Demo-Modus: Im Demo-Modus kann ich einfache Antworten simulieren.",
    " 🤖 Demo-Modus: Diese Antwort wurde lokal erzeugt ohne API.",
    " 🤖 Demo-Modus: Du kannst in den API-Modus wechseln, um echte Antworten zu erhalten."
  ];

  return templates[
    Math.floor(Math.random() * templates.length)
  ];
}

