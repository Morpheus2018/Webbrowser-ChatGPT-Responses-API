/* =========================================================
   Image GPT Engine (gpt-image-1.5 / 1 / mini)
   Separate von DALL·E Engine
   ========================================================= */
window.imageGPTEngineState = {
  active: false,
  model: null,
  quality: "low",
  size: "1024x1024",

  output_format: null,
  background: "auto",
  output_compression: null,

  // NEW STREAM
  stream: false,                 // null = deaktiviert
  partial_images: 1,            // default 1 (wird nur genutzt wenn stream aktiv)

  // NEW: edit/refs
  mode: "create",
  input_fidelity: "low",
  fidelity_enabled: false,
  input_images: [],
  mask_image: null,
  mask_action: null
};

/* Tools Button Integration */
function updateImageGPTToolsButtonUI() {
  const toolsBtn =
    document.getElementById("toolsMenuBtn");

  if (!toolsBtn) return;

  /* 🔥 Schutz gegen Konflikt mit DALL·E */
  if (window.imageGenState?.active)
    return;

  if (!window.imageGPTEngineState.active) {

    toolsBtn.classList.remove("active");
    toolsBtn.innerHTML =
      `<i class="fas fa-wrench"></i> Tools`;
    return;
  }

  toolsBtn.classList.add("active");

  const modelLabel =
    getImageGPTModelLabel(
      window.imageGPTEngineState.model
    );

  toolsBtn.innerHTML =
    `<i class="fas fa-image"></i> ${modelLabel} Aktiviert`;
}

