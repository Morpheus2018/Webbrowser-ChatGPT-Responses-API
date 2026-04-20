/* =========================================================
   Mini Paint Mask Tool (Image GPT)
   - Opens inside Image GPT overlay panel
   - Draw = transparent (destination-out) => editable region
   - Erase = opaque black (source-over)   => protected region
   - Exports PNG mask (same size as original image!)
   ========================================================= */

window.paintMaskTool = (function () {
  "use strict";

  let panel, canvas, ctx;
  let brushInput, brushLabel;
  let overlayInput, overlayLabel;
  let statusLabel;

	let refreshBtn, saveMaskBtn, loadMaskBtn, maskFileInput;
	let lastBaseFile = null;

  let expandBtn;

  let toolDraw, toolErase, undoBtn, clearBtn, applyBtn;

  // Offscreen canvases (natural size)
  const imgCanvas = document.createElement("canvas");
  const imgCtx = imgCanvas.getContext("2d");

  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d");

  let naturalW = 0, naturalH = 0;
  let scale = 1;

  let drawing = false;
  let last = null;
  let history = [];
  let currentTool = "draw";
  let callback = null;

  let overlayOpacity = 0.5;
  let objectUrl = null;

  // optional status hook to outer UI (engine can set imgGPTMaskInfo etc.)
  let onStatus = null;

  function $(id) {
    return document.getElementById(id);
  }

  function isReady() {
    return !!(
      $("imgGPTPaintPanel") &&
      $("imgGPTPaintCanvas") &&
      $("imgGPTBrushSize") &&
      $("imgGPTOverlayOpacity") &&
      $("imgGPTMaskStatus")
    );
  }

  function init() {
    if (!isReady()) return;

    panel = $("imgGPTPaintPanel");
    canvas = $("imgGPTPaintCanvas");
    brushInput = $("imgGPTBrushSize");
    brushLabel = $("imgGPTBrushSizeLabel");
    overlayInput = $("imgGPTOverlayOpacity");
    overlayLabel = $("imgGPTOverlayLabel");
    statusLabel = $("imgGPTMaskStatus");

    toolDraw = $("imgGPTToolDraw");
    toolErase = $("imgGPTToolErase");
    undoBtn = $("imgGPTUndoBtn");
    clearBtn = $("imgGPTClearMaskBtn");
    applyBtn = $("imgGPTApplyMaskBtn");

		refreshBtn = $("imgGPTRefreshBaseBtn");
		saveMaskBtn = $("imgGPTSaveMaskBtn");
		loadMaskBtn = $("imgGPTLoadMaskBtn");
		maskFileInput = $("imgGPTMaskFileInput");

		refreshBtn && (refreshBtn.onclick = refreshBaseImage);
		saveMaskBtn && (saveMaskBtn.onclick = saveMaskToFile);
		loadMaskBtn && (loadMaskBtn.onclick = () => maskFileInput?.click());
		maskFileInput && maskFileInput.addEventListener("change", handleMaskUpload);

		expandBtn = $("imgGPTExpandPaintBtn");
		expandBtn && (expandBtn.onclick = toggleExpand);

    ctx = canvas.getContext("2d");

    brushInput?.addEventListener("input", () => {
      if (brushLabel) brushLabel.textContent = brushInput.value + "px";
    });

    overlayInput?.addEventListener("input", () => {
      overlayOpacity = Number(overlayInput.value) / 100;
      if (overlayLabel) overlayLabel.textContent = overlayInput.value + "%";
      redraw();
    });

    toolDraw && (toolDraw.onclick = () => setTool("draw"));
    toolErase && (toolErase.onclick = () => setTool("erase"));
    undoBtn && (undoBtn.onclick = undo);
    clearBtn && (clearBtn.onclick = resetMask);
    applyBtn && (applyBtn.onclick = applyMask);

    // Mouse
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", drawMove);
    window.addEventListener("mouseup", stopDraw);

    // Touch
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", drawMove, { passive: false });
    window.addEventListener("touchend", stopDraw);

    // Defaults
    setTool("draw");
    resetStatus();
  }

  function setTool(tool) {
    currentTool = tool;
    toolDraw?.classList.toggle("active", tool === "draw");
    toolErase?.classList.toggle("active", tool === "erase");
  }

  function show() {
    if (panel) panel.hidden = false;
  }

  function hide() {
    if (panel) panel.hidden = true;
  }

  function close() {
    hide();
    callback = null;
    onStatus = null;
    drawing = false;
    last = null;
    history = [];
    // do not wipe mask automatically; leaving state is ok, but we release URL
    cleanupObjectUrl();
    resetStatus();
  }

  function isOpen() {
    return !!panel && !panel.hidden;
  }

  function resetStatus() {
    if (statusLabel) {
      statusLabel.textContent = "Keine Maske";
      statusLabel.style.color = "";
    }
  }

  function setStatus(text, ok = false) {
    if (statusLabel) {
      statusLabel.textContent = text;
      statusLabel.style.color = ok ? "#4caf50" : "";
    }
    onStatus?.(text, ok);
  }

  function cleanupObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      objectUrl = null;
    }
  }

  function open(file, cb, opts = {}) {
    if (!file) {
      setStatus("⚠️ Kein Bild geladen");
      return;
    }
    lastBaseFile = file;
    callback = cb;
    onStatus = typeof opts.onStatus === "function" ? opts.onStatus : null;

    show();
    resetStatus();
    setTool("draw");

    // clean previous URL
    cleanupObjectUrl();

    const img = new Image();
    img.onload = () => {
      naturalW = img.naturalWidth;
      naturalH = img.naturalHeight;

      // Prepare offscreen canvases at natural size
      imgCanvas.width = naturalW;
      imgCanvas.height = naturalH;
      maskCanvas.width = naturalW;
      maskCanvas.height = naturalH;

      // IMPORTANT: clear before drawing (fixes stale pixels)
      imgCtx.clearRect(0, 0, naturalW, naturalH);
      imgCtx.drawImage(img, 0, 0);

      resetMask(); // sets mask to opaque black

			// Fit visible canvas into available container (contain: fit width AND height)
			const container = canvas?.parentElement; // .paint-canvas-container
			const panelPadding = 20;

			const maxW = Math.max(100, (container?.clientWidth || panel?.clientWidth || 600) - 0);

			// max-height aus CSS lesen (z.B. 420px), fallback 420
			let maxH = 420;
			if (container) {
				const cs = getComputedStyle(container);
				const mh = parseFloat(cs.maxHeight);
				if (!Number.isNaN(mh) && mh > 0) maxH = mh;
			}

			// scale so that BOTH dimensions fit
			scale = Math.min(1, maxW / naturalW, maxH / naturalH);

			canvas.width  = Math.max(1, Math.round(naturalW * scale));
			canvas.height = Math.max(1, Math.round(naturalH * scale));

      redraw();
      cleanupObjectUrl();
    };

    img.onerror = () => {
      setStatus("❌ Bild konnte nicht geladen werden");
      cleanupObjectUrl();
    };

    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  }

  function resetMask() {
    if (!naturalW || !naturalH) return;

    history = [];
    maskCtx.globalCompositeOperation = "source-over";
    maskCtx.clearRect(0, 0, naturalW, naturalH);
    maskCtx.fillStyle = "rgba(0,0,0,1)";
    maskCtx.fillRect(0, 0, naturalW, naturalH);

    redraw();
    setStatus("Keine Maske");
  }

  function redraw() {
    if (!ctx || !canvas.width || !canvas.height) return;
    if (!naturalW || !naturalH) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Base image
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(imgCanvas, 0, 0, canvas.width, canvas.height);

    // Overlay mask visualization (red tint where mask is opaque)
    if (overlayOpacity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(255,0,0,${overlayOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // keep overlay only where mask is opaque
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  function pointToNatural(evt) {
    const rect = canvas.getBoundingClientRect();
    const t = (evt.touches && evt.touches[0]) ? evt.touches[0] : null;
    const clientX = t ? t.clientX : evt.clientX;
    const clientY = t ? t.clientY : evt.clientY;

    // map visible canvas px -> natural px
    const xVis = clientX - rect.left;
    const yVis = clientY - rect.top;

    return {
      x: xVis / scale,
      y: yVis / scale
    };
  }

  function startDraw(e) {
    if (!naturalW || !naturalH) return;
    e.preventDefault();

    drawing = true;

    // Push undo snapshot
    try {
      history.push(maskCtx.getImageData(0, 0, naturalW, naturalH));
      if (history.length > 25) history.shift();
    } catch {
      // if image is huge, getImageData can be heavy; ignore if it fails
    }

    last = pointToNatural(e);
    drawSegment(last, last);
    redraw();
  }

  function drawMove(e) {
    if (!drawing || !naturalW || !naturalH) return;
    e.preventDefault();

    const p = pointToNatural(e);
    drawSegment(last, p);
    last = p;
    redraw();
  }

  function stopDraw() {
    drawing = false;
    last = null;
  }

  function drawSegment(a, b) {
    if (!a || !b) return;

    const w = Number(brushInput?.value || 25);

    maskCtx.save();
    maskCtx.globalCompositeOperation =
      currentTool === "draw" ? "destination-out" : "source-over";

    maskCtx.lineWidth = w;
    maskCtx.lineCap = "round";
    maskCtx.strokeStyle = "rgba(0,0,0,1)";
    maskCtx.beginPath();
    maskCtx.moveTo(a.x, a.y);
    maskCtx.lineTo(b.x, b.y);
    maskCtx.stroke();
    maskCtx.restore();
  }

  function undo() {
    if (!history.length || !naturalW || !naturalH) return;
    const lastState = history.pop();
    if (!lastState) return;
    maskCtx.putImageData(lastState, 0, 0);
    redraw();
  }

  function applyMask() {
    if (!naturalW || !naturalH) {
      setStatus("⚠️ Kein Bild geladen");
      return;
    }

    // IMPORTANT: export natural-sized maskCanvas
    maskCanvas.toBlob((blob) => {
      if (!blob) {
        setStatus("❌ Maske Export fehlgeschlagen");
        return;
      }

      const file = new File([blob], `mask-${Date.now()}.png`, { type: "image/png" });
      callback?.(file);

      // stays visible (as you want)
      setStatus("Maskierter Bereich übernommen", true);
    }, "image/png");
  }


	function refreshBaseImage() {
		const paintItem = document.querySelector(
		  '.imggpt-item[data-type="mask_action"][data-value="paint"]'
		);

		if (!paintItem) {
		  setStatus("⚠️ Paint-Option nicht gefunden");
		  return;
		}

		const showOk = () => setStatus("Basisbild aktualisiert", true);

		if (paintItem.classList.contains("active")) {
		  paintItem.click(); // OFF
		  requestAnimationFrame(() => {
		    paintItem.click(); // ON
		    requestAnimationFrame(showOk); // Status NACH dem Open/Reset
		  });
		} else {
		  paintItem.click(); // ON
		  requestAnimationFrame(showOk);
		}
	}

	function saveMaskToFile() {
		if (!naturalW || !naturalH) {
		  setStatus("⚠️ Keine Maske vorhanden");
		  return;
		}

		maskCanvas.toBlob((blob) => {
		  if (!blob) {
		    setStatus("❌ Speichern fehlgeschlagen");
		    return;
		  }

		  const url = URL.createObjectURL(blob);
		  const a = document.createElement("a");
		  a.href = url;
		  a.download = `mask-${Date.now()}.png`;
		  a.click();
		  URL.revokeObjectURL(url);

		  setStatus("Maske gespeichert", true);
		}, "image/png");
	}

	function handleMaskUpload(e) {
		const file = e.target.files[0];
		if (!file) return;

		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
		  if (img.width !== naturalW || img.height !== naturalH) {
		    setStatus("❌ Maskengröße passt nicht zum Basisbild");
		    URL.revokeObjectURL(url);
		    return;
		  }

		  maskCtx.clearRect(0, 0, naturalW, naturalH);
		  maskCtx.drawImage(img, 0, 0);
		  redraw();

		  setStatus("Maske geladen", true);
		  URL.revokeObjectURL(url);
		};

		img.onerror = () => {
		  setStatus("❌ Ungültige Maskendatei");
		  URL.revokeObjectURL(url);
		};

		img.src = url;
	}

	function toggleExpand() {
		if (!panel) return;

		panel.classList.toggle("expanded");

		// Canvas neu skalieren (damit größere Höhe genutzt wird)
		if (naturalW && naturalH) {
		  const container = canvas.parentElement;

		  const maxW = container.clientWidth;
		  const cs = getComputedStyle(container);
		  const maxH = parseFloat(cs.maxHeight) || 420;

		  scale = Math.min(1, maxW / naturalW, maxH / naturalH);

		  canvas.width  = Math.round(naturalW * scale);
		  canvas.height = Math.round(naturalH * scale);

		  redraw();
		}
	}

  document.addEventListener("DOMContentLoaded", init);

  return {
    open,
    show,
    hide,
    close,
    isOpen,
    resetStatus
  };
})();
