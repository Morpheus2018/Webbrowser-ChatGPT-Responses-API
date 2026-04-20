/* =========================================================
   GLOBAL MARKDOWN + CODE RENDERER
   - Vollständiges Markdown
   - Syntax Highlight
   - Sichere Links
========================================================= */

window.renderFormattedContent = function (container, text) {

  if (!container) return;

  container.innerHTML = "";

  if (!text) return;

  // Markdown → HTML
  let html = text;

  if (window.marked) {

    html = marked.parse(text, {
      breaks: true,
      gfm: true
    });

  } else {
    html = text.replace(/\n/g, "<br>");
  }

  container.innerHTML = html;

  /* Links sicher & klickbar */
  container.querySelectorAll("a").forEach(a => {

    a.target = "_blank";
    a.rel = "noopener noreferrer";

  });

  /* Syntax Highlight */
  if (window.hljs) {

    container.querySelectorAll("pre code")
      .forEach(block => hljs.highlightElement(block));

  }
enhanceCodeBlocks(container);

};
/* =========================================================
   CODE BLOCK HEADER
========================================================= */
function enhanceCodeBlocks(container) {

  container.querySelectorAll("pre code").forEach(code => {

    const pre = code.parentElement;

    /* Wrapper erstellen */
    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    /* Sprache erkennen */
    let lang = "code";

    const classMatch = code.className.match(/language-(\w+)/);
    if (classMatch) lang = classMatch[1];

    /* Header */
    const header = document.createElement("div");
    header.className = "code-header";

    header.innerHTML = `
      <span class="code-lang">${lang}</span>
      <button class="code-copy-btn" title="Code kopieren">
        <i class="fas fa-copy"></i>
      </button>
    `;

    wrapper.appendChild(header);

    /* Copy Funktion */
    const btn = header.querySelector(".code-copy-btn");

btn.onclick = async () => {

  const text = code.textContent;

  try {

    if (navigator.clipboard && window.isSecureContext) {

      await navigator.clipboard.writeText(text);

    } else {

      /* Fallback für HTTP */
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      document.execCommand("copy");

      textarea.remove();
    }

    btn.innerHTML = `<i class="fas fa-check"></i>`;

    setTimeout(() => {
      btn.innerHTML = `<i class="fas fa-copy"></i>`;
    }, 2000);

  } catch (err) {

    console.error(err);
    alert("Kopieren fehlgeschlagen");

  }
};

  });
}