function getImageGPTModelLabel(model) {

  switch (model) {
    case "gpt-image-1.5":
      return "GPT Image 1.5";

    case "gpt-image-1":
      return "GPT Image 1";

    case "gpt-image-1-mini":
      return "GPT Image Mini";

    default:
      return "Image GPT";
  }
}
/* Message Option Info */
function buildImageGPTActivationSummary(state) {

  const parts = [];

  // Modellname
  parts.push(getImageGPTModelLabel(state.model));

  // Quality
  const q = (state.quality || "auto");
  parts.push(q.charAt(0).toUpperCase() + q.slice(1));

  // Size (mit deutschem Label)
  const size = state.size || "auto";
  const sizeLabel =
    size === "1024x1024" ? "Quadrat 1024x1024" :
    size === "1024x1536" ? "Porträt 1024x1536" :
    size === "1536x1024" ? "Landschaft 1536x1024" :
    "Size-auto";

  parts.push(sizeLabel);

  // Format (output_format)
  const fmt = state.output_format; // null => auto
  if (!fmt) {
    parts.push("Format-auto");
  } else {
    const fmtLabel =
      fmt === "jpeg" ? "JPEG" :
      fmt === "webp" ? "WebP" :
      "PNG";
    parts.push(fmtLabel);
  }

  // Background (mit BG- Prefix wenn auto)
  const bg = state.background || "auto";
  if (bg === "auto") {
    parts.push("BG-auto");
  } else {
    const bgLabel =
      bg === "transparent" ? "BG-Transparent" :
      bg === "opaque" ? "BG-Normal" :
      "BG-auto";
    parts.push(bgLabel);
  }

  // Bild-Inputs: Edit/Reference
  const files = state.input_images || [];
  if (state.mode === "edit") {
    parts.push("1x Bild");
  } else if (state.mode === "reference") {
    const n = files.length || 0;
    parts.push(`${n}x Bild Referenz`);
  }

  // Maske (nur edit)
  if (state.mode === "edit" && state.mask_image) {
    const name = state.mask_image?.name || "Maske";
    // Wunsch-Beispiele: "Maske-xxx" vs "Eigene Maske-xxx"
    if (state.mask_action === "upload") {
      parts.push(`Upload Maske-${name}`);
    } else {
      // paint oder unbekannt
      parts.push(`Paint Maske-${name}`);
    }
  }

  // Detail / Fidelity
  if (state.fidelity_enabled) {
    const f = state.input_fidelity || "low";
    const fLabel = f.charAt(0).toUpperCase() + f.slice(1);
    parts.push(`Detail-${fLabel}`);
  }

  // Compression (wenn gesetzt)
  if (state.output_compression != null) {
    const n = Number(state.output_compression);
    if (!Number.isNaN(n)) parts.push(`Compression-${n}%`);
  }

  // Stream
  if (state.stream) {
    const p = Math.max(0, Math.min(3, Number(state.partial_images ?? 0)));
    parts.push(`Stream-${p}`);
  }

  return `🎨 ${parts.join(" · ")} · Aktiviert.\nBitte Prompt eingeben.`;
}
/* Modal Controller */
document.addEventListener("DOMContentLoaded", () => {

  const overlay   = document.getElementById("imgGPTOverlay");
  const selectBtn = document.getElementById("imgGPTSelectBtn");
  const cancelBtn = document.getElementById("imgGPTCancelBtn");
  const closeBtn  = document.getElementById("imgGPTCloseBtn");
  const openBtn   = document.getElementById("imageGPTGenBtn");
  const fileInput = document.getElementById("imgGPTFileInput");
  const pickBtn = document.getElementById("imgGPTPickFilesBtn");
  const filesInfo = document.getElementById("imgGPTFilesInfo");
  const fidelityLevels = document.getElementById("imggptFidelityLevels");
  const maskSection = document.getElementById("imgGPTMaskSection");
  const maskInput   = document.getElementById("imgGPTMaskInput");
  const maskPickBtn = document.getElementById("imgGPTPickMaskBtn");
  const maskInfo    = document.getElementById("imgGPTMaskInfo");
  const paintPanel = document.getElementById("imgGPTPaintPanel");

	function showMaskHint(msg) {

	if (maskInfo) {
		maskInfo.innerHTML = `⚠️ ${msg}`;
	}
	// Upload-UI nur anzeigen wenn wir NICHT im Paint-Modus sind
	if (maskSection && selected?.mask_action !== "paint") {
		maskSection.hidden = false;
	}
	}

	function clearMaskHint() {
	if (maskInfo) maskInfo.innerHTML = "Keine Maske";
	}

	function resetMaskState() {

	selected.mask_action = null;
	selected.mask_image = null;

	overlay
		.querySelectorAll('.imggpt-item[data-type="mask_action"]')
		.forEach(el => el.classList.remove("active"));

	if (maskSection) maskSection.hidden = true;
	if (maskInput) maskInput.value = "";
	clearMaskHint();

	// 🔥 Paint Tool IMMER schließen
	window.paintMaskTool?.close?.();
	}

  if (!overlay || !selectBtn)
    return;

	let selected = {
		model: null,
		quality: "low",
		size: "1024x1024",

		// Extras: default deaktiviert
		output_format: null,         // "png" | "jpeg" | "webp"
		background: "auto",            // "transparent" | "opaque"
		output_compression: null,     // "0".."100" (string)

stream: false,
partial_images: 1,

		mode: "create",
		input_images: [],
		mask_image: null,
		mask_action: null, // "upload" | "paint" | null
		fidelity_enabled: false,
	    input_fidelity: "low"      // bleibt low bis aktiviert
	};
  /* =====================================================
     Edit Images UPLOAD
     ===================================================== */
	pickBtn?.addEventListener("click", () => {
	// Multi erlaubt wenn:
	// - reference mode
	// - Oder Input fidelity aktiviert
	const isMulti = (selected.mode === "reference"); 

	if (fileInput) fileInput.multiple = isMulti;

	fileInput?.click();
	});

	fileInput?.addEventListener("change", () => {

		const newFiles = Array.from(fileInput.files || []);

		if (!newFiles.length) return;
		// Wenn Multi erlaubt → anhängen
		if (selected.mode === "reference" || selected.fidelity_enabled) {

			selected.input_images = [
			...selected.input_images,
			...newFiles.filter(
				f => !selected.input_images.some(e => e.name === f.name)
			)
			];

		} else {
			// Normaler Edit Mode → nur 1 Bild
			selected.input_images = [newFiles[0]];
		}
		// Input zurücksetzen damit man erneut wählen kann
		fileInput.value = "";

		updateFilesInfo();
	});
	/* =====================================================
	MASK UPLOAD
	===================================================== */

	maskPickBtn?.addEventListener("click", () => {
	maskInput?.click();
	});

	maskInput?.addEventListener("change", () => {

	const file = maskInput.files?.[0] || null;

	selected.mask_image = file;

	if (!maskInfo) return;

	maskInfo.innerHTML = file
		? `Maske: ${file.name}`
		: "Keine Maske";
	});
	document.addEventListener("keydown", (e) => {

		if (overlay.hidden) return;

		// ENTER → Bestätigen
		if (e.key === "Enter") {
			e.preventDefault();
			selectBtn?.click();
		}

		// ESC → Abbrechen
		if (e.key === "Escape") {
			e.preventDefault();
			closeModal();
			focusUserInput?.(50);
		}
	});

	function updateFilesInfo() {

	if (!filesInfo) return;

	const files = selected.input_images || [];

	if (!files.length) {
		filesInfo.innerHTML = "Keine Dateien";
		return;
	}

	filesInfo.innerHTML = files.map((file, index) => `
		<div class="imggpt-file-row" data-index="${index}">
		<span class="file-name">${index + 1}: ${file.name}</span>
		<button class="file-remove-btn" data-index="${index}">❌</button>
		</div>
	`).join("");
	}
	filesInfo?.addEventListener("click", (e) => {

	const btn = e.target.closest(".file-remove-btn");
	if (!btn) return;

	const index = Number(btn.dataset.index);

	if (Number.isNaN(index)) return;

	selected.input_images.splice(index, 1);

	updateFilesInfo();
	});
	/* =====================================================
	SELECTION LOGIC (Model / Quality / Size / Extras)
	===================================================== */
	overlay.addEventListener("click", (e) => {

	const item = e.target.closest(".imggpt-item");
	if (!item) return;
    if (item.classList.contains("disabled")) return;
	const type = item.dataset.type;
	const value = item.dataset.value;

	if (!type) return;

	const isExtra =
		type === "output_format" ||
		type === "background" ||
		type === "output_compression" ||
		type === "mode" ||
		type === "input_fidelity" ||
		type === "fidelity_toggle" ||
		type === "mask_action" ||
		type === "stream_toggle" ||
		type === "partial_images";

	/* -------------------------------------------------
		EXTRAS: Toggle Verhalten
		------------------------------------------------- */
	if (isExtra) {

	const alreadyActive = item.classList.contains("active");

	/* ---------------- MASK ACTION (UPLOAD / PAINT) ---------------- */
	if (type === "mask_action") {

	// Maske nur im Edit Mode
	if (selected.mode !== "edit") {
		showMaskHint('Maske funktioniert nur mit „Bild ergänzen“.');
		return;
	}

	// Basisbild erforderlich
	const baseFile = selected.input_images?.[0] || null;
	if (!baseFile) {
		showMaskHint("Bitte zuerst ein Basisbild auswählen.");
		return;
	}

	const alreadyActive = item.classList.contains("active");

	// Toggle OFF
	if (alreadyActive) {
		item.classList.remove("active");
		selected.mask_action = null;
		selected.mask_image = null;

		// Upload UI verstecken
		if (maskSection) maskSection.hidden = true;
		if (maskInput) maskInput.value = "";
		clearMaskHint();

		// Paint Tool schließen (wenn offen)
		window.paintMaskTool?.close?.();
		return;
	}

	// Exklusiv: nur ein mask_action aktiv
	overlay
		.querySelectorAll('.imggpt-item[data-type="mask_action"]')
		.forEach(el => el.classList.remove("active"));

	item.classList.add("active");
	selected.mask_action = value;

	// Wechsel upload<->paint -> alte Maske verwerfen
	selected.mask_image = null;
	if (maskInput) maskInput.value = "";
	clearMaskHint();

	if (value === "upload") {

		// Paint zu
		window.paintMaskTool?.close?.();

		// Upload-UI an
		if (maskSection) maskSection.hidden = false;
		return;
	}

	if (value === "paint") {

		// Upload UI aus (du willst Paint Panel im Overlay)
		if (maskSection) maskSection.hidden = true;

		window.paintMaskTool?.open?.(
		baseFile,
		(maskFile) => {
			selected.mask_image = maskFile;      // <- wird an API geschickt
			selected.mask_action = "paint";
		},
		{
			onStatus: (text, ok) => {
			// optional: Engine darf Status zusätzlich im MaskInfo spiegeln
			if (maskInfo) maskInfo.innerHTML = ok ? `✅ ${text}` : `⚠️ ${text}`;
			}
		}
		);

		return;
	}

	return;
	}

	/* ---------------- FIDELITY TOGGLE ---------------- */
	if (type === "fidelity_toggle") {

	if (alreadyActive) {

		item.classList.remove("active");
		selected.fidelity_enabled = false;
		selected.input_fidelity = "low";

		applyModelSpecificRules();

		selected.input_images = [];
		if (fileInput) fileInput.value = "";
		if (filesInfo) filesInfo.innerHTML = "Keine Dateien";

	} else {

		item.classList.add("active");
		selected.fidelity_enabled = true;

		applyModelSpecificRules();
	}

	return; // 🔥 WICHTIG: verhindert Weiterlaufen in andere Blöcke
	}
/* ---------------- STREAM TOGGLE ---------------- */
if (type === "stream_toggle") {

  if (alreadyActive) {

    item.classList.remove("active");
    selected.stream = false;

  } else {

    item.classList.add("active");
    selected.stream = true;
  }

  applyStreamRules();
  return;
}
/* ---------------- PARTIAL IMAGES ---------------- */
if (type === "partial_images") {

  if (!selected.stream) return;

  overlay
    .querySelectorAll('.imggpt-item[data-type="partial_images"]')
    .forEach(el => el.classList.remove("active"));

  item.classList.add("active");
  selected.partial_images = Number(value);

  return;
}
	/* ---------------- INPUT FIDELITY LEVELS ---------------- */
	if (type === "input_fidelity") {

		if (!selected.fidelity_enabled) return;

		overlay
		.querySelectorAll(`.imggpt-item[data-type="input_fidelity"]`)
		.forEach(el => el.classList.remove("active"));

		item.classList.add("active");
		selected.input_fidelity = value;

		return;
	}
	/* ---------------- ANDERE EXTRAS ---------------- */
	if (alreadyActive) {

	item.classList.remove("active");

	if (type === "mode") {

		// Mode deaktivieren → zurück zu create
		selected.mode = "create";

		// 🔥 Zentrale Reset-Funktion
		resetMaskState();

		// Mask Buttons korrekt setzen
		applyMaskToolRules();
	} 
	else {
		selected[type] = null;
	}

	// Bild-Reset Logik
	if (selected.mode !== "reference" && !selected.fidelity_enabled) {
		selected.input_images = [];
		if (fileInput) fileInput.value = "";
		if (filesInfo) filesInfo.innerHTML = "Keine Dateien";
	}

	} 
	else {

	overlay
		.querySelectorAll(`.imggpt-item[data-type="${type}"]`)
		.forEach(el => el.classList.remove("active"));

	item.classList.add("active");

	/* 🔥 MODE SPEZIALBEHANDLUNG */
	if (type === "mode") {

		selected.mode = value;

		// 🔥 Wenn wir edit verlassen → alles sauber resetten
		if (value !== "edit") {
		resetMaskState();
		}

		// Mask Buttons je nach Mode aktivieren/deaktivieren
		applyMaskToolRules();

	} 
	else {
		selected[type] = value;
	}
	}
	}

	/* -------------------------------------------------
		NORMAL: 1-of-N Auswahl
	------------------------------------------------- */
	else {

	overlay
	.querySelectorAll(`.imggpt-item[data-type="${type}"]`)
	.forEach(el => el.classList.remove("active"));

	item.classList.add("active");
	selected[type] = value;

	// 🔥 MODEL SPEZIFISCHE REGELN
	if (type === "model") {
		applyModelSpecificRules();
	}
	}

	applyImageGPTRules();

	selectBtn.disabled = !selected.model;
	});

	function applyImageGPTRules() {

		const fmt = selected.output_format;

		const backgroundItems =
		  overlay.querySelectorAll(`.imggpt-item[data-type="background"]`);

		const compressionItems =
		  overlay.querySelectorAll(`.imggpt-item[data-type="output_compression"]`);

		/* --- BACKGROUND RULE --- */
		backgroundItems.forEach(el => el.classList.remove("disabled"));

		if (fmt && !(fmt === "png" || fmt === "webp")) {

		  backgroundItems.forEach(el => el.classList.add("disabled"));

		  if (selected.background === "transparent") {
		    selected.background = "auto";
		    backgroundItems.forEach(el => el.classList.remove("active"));
		  }
		}

		/* --- COMPRESSION RULE --- */
		compressionItems.forEach(el => el.classList.remove("disabled"));

		if (fmt && !(fmt === "jpeg" || fmt === "webp")) {

		  compressionItems.forEach(el => el.classList.add("disabled"));

		  if (selected.output_compression) {
		    selected.output_compression = null;
		    compressionItems.forEach(el => el.classList.remove("active"));
		  }
		}
	}
	/* --- Helper input_fidelity High ausgrauen --- */
	function applyModelSpecificRules() {

	const levelButtons = overlay.querySelectorAll(
		'.imggpt-item[data-type="input_fidelity"]'
	);

	if (!levelButtons.length) return;

	// 🔒 Wenn Toggle nicht aktiv → alles disabled
	if (!selected.fidelity_enabled) {

		levelButtons.forEach(btn => {
		btn.classList.add("disabled");
		btn.classList.remove("active");
		});

		return;
	}

	// Toggle ist aktiv → erstmal alle aktivieren
	levelButtons.forEach(btn => {
		btn.classList.remove("disabled");
	});

	// 🔥 Model spezifische Einschränkung
	if (selected.model === "gpt-image-1-mini") {

		const highBtn = overlay.querySelector(
		'.imggpt-item[data-type="input_fidelity"][data-value="high"]'
		);

		if (highBtn) {
		highBtn.classList.add("disabled");

		if (selected.input_fidelity === "high") {
			selected.input_fidelity = "medium";

			levelButtons.forEach(btn => btn.classList.remove("active"));

			overlay
			.querySelector('.imggpt-item[data-type="input_fidelity"][data-value="medium"]')
			?.classList.add("active");
		}
		}
	}
	}
	/* Helper "Referenz Bilder“ aktiv → Mask Buttons ausgrauen + resetten  */
	function applyMaskToolRules() {

	const maskBtns = overlay.querySelectorAll(
		'.imggpt-item[data-type="mask_action"]'
	);
	if (!maskBtns.length) return;

	const allowed = (selected.mode === "edit"); // NUR in edit

	maskBtns.forEach(btn => {
		btn.classList.toggle("disabled", !allowed);
		if (!allowed) btn.classList.remove("active");
	});

	if (!allowed) {
		selected.mask_action = null;
		selected.mask_image = null;

		// Upload UI weg
		if (maskSection) maskSection.hidden = true;
		if (maskInput) maskInput.value = "";
		clearMaskHint();

		// Paint schließen falls offen
		window.paintMaskTool?.close?.();
	}
	}

function applyStreamRules() {

  const partialBtns = overlay.querySelectorAll(
    '.imggpt-item[data-type="partial_images"]'
  );

  if (!partialBtns.length) return;

  partialBtns.forEach(btn => {
    btn.classList.toggle("disabled", !selected.stream);
  });

  if (!selected.stream) {
    partialBtns.forEach(btn => btn.classList.remove("active"));
  }
if (selected.mode !== "create" && selected.mode !== "edit" && selected.mode !== "reference") {
   selected.stream = false;
}
}

	function openModal() {

		overlay.hidden = false;
		// QUALITY
		overlay
		  .querySelectorAll('.imggpt-item[data-type="quality"]')
		  .forEach(el => el.classList.remove("active"));

		overlay
		  .querySelector(`.imggpt-item[data-type="quality"][data-value="${selected.quality}"]`)
		  ?.classList.add("active");
		// BACKGROUND
		overlay
		  .querySelectorAll('.imggpt-item[data-type="background"]')
		  .forEach(el => el.classList.remove("active"));

		overlay
		  .querySelector(`.imggpt-item[data-type="background"][data-value="${selected.background}"]`)
		  ?.classList.add("active");
		// FIDELITY TOGGLE SYNC
		overlay
		.querySelectorAll('.imggpt-item[data-type="fidelity_toggle"]')
		.forEach(el => el.classList.toggle("active", selected.fidelity_enabled));

		overlay
		.querySelectorAll('.imggpt-item[data-type="input_fidelity"]')
		.forEach(el => el.classList.remove("active"));

		if (selected.fidelity_enabled) {
		overlay
			.querySelector(`.imggpt-item[data-type="input_fidelity"][data-value="${selected.input_fidelity}"]`)
			?.classList.add("active");
		}

        // MODE
		overlay
		.querySelectorAll('.imggpt-item[data-type="mode"]')
		.forEach(el => el.classList.remove("active"));

		overlay
		.querySelector(`.imggpt-item[data-type="mode"][data-value="${selected.mode}"]`)
		?.classList.add("active");

		selectBtn.disabled = !selected.model;

		// 🔥 Model Regeln synchronisieren
		applyModelSpecificRules();

		// mask_action Buttons sync
		overlay
		.querySelectorAll('.imggpt-item[data-type="mask_action"]')
		.forEach(el => el.classList.toggle("active", el.dataset.value === selected.mask_action));

		// Upload UI nur wenn upload aktiv
		if (maskSection) {
		maskSection.hidden = !(selected.mode === "edit" && selected.mask_action === "upload");
		}

		// Regeln am Ende anwenden (disabled/reset/close paint)
		applyMaskToolRules();

// STREAM SYNC
overlay
  .querySelectorAll('.imggpt-item[data-type="stream_toggle"]')
  .forEach(el => el.classList.toggle("active", selected.stream));

overlay
  .querySelectorAll('.imggpt-item[data-type="partial_images"]')
  .forEach(el => {
    el.classList.remove("active");
    if (selected.stream && Number(el.dataset.value) === selected.partial_images) {
      el.classList.add("active");
    }
  });

applyStreamRules();

	}

  function closeModal() {
    overlay.hidden = true;
  }

  /* OPEN MODAL */
  openBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  cancelBtn?.addEventListener("click", () => {
    closeModal();
    focusUserInput?.(50);
  });
  closeBtn?.addEventListener("click", () => {
    closeModal();
    focusUserInput?.(50);
  });

  /* CONFIRM SELECT */
  selectBtn.addEventListener("click", () => {

    if (!selected.model)
      return;

    window.imageGPTEngineState.active = true;
    window.imageGPTEngineState.model = selected.model;
    window.imageGPTEngineState.quality = selected.quality;
    window.imageGPTEngineState.size = selected.size;

	window.imageGPTEngineState.output_format = selected.output_format;
	window.imageGPTEngineState.background = selected.background;
	window.imageGPTEngineState.output_compression = selected.output_compression;

	window.imageGPTEngineState.mode = selected.mode;
	window.imageGPTEngineState.input_images = selected.input_images || [];
	window.imageGPTEngineState.mask_image = selected.mask_image || null;
	window.imageGPTEngineState.mask_action = selected.mask_action || null;
	window.imageGPTEngineState.input_fidelity = selected.input_fidelity || "low";
	window.imageGPTEngineState.fidelity_enabled = selected.fidelity_enabled;

	window.imageGPTEngineState.stream = selected.stream;
	window.imageGPTEngineState.partial_images = selected.partial_images;	

    updateImageGPTToolsButtonUI();
    closeModal();
    addMessage?.("bot", buildImageGPTActivationSummary(window.imageGPTEngineState));

    /* 🔥 Cursor zurück ins Input */
    focusUserInput?.(50);
  });
/* =====================================================
   TOOLS BUTTON CLICK (DEACTIVATE / RESELECT)
   ===================================================== */
const toolsBtn = document.getElementById("toolsMenuBtn");

toolsBtn?.addEventListener("click", async () => {
  /* Nur reagieren wenn Image GPT aktiv */
  if (!window.imageGPTEngineState.active)
    return;

  const modelLabel =
    getImageGPTModelLabel(
      window.imageGPTEngineState.model
    );
  const result =
    await customConfirm(
      `${modelLabel} API deaktivieren?`,
      {
        title: "Image API",
        icon: "fas fa-image",
        okText: "Ja, deaktivieren",
        extraText: "Neu auswählen"
      }
    );

    if (result === false)
      return;
    /* Neu auswählen → Modal öffnen */
    if (result === "extra") {
      overlay.hidden = false;
      return;
    }
    /* Deaktivieren */
    window.imageGPTEngineState.active = false;
    updateImageGPTToolsButtonUI();
    addMessage?.("bot",`🧹 ${modelLabel} API deaktiviert.`);
  });

});
/* =========================================================
   STREAM HANDLER (Create + Edit Unified)
   ========================================================= */
