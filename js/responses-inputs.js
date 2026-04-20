/* =========================================================
   Responses Inputs Manager
   Supports:
   - input_image
   - input_file (PDF only)
   - Activation UI
   - Confirm deactivate
   - UX integration
   ========================================================= */


/* =========================================================
   GLOBAL STATE
   ========================================================= */

window.pendingInputs = window.pendingInputs || [];
window.pendingInputsMeta = window.pendingInputsMeta || [];

window.inputAnalysisState = {
  image: false,
  file: false,
  count: 0
};


/* =========================================================
   UX HELPERS
   ========================================================= */

function closeToolsDropdown() {
  const dropdown = document.getElementById('toolsDropdown');
  if (dropdown) dropdown.hidden = true;
}

function focusUserInput() {
  const input = document.getElementById('userInput');
  if (input) input.focus();
}

function closeToolsDropdownAndFocusInput() {
  closeToolsDropdown();
  focusUserInput();
}
/* =========================================================
   Bubble Attachments for input_image / input_file
   ========================================================= */

function getInputDisableMessage(kind) {
  return kind === "image"
    ? "🖼️ Bild Analyse deaktiviert."
    : "📎 Datei Analyse deaktiviert.";
}

function removeInputBubbleAttachments(kind = null, fileId = null) {
  document
    .querySelectorAll(".input-analysis-file")
    .forEach(el => {
      const sameKind =
        !kind || el.dataset.inputKind === kind;

      const sameFile =
        !fileId || el.dataset.fileId === fileId;

      if (sameKind && sameFile) {
        el.remove();
      }
    });
}

function attachPendingInputBubble(kind, fileName, fileId) {

  const lastMsg = messages.lastElementChild;
  const bubble = lastMsg?.querySelector(".bubble");

  if (!bubble) return;

  const wrapper = document.createElement("div");
  wrapper.className = "input-analysis-file";
  wrapper.dataset.inputKind = kind;
  wrapper.dataset.fileId = fileId || "";

  wrapper.innerHTML = `
    <span class="input-analysis-file-name">${fileName}</span>
    <button type="button" class="input-analysis-file-remove" title="Entfernen">
      <i class="fas fa-xmark"></i>
    </button>
  `;

  const removeBtn =
    wrapper.querySelector(".input-analysis-file-remove");

  removeBtn.onclick = () => {
    const index = window.pendingInputsMeta.findIndex(
      x => x.file_id === fileId
    );

    if (index !== -1) {
      removePendingInputByIndex(index);
    }
  };

  bubble.appendChild(wrapper);
}
/* =========================================================
   Preview Bar Rendering
   ========================================================= */

function renderInputPreviewBar() {

  const bar =
    document.getElementById("inputPreviewBar");

  if (!bar) return;

  const meta =
    window.pendingInputsMeta || [];

  if (!meta.length) {

    bar.hidden = true;
    bar.innerHTML = "";

    return;
  }

  bar.hidden = false;

  bar.innerHTML = meta.map((item, index) => {

    const icon =
      item.type === "image"
        ? "fas fa-image"
        : "fas fa-file-pdf";

    return `
      <div class="input-preview-item">
        <i class="${icon}"></i>
        <span>${item.file_name}</span>
        <i class="fas fa-xmark input-preview-remove"
           data-index="${index}">
        </i>
      </div>
    `;

  }).join("");

  /* remove handler */

  bar.querySelectorAll(".input-preview-remove")
    .forEach(btn => {

      btn.onclick = () => {

        const index =
          Number(btn.dataset.index);

        removePendingInputByIndex(index);

      };

    });

}

/* =========================================================
   UPDATE TOOLS BUTTON UI
   ========================================================= */

function updateInputToolsButtonUI() {

  const btn = document.getElementById('toolsMenuBtn');
  if (!btn) return;

  const state = window.inputAnalysisState;

  if (!state.image && !state.file) {

    btn.classList.remove('active');

    btn.innerHTML =
      `<i class="fas fa-wrench"></i> Tools`;

    return;
  }

  btn.classList.add('active');

  if (state.count === 1 && state.image) {

    btn.innerHTML =
      `<i class="fas fa-image"></i> Bild Analyse aktiviert`;

  }
  else if (state.count === 1 && state.file) {

    btn.innerHTML =
      `<i class="fas fa-file"></i> Datei Analyse aktiviert`;

  }
  else {

    btn.innerHTML =
      `<i class="fas fa-layer-group"></i> Analyse aktiviert (${state.count})`;
  }
}

