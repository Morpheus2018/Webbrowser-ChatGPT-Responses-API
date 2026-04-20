/* =========================================================
   Model Manager – UI & Steuerung
   Abhängigkeiten:
   - #modelSelect (hidden select)
   - window.API_PRICING (api_costs.js)
   - window.sessionUsage (script.js)
   ========================================================= */

(function () {

  /* ---------------------------------------------------------
     Modell-Metadaten (UI-Infos, KEINE Preise)
     --------------------------------------------------------- */
  const MODEL_DEFINITIONS = {
    "gpt-4o-mini": {
      label: "GPT-4o mini",
      context: "16K Tokens",
      year: 2024,
      capabilities: ["Text", "File", "Web", "Code"],
      api: "Responses API"
    },
    "gpt-4o": {
      label: "GPT-4o",
      context: "128K Tokens",
      year: 2024,
      capabilities: ["Text", "File", "Web", "Code"],
      api: "Responses API"
    },
    "gpt-4.1": {
      label: "GPT-4.1",
      context: "128K Tokens",
      year: 2025,
      capabilities: ["Text", "File", "Web", "Code"],
      api: "Responses API"
    },
    "gpt-4.1-mini": {
      label: "GPT-4.1 mini",
      context: "33K Tokens",
      year: 2025,
      capabilities: ["Text", "File", "Web", "Code"],
      api: "Responses API"
    },
    "gpt-5-nano": {
      label: "GPT-5 nano",
      context: "8K Tokens",
      year: 2025,
      capabilities: ["Text", "File", "Web", "Code", "Bild"],
      api: "Responses API"
    },
    "gpt-5": {
      label: "GPT-5",
      context: "128K Tokens",
      year: 2025,
      capabilities: ["Text", "File", "Web", "Code", "Bild"],
      api: "Responses API"
    },
    "gpt-5.2": {
      label: "GPT-5.2",
      context: "128K Tokens",
      year: 2025,
      capabilities: ["Text", "File", "Web", "Code", "Bild"],
      api: "Responses API"
    },
    "gpt-5.1-codex-mini": {
      label: "GPT-5.1 Codex mini",
      context: "128K Tokens",
      year: 2025,
      capabilities: ["Text", "File", "Web", "Code"],
      api: "Responses API"
    }
  };

  /* ---------------------------------------------------------
     DOM References
     --------------------------------------------------------- */
  const overlay = document.getElementById('modelManagerOverlay');
  const listEl = document.getElementById('mmList');
  const footerEl = document.getElementById('mmFooter');
  const closeBtn = document.getElementById('mmCloseBtn');
  const openBtn = document.getElementById('openModelManagerBtn');
  const activeLabelEl = document.getElementById('activeModelLabel');
  const modelSelect = document.getElementById('modelSelect');

  if (!overlay || !listEl || !footerEl || !modelSelect) {
    console.warn('[ModelManager] Required DOM elements missing');
    return;
  }

  /* ---------------------------------------------------------
     Helper
     --------------------------------------------------------- */
  function getActiveModel() {
    return modelSelect.value || 'gpt-4o-mini';
  }

  function setActiveModel(modelId) {
    modelSelect.value = modelId;
    modelSelect.dispatchEvent(new Event('change'));

    updateActiveLabel();
    renderFooter();
    renderList();
    close();
    focusUserInput(50);
  }

  function updateActiveLabel() {
    const def = MODEL_DEFINITIONS[getActiveModel()];
    if (activeLabelEl && def) {
      activeLabelEl.textContent = def.label;
    }
  }

  /* ---------------------------------------------------------
     Rendering
     --------------------------------------------------------- */
  function renderList() {
    listEl.innerHTML = '';

    const activeModel = getActiveModel();

    Object.entries(MODEL_DEFINITIONS).forEach(([id, def]) => {
      const pricing = window.API_PRICING?.[id];

      const isActive = id === activeModel;

      const stats = window.sessionUsage?.byModel?.[id] || {
        calls: 0,
        costUSD: 0
      };

      const item = document.createElement('div');
      item.className = 'mm-item' + (isActive ? ' active' : '');

      item.innerHTML = `
        <div class="mm-item-header">
          <div class="mm-item-title">
            ${def.label}
            ${isActive ? '<span class="mm-check">✓</span>' : ''}
          </div>
          <div class="mm-item-meta">
            ${def.context} · ${def.year}
          </div>
        </div>

        <div class="mm-capabilities">
          ${def.capabilities.map(c => `<span class="mm-badge">${c}</span>`).join('')}
        </div>

        <div class="mm-pricing">
          Input: $${pricing?.input ?? '–'} /
          Output: $${pricing?.output ?? '–'} <span>(pro 1M)</span>
        </div>

		<div class="mm-session">
		  Calls: ${stats.calls}
		  · Kosten: $${stats.costUSD.toFixed(6)}
		</div>
      `;

      item.addEventListener('click', () => {
        if (!isActive) setActiveModel(id);
      });

      listEl.appendChild(item);
    });
  }

	function renderFooter() {

		const def = MODEL_DEFINITIONS[getActiveModel()];
		if (!def) return;

		const imageCalls =
		  window.sessionUsage?.image?.calls ?? 0;

		const imageCost =
		  window.sessionUsage?.image?.costUSD ?? 0;

		const imageGPTCalls =
		  window.sessionUsage?.imageGPT?.calls ?? 0;

		const imageGPTCost =
		  window.sessionUsage?.imageGPT?.costUSD ?? 0;

		const imageToolCalls =
		  window.sessionUsage?.imageTool?.calls ?? 0;

		const imageToolCost =
		  window.sessionUsage?.imageTool?.costUSD ?? 0;

const videoCalls =
  window.sessionUsage?.video?.calls ?? 0;

const videoCost =
  window.sessionUsage?.video?.costUSD ?? 0;

		/* Dynamische Blöcke */
		const imageGPTBlock =
		  imageGPTCalls > 0
		    ? `<br><strong>Image API:</strong>
		       ${imageGPTCalls} · $${imageGPTCost.toFixed(6)}`
		    : ``;

		const imageDalleBlock =
		  imageCalls > 0
		    ? `<br><strong>Image DALL·E:</strong>
		       ${imageCalls} · $${imageCost.toFixed(6)}`
		    : ``;
		const imageToolBlock =
		  imageToolCalls > 0
		    ? `<br><strong>Image Tool API:</strong>
		       ${imageToolCalls} · $${imageToolCost.toFixed(6)}`
		    : ``;
const videoBlock =
  videoCalls > 0
    ? `<br><strong>Video API:</strong>
       ${videoCalls} · $${videoCost.toFixed(6)}`
    : ``;

		footerEl.innerHTML = `
		  <div>
		    <strong>Aktuell:</strong> ${def.label}<br>
		    <strong>Max:</strong> ${def.context}<br>
		    <strong>API:</strong> ${def.api}
		    ${imageGPTBlock}
		    ${imageDalleBlock}
		    ${imageToolBlock}
${videoBlock}
		  </div>

		  <div>
		    <strong>Session:</strong>
		    $${(window.sessionUsage?.costUSD ?? 0).toFixed(6)}
		  </div>
		`;
	}


  /* ---------------------------------------------------------
     Open / Close
     --------------------------------------------------------- */
  function open() {
    renderList();
    renderFooter();
    overlay.hidden = false;
  }

  function close() {
    overlay.hidden = true;
	  focusUserInput(50);
  }

  /* ---------------------------------------------------------
     Events
     --------------------------------------------------------- */
	if (openBtn) {
		openBtn.addEventListener('click', (e) => {
		  e.preventDefault();
		  e.stopPropagation();

		  if (overlay.hidden) {
		    open();
		  } else {
		    close();
		  }
		});
	}

  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay.hidden && e.key === 'Escape') close();
  });

  /* ---------------------------------------------------------
   Sync mit modelSelect
   --------------------------------------------------------- */
  modelSelect.addEventListener('change', () => {
    updateActiveLabel();
  });
  /* =========================================================
     Externe Sync-Funktion (für script.js)
     ========================================================= */
  window.renderModelManager = function () {
    renderList();
    renderFooter();
  };

})();