async function handleImageStream(response, state) {

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming nicht unterstützt");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let usageData = null;

  let message = null;
  let bubble = null;
  let img = null;

  /* ---------- Preview erstellen ---------- */
	const ensurePreview = () => {
	if (message) return;

	message = document.createElement("div");
	message.className = "message bot";

	const label = document.createElement("div");
	label.className = "label";
	label.textContent = "AI";

	bubble = document.createElement("div");
	bubble.className = "bubble";

	img = document.createElement("img");
	img.className = "generated-image";

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

    /* Download immer */
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `image-${Date.now()}.png`;
    a.click();

    /* Nur einmal in IndexedDB */
    if (!img.dataset.imageId || img.dataset.imageId === "") {

      const id = "img_" + Date.now();

      await saveImageToDB(id, img.src);

      img.dataset.imageId = id;
      saveBtn.dataset.imageId = id;
/* Usage Button */
if (img._usageDataForModal) {
  img.dataset.imageUsage = JSON.stringify(img._usageDataForModal);
}
if (typeof img._usageCostForModal === "number") {
  img.dataset.imageCost = String(img._usageCostForModal);
}
if (img._usageCostLogForModal) {
  img.dataset.imageCostLog = img._usageCostLogForModal;
}
      deleteBtn.hidden = false;
	  saveBtn.title = "Bereits im IndexedDB gespeichert";
      saveHistory?.();
    }

  } catch (err) {

    addMessage?.(
      "bot",
      "❌ Bild konnte nicht gespeichert werden: " + (err?.message || err)
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

/* kleine Verzögerung → danach Scroll wieder erlauben */
setTimeout(() => {
  suppressAutoScroll = false;
}, 50);

  } catch (err) {

    addMessage?.(
      "bot",
      "❌ Bild konnte nicht gelöscht werden: " + (err?.message || err)
    );
  }
};

	bubble.appendChild(img);
	bubble.appendChild(saveBtn);
	bubble.appendChild(deleteBtn);
  attachImageExpandFeature(img, bubble);
	message.appendChild(label);
	message.appendChild(bubble);
	messages.appendChild(message);

	scrollToBottom?.();
	};

  /* ---------- Mime bestimmen ---------- */
  const getMime = () => {
    const f = state.output_format || "png";
    if (f === "webp") return "image/webp";
    if (f === "jpeg") return "image/jpeg";
    return "image/png";
  };

  /* =====================================================
     🔥 ZENTRALE IMAGE UPDATE FUNKTION
  ===================================================== */
  const updateImage = (base64) => {

    ensurePreview();

    const newSrc = `data:${getMime()};base64,${base64}`;

    img.onload = () => {
      scrollToBottom?.();
    };

    img.src = newSrc;

    // Falls Bild bereits im Cache
    if (img.complete) {
      scrollToBottom?.();
    }
  };

  /* ========== STREAM LOOP ========== */
  while (true) {

    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const chunk of parts) {

      const lines = chunk.split("\n");

      for (const line of lines) {

        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {

          const evt = JSON.parse(data);

          /* ===== GENERATION STREAM ===== */
          if (
            evt.type === "image_generation.partial_image" ||
            evt.type === "image_generation.completed"
          ) {
            if (evt.b64_json)
              updateImage(evt.b64_json);

            if (evt.type === "image_generation.completed" && evt.usage)
              usageData = evt.usage;
          }

          /* ===== EDIT STREAM ===== */
          else if (
            evt.type === "image_edit.partial_image" ||
            evt.type === "image_edit.completed"
          ) {
            if (evt.b64_json)
              updateImage(evt.b64_json);

            if (evt.type === "image_edit.completed" && evt.usage)
              usageData = evt.usage;
          }

          /* ===== FALLBACK (file:// tolerant) ===== */
          else if (!evt.type) {

            const b64 =
              evt?.data?.[0]?.b64_json ||
              evt?.image?.b64_json ||
              evt?.b64_json;

            if (b64)
              updateImage(b64);

            if (evt.usage)
              usageData = evt.usage;
          }

        } catch {}
      }
    }
  }
  /* ===== TIMESTAMP FINAL ===== */
  if (bubble && !bubble.querySelector(".bubble-time")) {
    createMessageTimestamp(bubble);
  }
  /* ===== COST TRACKING ===== */
  if (typeof calculateImageGPTCostUSD === "function" && usageData) {

    const cost = calculateImageGPTCostUSD({
      model: state.model,
      usage: usageData
    });

attachImageUsageButton(img, bubble, usageData, cost);

    if (!window.sessionUsage.imageGPT) {
      window.sessionUsage.imageGPT = { calls: 0, costUSD: 0 };
    }

    window.sessionUsage.imageGPT.calls++;
    window.sessionUsage.imageGPT.costUSD += cost;

    window.sessionUsage.costUSD =
      (window.sessionUsage.costUSD || 0) + cost;

    updateCostFooter?.();
  }

  removeTypingIndicator?.();
  saveHistory?.();
}
/* =========================================================
   Core Generation – GPT Image
   ========================================================= */