/* =========================================================
   REMOVE INPUTS
   ========================================================= */

function removePendingInputsByType(kind) {

  const apiType =
    kind === "image"
      ? "input_image"
      : "input_file";

  window.pendingInputs =
    window.pendingInputs.filter(x => x.type !== apiType);

  window.pendingInputsMeta =
    window.pendingInputsMeta.filter(x => x.type !== kind);

  const hasImage =
    window.pendingInputsMeta.some(x => x.type === "image");

  const hasFile =
    window.pendingInputsMeta.some(x => x.type === "file");

  window.inputAnalysisState.image = hasImage;
  window.inputAnalysisState.file = hasFile;

  window.inputAnalysisState.count =
    (hasImage ? 1 : 0) +
    (hasFile ? 1 : 0);

  updateInputToolsButtonUI();

  removeInputBubbleAttachments(kind);

  addMessage("bot", getInputDisableMessage(kind));
}
/* =========================================================
   Remove Funktion
   ========================================================= */
function removePendingInputByIndex(index) {

  const meta =
    window.pendingInputsMeta[index];

  if (!meta) return;

  const apiType =
    meta.type === "image"
      ? "input_image"
      : "input_file";

  const fileId =
    meta.file_id;

  const kind =
    meta.type;

  window.pendingInputs =
    window.pendingInputs.filter(
      x => !(x.type === apiType && x.file_id === fileId)
    );

  window.pendingInputsMeta.splice(index, 1);

  const hasImage =
    window.pendingInputsMeta.some(x => x.type === "image");

  const hasFile =
    window.pendingInputsMeta.some(x => x.type === "file");

  window.inputAnalysisState.image = hasImage;
  window.inputAnalysisState.file = hasFile;
  window.inputAnalysisState.count =
    (hasImage ? 1 : 0) +
    (hasFile ? 1 : 0);

  updateInputToolsButtonUI();

  removeInputBubbleAttachments(kind, fileId);

  addMessage("bot", getInputDisableMessage(kind));
}
/* =========================================================
   ADD IMAGE INPUT
   ========================================================= */

window.addImageInput = async function(file, apiKey) {

  if (!file || !apiKey) return;

  const name = file.name || "Unbekannt";

  try {

    const form = new FormData();

    form.append("file", file);
    form.append("purpose", "vision");

    const res = await fetch(
      "https://api.openai.com/v1/files",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form
      }
    );

    const data = await res.json();

    if (!res.ok || !data?.id) {

      addMessage(
        "bot",
        `❌ Das Bild "${name}" konnte nicht verarbeitet werden.\nBitte ein gültiges Bild (PNG, JPG, WEBP) auswählen.`
      );

      return;
    }

    window.pendingInputs.push({
      type: "input_image",
      file_id: data.id
    });

    window.pendingInputsMeta.push({
      file_id: data.id,
      file_name: name,
      type: "image"
    });

    window.inputAnalysisState.image = true;
    window.inputAnalysisState.count++;

    updateInputToolsButtonUI();
    /*   renderInputPreviewBar(); */

    addMessage(
      "bot",
      `🖼️ Bild hinzugefügt: ${name}`
    );
    attachPendingInputBubble("image", name, data.id);
    closeToolsDropdownAndFocusInput();

  }
  catch {

    addMessage(
      "bot",
      `❌ Das Bild "${name}" konnte nicht verarbeitet werden.`
    );
  }
};


/* =========================================================
   ADD FILE INPUT (PDF ONLY)
   ========================================================= */

window.addFileInput = async function(file, apiKey) {

  if (!file || !apiKey) return;

  const name = file.name || "Unbekannt";

  const ext =
    name.split('.').pop().toLowerCase();

  if (ext !== "pdf") {

    addMessage(
      "bot",
      `❌ Die hochgeladene Datei "${name}" wird mit diesem Format nicht unterstützt.\nBitte eine PDF-Datei verwenden.`
    );

    return;
  }

  try {

    const form = new FormData();

    form.append("file", file);
    form.append("purpose", "assistants");

    const res = await fetch(
      "https://api.openai.com/v1/files",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form
      }
    );

    const data = await res.json();

    if (!res.ok || !data?.id) {

      addMessage(
        "bot",
        `❌ Die Datei "${name}" konnte nicht verarbeitet werden.\nBitte eine PDF-Datei verwenden.`
      );

      return;
    }

    window.pendingInputs.push({
      type: "input_file",
      file_id: data.id
    });

    window.pendingInputsMeta.push({
      file_id: data.id,
      file_name: name,
      type: "file"
    });

    window.inputAnalysisState.file = true;
    window.inputAnalysisState.count++;

    updateInputToolsButtonUI();
    /*   renderInputPreviewBar(); */

    addMessage(
      "bot",
      `📎 Datei hinzugefügt: ${name}`
    );
    attachPendingInputBubble("file", name, data.id);

    closeToolsDropdownAndFocusInput();

  }
  catch {

    addMessage(
      "bot",
      `❌ Fehler beim Hochladen der Datei "${name}".`
    );
  }
};

/* =========================================================
   PROVIDE INPUTS TO API
   ========================================================= */

window.getPendingInputs = function() {

  const inputs =
    [...window.pendingInputs];

  window.pendingInputs = [];
  window.pendingInputsMeta = [];

  window.inputAnalysisState.image = false;
  window.inputAnalysisState.file = false;
  window.inputAnalysisState.count = 0;

  updateInputToolsButtonUI();
  removeInputBubbleAttachments();

  return inputs;
};


/* =========================================================
   UI INTEGRATION
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const toolsBtn =
    document.getElementById('toolsMenuBtn');

  const imageBtn =
    document.getElementById('imageAnalyzeBtn');

  const fileBtn =
    document.getElementById('fileAnalyzeBtn');

  const imageInput =
    document.getElementById('imageInput');

  const fileInput =
    document.getElementById('fileInput');


  /* IMAGE BUTTON */

  if (imageBtn && imageInput) {

    imageBtn.addEventListener('click', () => {

      closeToolsDropdown();

      imageInput.click();

    });

    imageInput.addEventListener('change', async () => {

      const file = imageInput.files?.[0];
      if (!file) return;

      const api = getApiConfig();

      if (!api.apiKey) {
        addMessage('bot', '❌ Kein API-Key verfügbar');
        return;
      }

      await window.addImageInput(file, api.apiKey);

      imageInput.value = "";

    });

  }


  /* FILE BUTTON */

  if (fileBtn && fileInput) {

    fileBtn.addEventListener('click', () => {

      closeToolsDropdown();

      fileInput.click();

    });

    fileInput.addEventListener('change', async () => {

      const file = fileInput.files?.[0];
      if (!file) return;

      const api = getApiConfig();

      if (!api.apiKey) {
        addMessage('bot', '❌ Kein API-Key verfügbar');
        return;
      }

      await window.addFileInput(file, api.apiKey);

      fileInput.value = "";

    });

  }


  /* TOOLS BUTTON CONFIRM */

  if (toolsBtn) {

    toolsBtn.addEventListener('click', async (e) => {

      const state = window.inputAnalysisState;

      if (!state.image && !state.file)
        return;

      e.preventDefault();
      e.stopPropagation();

      closeToolsDropdown();

      if (state.image && !state.file) {

        const result =
          await customConfirm(
            'Bilder Analyse deaktivieren?',
            {
              title: 'Input Image',
              icon: 'fas fa-image',
              okText: 'Ja, deaktivieren',
              extraText: 'Neue Bilder'
            }
          );

        if (result === false) return;

        if (result === 'extra') {
          imageInput.click();
          return;
        }

        removePendingInputsByType("image");

        focusUserInput();

        return;
      }


      if (state.file && !state.image) {

        const result =
          await customConfirm(
            'Datei Analyse deaktivieren?',
            {
              title: 'Input File',
              icon: 'fas fa-file',
              okText: 'Ja, deaktivieren',
              extraText: 'Neue PDF'
            }
          );

        if (result === false) return;

        if (result === 'extra') {
          fileInput.click();
          return;
        }

        removePendingInputsByType("file");

        focusUserInput();

        return;
      }

    }, true);

  }

});