window.generateImageGPT = async function(prompt) {

  if (!window.imageGPTEngineState.active)
    return false;

  const api = getApiConfig();

  if (api.mode === "demo" || !api.apiKey) {
    addMessage?.("bot", "⚠️ Image GPT ist im Demo-Modus nicht verfügbar.");
    return "demo";
  }

  try {

    addTypingIndicator?.();

    const state = window.imageGPTEngineState;

	let res;
	let json;
/* =====================================================
   MODE: CREATE
===================================================== */
if (state.mode === "create") {

  /* =====================================================
     REQUEST BODY BUILD
  ===================================================== */
  const body = {
    model: state.model,
    prompt: prompt,
    size: state.size,
    quality: state.quality
  };

  if (state.output_format)
    body.output_format = state.output_format;

  if (state.background)
    body.background = state.background;

  if (state.output_compression != null) {
    const n = Number(state.output_compression);
    if (!Number.isNaN(n) && n >= 0 && n <= 100)
      body.output_compression = n;
  }

  /* =====================================================
     STREAM MODE
  ===================================================== */
if (state.stream) {

  body.stream = true;
  body.partial_images = state.partial_images ?? 0;

  res = await fetch(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok)
    throw new Error(`HTTP ${res.status}`);

  await handleImageStream(res, state);
  return true;
}

  /* =====================================================
     NORMAL MODE (NON-STREAM)
  ===================================================== */

  res = await fetch(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  json = await res.json();
}
	/* =====================================================
	MODE: EDIT / REFERENCE
	===================================================== */
	else {

	const files = state.input_images || [];

	if (!files.length) {
		removeTypingIndicator?.();
		showMaskHint("Bitte zuerst ein Bild auswählen.");
		return true;
	}

	if (state.mode === "edit" && files.length > 1) {
		removeTypingIndicator?.();
		showMaskHint("Für „Bild ergänzen“ nur 1 Bild erlaubt.");
		return true;
	}

	const fd = new FormData();

	fd.append("model", state.model);
	fd.append("prompt", prompt);
	fd.append("size", state.size);
	fd.append("quality", state.quality);

	if (state.output_format)
		fd.append("output_format", state.output_format);

	if (state.background)
		fd.append("background", state.background);

	if (state.output_compression != null) {
		const n = Number(state.output_compression);
		if (!Number.isNaN(n) && n >= 0 && n <= 100) {
		fd.append("output_compression", String(n));
		}
	}

	if (state.fidelity_enabled && state.input_fidelity !== "low") {
		fd.append("input_fidelity", state.input_fidelity);
	}

	// 🟢 EDIT MODE
	if (state.mode === "edit") {

		fd.append("image[]", files[0]);

		// Mask optional
		if (state.mask_image) {
		fd.append("mask", state.mask_image);
		}

	}
	// 🟡 REFERENCE MODE
	else {
		files.forEach(file => fd.append("image[]", file));
	}

/* =====================================================
   STREAM MODE (EDIT / REFERENCE)
===================================================== */
if (state.stream) {

  fd.append("stream", "true");
  fd.append("partial_images", state.partial_images ?? 0);

  const streamRes = await fetch(
    "https://api.openai.com/v1/images/edits",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${api.apiKey}` },
      body: fd
    }
  );

  if (!streamRes.ok)
    throw new Error(`HTTP ${streamRes.status}`);

  await handleImageStream(streamRes, state);
  return true;
}

/* =====================================================
   NORMAL MODE (NON-STREAM)
===================================================== */

res = await fetch(
  "https://api.openai.com/v1/images/edits",
  {
    method: "POST",
    headers: { Authorization: `Bearer ${api.apiKey}` },
    body: fd
  }
);

json = await res.json();
	}

    removeTypingIndicator?.();

    /* ---------------------------------------------------------
       Fehler prüfen
    --------------------------------------------------------- */
    if (!res.ok) {
      throw new Error(
        json.error?.message || "Image GPT Fehler"
      );
    }
		/* 🔎 DEBUG – Usage Kontrolle 
		console.log("Image GPT usage:", {
			text_tokens: json.usage?.input_tokens_details?.text_tokens,
			image_tokens: json.usage?.output_tokens,
			total_tokens: json.usage?.total_tokens
		}); */
		/* ---------------------------------------------------------
			 COST TRACKING – Image GPT (Token Based)
		--------------------------------------------------------- */
		if (typeof calculateImageGPTCostUSD === "function" && json.usage) {

			const cost = calculateImageGPTCostUSD({
				model: state.model,
				usage: json.usage
			});

window._lastImageGPTUsage = json.usage;
window._lastImageGPTCost = cost;

			if (!window.sessionUsage.imageGPT) {
				window.sessionUsage.imageGPT = {
				  calls: 0,
				  costUSD: 0
				};
			}

			window.sessionUsage.imageGPT.calls++;
			window.sessionUsage.imageGPT.costUSD += cost;
			/* Gesamt Session Kosten */
			window.sessionUsage.costUSD =
				(window.sessionUsage.costUSD || 0) + cost;
			updateCostFooter?.();
		}
    else if (!json.usage) {
      console.warn("Image GPT: usage missing");
    }

    /* ---------------------------------------------------------
       Bilddaten (Base64)
    --------------------------------------------------------- */
    const imageData = json.data?.[0];

    if (!imageData?.b64_json) {
      throw new Error("Keine Bilddaten erhalten");
    }

    const imageSrc =
      "data:image/png;base64," +
      imageData.b64_json;

    renderImageGPTMessage(imageSrc);

    return true;

  }
  catch (err) {

    removeTypingIndicator?.();

    addMessage?.("bot","❌ Image GPT Fehler: " + (err.message || err));

    return true;
  }
};

/* Message Renderer (Bubble + Save Button) */
function renderImageGPTMessage(url) {

  const message = document.createElement("div");
  message.className = "message bot";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

	/* Timestamp sofort setzen */
	createMessageTimestamp(bubble);

  const img = document.createElement("img");
  img.src = url;
  img.className = "generated-image";
  bubble.appendChild(img);
  /* Scroll nach Bild-Render */
  img.addEventListener(
    "load",
    () => scrollToBottom?.(),
    { once: true }
  );

  const saveBtn = document.createElement("button");

  saveBtn.className = "img-save-btn";
  saveBtn.innerHTML = `<i class="fas fa-download"></i> Speichern`;
  saveBtn.title = "Im IndexedDB Speicher sichern";

/* ==============================
   DELETE BUTTON (initial hidden)
============================== */
const deleteBtn = document.createElement("button");
deleteBtn.className = "img-delete-btn";
deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Löschen`;
deleteBtn.title = "Aus IndexedDB löschen";
deleteBtn.hidden = true; // 🔥 erst sichtbar nach echtem DB Save

deleteBtn.onclick = async () => {

  try {

    const id = img.dataset.imageId;

    if (id) {
      await deleteImageFromDB(id);
    }

suppressAutoScroll = true;

bubble.innerHTML = "🗑️ Bild wurde gelöscht.";
saveHistory?.();

/* kleine Verzögerung → danach Scroll wieder erlauben */
setTimeout(() => {
  suppressAutoScroll = false;
}, 50);

  } catch (err) {

    addMessage?.(
      "bot",
      "❌ Bild konnte nicht gelöscht werden: " + (err?.message || err)
    );
  }
};

saveBtn.onclick = async () => {

  try {

    /* 1️⃣ Immer lokalen Download erlauben */
    const a = document.createElement("a");
    a.href = url;
    a.download = `image-${Date.now()}.png`;
    a.click();

    /* 2️⃣ Nur in IndexedDB speichern wenn noch nicht gespeichert */
    if (!img.dataset.imageId || img.dataset.imageId === "") {

      const id = "img_" + Date.now();

      await saveImageToDB(id, url);

      img.dataset.imageId = id;
      saveBtn.dataset.imageId = id;
/* Usage Button */
if (img._usageDataForModal) {
  img.dataset.imageUsage = JSON.stringify(img._usageDataForModal);
}
if (typeof img._usageCostForModal === "number") {
  img.dataset.imageCost = String(img._usageCostForModal);
}
if (img._usageCostLogForModal) {
  img.dataset.imageCostLog = img._usageCostLogForModal;
}
      deleteBtn.hidden = false; // 🔥 jetzt sichtbar
	  saveBtn.title = "Bereits im IndexedDB gespeichert";
      saveHistory?.();
    }

  } catch (err) {

    addMessage?.(
      "bot",
      "❌ Bild konnte nicht gespeichert werden: " + (err?.message || err)
    );
  }
};
  bubble.appendChild(saveBtn);
  bubble.appendChild(deleteBtn);

if (window._lastImageGPTUsage) {
  attachImageUsageButton(
    img,
    bubble,
    window._lastImageGPTUsage,
    window._lastImageGPTCost
  );
}

  attachImageExpandFeature(img, bubble);
  message.appendChild(label);
  message.appendChild(bubble);
  messages.appendChild(message);
  saveHistory?.();
  scrollToBottom?.();
}

/* =========================================================
   IMAGE API USAGE BUTTON
========================================================= */

function attachImageUsageButton(img, bubble, usage, cost) {

  if (!img || !bubble || !usage) return;

  img._usageDataForModal = usage;
  img._usageCostForModal = typeof cost === "number" ? cost : 0;
  img._usageCostLogForModal = window.lastImageGPTCostLog || "";

  /* Duplikate vermeiden */
  const existing = bubble.querySelector(".img-usage-btn");
  if (existing) {
    existing.innerHTML =
      `<i class="fas fa-coins"></i> $${img._usageCostForModal.toFixed(6)}`;
    return;
  }

  const usageBtn = document.createElement("button");
  usageBtn.className = "img-usage-btn";
  usageBtn.title = "Kostenberechnung";

  usageBtn.innerHTML =
    `<i class="fas fa-coins"></i> $${img._usageCostForModal.toFixed(6)}`;

  usageBtn.onclick = () => {

    const overlay = document.getElementById("imgUsageOverlay");
    const content = document.getElementById("imgUsageContent");
    const closeBtn = document.getElementById("imgUsageCloseBtn");
    const okBtn = document.getElementById("imgUsageOkBtn");

    if (!overlay || !content) return;

    const usageJson =
      JSON.stringify(img._usageDataForModal || usage, null, 2);

    const costLog =
      img.dataset.imageCostLog ||
      img._usageCostLogForModal ||
      window.lastImageGPTCostLog ||
      "";

    content.textContent =
      "usage:" + usageJson + "\n" + costLog;

    overlay.hidden = false;
    /* Close handling (nur einmal binden) */
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

  bubble.appendChild(usageBtn);
}
