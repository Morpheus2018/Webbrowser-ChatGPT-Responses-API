/* =========================================================
   OpenAI API Pricing – Unified Cost Engine
   Quelle: https://platform.openai.com/docs/pricing
   Unterstützt:
   - Text Token Preise
   - Image Token Preise
   - Image Generation Preise
   - Tool / Web Search, File search Preise
   - Robuste Model-Suffix Normalisierung
   ========================================================= */

/* ---------------------------------------------------------
   TEXT TOKEN PRICING (USD / 1M Tokens)
   --------------------------------------------------------- */
window.API_PRICING_TEXT = {
  "gpt-5.2": { input: 1.75, cached: 0.175, output: 14.0 },
  "gpt-5.1": { input: 1.25, cached: 0.125, output: 10.0 },
  "gpt-5": { input: 1.25, cached: 0.125, output: 10.0 },
  "gpt-5-nano": { input: 0.05, cached: 0.005, output: 0.40 },
  "gpt-5.1-codex-mini": { input: 0.25, cached: 0.025, output: 2.0 },

  "gpt-4.1": { input: 2.0, cached: 0.5, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, cached: 0.1, output: 1.6 },

  "gpt-4o": { input: 2.5, cached: 1.25, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, cached: 0.075, output: 0.6 }
};

/* ---------------------------------------------------------
   TEXT + IMAGE TOKEN PRICING (USD / 1M Tokens) – Image GPT
   --------------------------------------------------------- */
window.API_TEXT_IMAGE_TOKENS_PRICING = {
  "gpt-image-1.5": { input: 5.0, cached: 1.25, output: 10.0 },
  "gpt-image-1":   { input: 5.0, cached: 1.25, output: 0.0 },
  "gpt-image-1-mini": { input: 2.0, cached: 0.20, output: 0.0 }
};

/* ---------------------------------------------------------
   IMAGE TOKENS PRICING (USD / 1M Tokens) – Image GPT
   --------------------------------------------------------- */
window.API_IMAGE_TOKENS_PRICING = {
  "gpt-image-1.5": { input: 8.0, cached: 2.0, output: 32.0 },
  "gpt-image-1":   { input: 10.0, cached: 2.5, output: 40.0 },
  "gpt-image-1-mini": { input: 2.5, cached: 0.25, output: 8.0 }
};

/* ---------------------------------------------------------
   IMAGE GENERATION TOOL OUTPUT TOKENS (per image)
   Responses API tool: image_generation
   --------------------------------------------------------- */
window.API_PRICING_PER_IMAGE = {
  "1024x1024": { low: 272, medium: 1056, high: 4160 },
  "1024x1536": { low: 408, medium: 1584, high: 6240 },
  "1536x1024": { low: 400, medium: 1568, high: 6208 }
};

/* ---------------------------------------------------------
   TOOL / WEB SEARCH PRICING (USD per 1000 calls)
   --------------------------------------------------------- */
window.API_TOOL_PRICING = {
  webSearch: 10.0,
  fileSearch: 2.50
};
/* ---------------------------------------------------------
   VIDEO GENERATION PRICING (USD per second)
   --------------------------------------------------------- */
window.API_PRICING_VIDEO = {
  "sora-2": {
    "720x1280": 0.10,
    "1280x720": 0.10
  },
  "sora-2-pro": {
    "720x1280": 0.30,
    "1280x720": 0.30,
    "1024x1792": 0.50,
    "1792x1024": 0.50,
    "1080x1920": 0.70,
    "1920x1080": 0.70
  }
};

/* ---------------------------------------------------------
   LAST VIDEO COST STATE
   --------------------------------------------------------- */
window.lastVideoCost = Number(window.lastVideoCost || 0);
window.lastVideoCostLog = window.lastVideoCostLog || "";
/* ---------------------------------------------------------
   LAST RESPONSES IMAGE TOOL COST STATE
   --------------------------------------------------------- */
window.lastImageToolCostTotal =
  Number(window.lastImageToolCostTotal || 0);

window.lastImageToolCostLog =
  window.lastImageToolCostLog || "";
/* ---------------------------------------------------------
   IMAGE API GENERATION DALL·E PRICING (USD per image)
   --------------------------------------------------------- */
window.API_PRICING_DALLE = {
  "dall-e-2": {
    "256x256": 0.016,
    "512x512": 0.018,
    "1024x1024": 0.020
  },
  "dall-e-3": {
    standard: {
      "1024x1024": 0.040,
      "1024x1792": 0.080,
      "1792x1024": 0.080
    },
    hd: {
      "1024x1024": 0.080,
      "1024x1792": 0.120,
      "1792x1024": 0.120
    }
  }
};

/* ---------------------------------------------------------
   MODEL NORMALIZATION
   --------------------------------------------------------- */
function normalizeModelName(model) {
  if (!model) return null;

  const m = model.toLowerCase();
  

  // Modelle ohne Tokenkosten
  if (
    m.startsWith('dall-e') ||
    m.startsWith('text-embedding') ||
    m.startsWith('codex-mini-latest')
  ) {
    return null;
  }

  const known = [
   // GPT-5 Familie (wichtig: spezifisch vor allgemein!)
   'gpt-5.2',
   'gpt-5.1-codex-mini',
   'gpt-5.1',
   'gpt-5-nano',
   'gpt-5',

   // GPT-4o
   'gpt-4o-mini',
   'gpt-4o',

   // GPT-4.1
   'gpt-4.1-mini',
   'gpt-4.1'
  ];

  for (const base of known) {
    if (m.startsWith(base)) {
      return base;
    }
  }

  return null;
}

/* ---------------------------------------------------------
   MAIN COST CALCULATOR
   --------------------------------------------------------- */
window.calculateCostUSD = function({
  model,
  inputTokens = 0,
  outputTokens = 0,
  cachedInputTokens = 0,

  /* Image Tool / Image Billing */
  inputTextTokens = 0,
  outputTextTokens = 0,
  outputImageTokens = 0,

  toolUsage = {}
}) {

  const normalized = normalizeModelName(model);

  let cost = 0;
  /* Token cost */
  const pricing = window.API_PRICING_TEXT[normalized];

  if (pricing) {

    cost += (inputTokens / 1_000_000) * pricing.input;
    cost += (cachedInputTokens / 1_000_000) * pricing.cached;
    cost += (outputTokens / 1_000_000) * pricing.output;
  }
/* Image Costs Helper */
  function applyImageGenerationToolCost() {
    const meta = window.lastImageGenerationMeta || {};

    const modelImage = meta.model || "gpt-image-1.5";
    const quality = meta.quality || "low";
    const size = meta.size || "1024x1024";
    const images = Math.max(1, Number(meta.images || 1));

    const textPricing = window.API_PRICING_TEXT[normalized];
    const imagePricing = window.API_IMAGE_TOKENS_PRICING?.[modelImage];

    const textInputCost =
      textPricing
        ? (inputTokens / 1_000_000) * textPricing.input
        : 0;

    const textOutputCost =
      textPricing
        ? (outputTokens / 1_000_000) * textPricing.output
        : 0;

    const outputImageTokensPerImage =
      window.API_PRICING_PER_IMAGE?.[size]?.[quality] || 0;

    const totalImageOutputTokens =
      outputImageTokensPerImage * images;

    const imageOutputCostPerImage =
      imagePricing
        ? (outputImageTokensPerImage / 1_000_000) * imagePricing.output
        : 0;

    const totalImageOutputCost =
      imagePricing
        ? (totalImageOutputTokens / 1_000_000) * imagePricing.output
        : 0;

    /* Nur Image-Kosten addieren — Textkosten sind oben bereits enthalten */
    cost += totalImageOutputCost;

    const debugToolText =
`Responses Model: ${normalized || model}
Text Input Tokens: ${inputTokens} → $ ${textInputCost.toFixed(6)}
Text Output Tokens: ${outputTokens} → $ ${textOutputCost.toFixed(6)}

Image Model: ${modelImage}
Quality: ${quality}
Size: ${size}
Image Output Tokens: ${totalImageOutputTokens} → $ ${totalImageOutputCost.toFixed(6)}
Image Input Token: ?
Image Cached Token: ?
Image Intup Text Token: ?


Total Cost → $ ${cost.toFixed(6)}`;
  /* Für UI / Persistenz: Button soll GESAMTKOSTEN zeigen */
  window.lastImageToolCostTotal =
    Number(cost.toFixed(12));

  window.lastImageToolCostLog = debugToolText;

  console.log(debugToolText);

  if (window.lastImageGenerationMeta) {
    window.lastImageGenerationMeta.pendingCost = false;
}
  }

  /* Tool cost generisch */
  for (const tool in toolUsage) {
    const usage = toolUsage[tool];
    /* web_search */
    if (tool === 'web_search_call') {

      cost += (usage.calls / 1000) *
              window.API_TOOL_PRICING.webSearch;
    }
    /* file_search */
    if (tool === 'file_search_call') {

      cost += (usage.calls / 1000) *
              window.API_TOOL_PRICING.fileSearch;
    }

    /* image_generation */
/* image_generation (Responses API Tool) */
if (tool === 'image_generation_call') {
  applyImageGenerationToolCost();
}

  }
  if (
    window.lastImageGenerationMeta?.pendingCost === true &&
    !toolUsage?.image_generation_call
  ) {
    applyImageGenerationToolCost();
  }


  return Number(cost.toFixed(12));
};
/* ---------------------------------------------------------
   Calculate Cost – Video API
   --------------------------------------------------------- */
window.calculateVideoGenerationCostUSD = function({
  model,
  size,
  seconds
}) {
  const m = String(model || "").toLowerCase();
  const s = String(size || "").trim();
  const sec = Number(seconds || 0);

  if (!m || !s || !Number.isFinite(sec) || sec <= 0) {
    window.lastVideoCost = 0;
    window.lastVideoCostLog = "Video Cost: Missing or invalid input";
    return 0;
  }

  const pricePerSecond =
    window.API_PRICING_VIDEO?.[m]?.[s];

  if (!Number.isFinite(pricePerSecond)) {
    window.lastVideoCost = 0;
    window.lastVideoCostLog =
`Video Model: ${m}
Size: ${s}
Seconds: ${sec}
Price/sec: not found
Total Cost → $ 0.000000`;
    return 0;
  }

  const totalCost = pricePerSecond * sec;

  const debugText =
`Video Model: ${m}
Size: ${s}
Seconds: ${sec}
Price/sec: $ ${pricePerSecond.toFixed(2)}
Total Cost → $ ${totalCost.toFixed(6)}`;

  window.lastVideoCost = Number(totalCost.toFixed(12));
  window.lastVideoCostLog = debugText;

  console.log(debugText);

  return Number(totalCost.toFixed(12));
};

/* ---------------------------------------------------------
   Compatibility Layer for UI (Model Manager)
   --------------------------------------------------------- */
window.API_PRICING = window.API_PRICING_TEXT;

/* ---------------------------------------------------------
   IMAGE GENERATION COST RESOLVER (DALL·E)
   Unterstützt:
   - dall-e-2
   - dall-e-3
   --------------------------------------------------------- */
window.calculateImageGenerationCostUSD = function({
  model,
  size,
  quality
}) {
  if (!model) return 0;

  const m = model.toLowerCase();
  /* DALL·E 2 */
  if (m === "dall-e-2") {

    return window.API_PRICING_DALLE?.["dall-e-2"]?.[size] || 0;
  }
  /* DALL·E 3 */
  if (m === "dall-e-3") {

    const q = quality === "hd" ? "hd" : "standard";

    return window.API_PRICING_DALLE?.["dall-e-3"]?.[q]?.[size] || 0;
  }
  /* Zukunftssicher für neue Image Modelle */
  if (m.startsWith("gpt-image")) {
    return 0; // GPT Image wird separat berechnet
  }

  return 0;
};

/* ---------------------------------------------------------
   Calculate Cost – Image API (Token Based)
   Wichtig:
   - partial_images NICHT separat addieren
   - falls vorhanden: output_tokens_details bevorzugen
   - fallbacks für alte / reduzierte usage payloads
   --------------------------------------------------------- */
window.calculateImageGPTCostUSD = function ({ model, usage }) {

  if (!model || !usage) {
    console.log("Image GPT usage: Missing model or usage");
    return 0;
  }

  const m = model.toLowerCase();

  const textPricing = window.API_TEXT_IMAGE_TOKENS_PRICING[m];
  const imagePricing = window.API_IMAGE_TOKENS_PRICING[m];

  if (!textPricing || !imagePricing) {
    console.log("Image GPT usage: Pricing not found for model:", m);
    return 0;
  }

  /* ---------- INPUT TOKENS ---------- */
  const textInputTokens =
    usage?.input_tokens_details?.text_tokens ??
    usage?.input_text_tokens ??
    0;

  const cachedTextTokens =
    usage?.input_tokens_details?.cached_text_tokens ??
    usage?.input_cached_text_tokens ??
    usage?.cached_input_text_tokens ??
    0;

  const imageInputTokens =
    usage?.input_tokens_details?.image_tokens ??
    usage?.input_image_tokens ??
    0;

  const cachedImageTokens =
    usage?.input_tokens_details?.cached_image_tokens ??
    usage?.input_cached_image_tokens ??
    usage?.cached_input_image_tokens ??
    0;

  /* ---------- OUTPUT TOKENS ---------- */
  const outputTextTokens =
    usage?.output_tokens_details?.text_tokens ??
    usage?.output_text_tokens ??
    0;

  const outputImageTokens =
    usage?.output_tokens_details?.image_tokens ??
    usage?.output_image_tokens ??
    (
      typeof usage?.output_tokens === "number"
        ? Math.max(0, usage.output_tokens - outputTextTokens)
        : 0
    );

  /* ---------- COST CALCULATION ---------- */
  const textInputCost =
    (textInputTokens / 1_000_000) * textPricing.input;

  const cachedTextCost =
    (cachedTextTokens / 1_000_000) * textPricing.cached;

  const textOutputCost =
    (outputTextTokens / 1_000_000) * textPricing.output;

  const imageInputCost =
    (imageInputTokens / 1_000_000) * imagePricing.input;

  const cachedImageCost =
    (cachedImageTokens / 1_000_000) * imagePricing.cached;

  const imageOutputCost =
    (outputImageTokens / 1_000_000) * imagePricing.output;

  const totalCost =
    textInputCost +
    cachedTextCost +
    textOutputCost +
    imageInputCost +
    cachedImageCost +
    imageOutputCost;

	/* ---------- DEBUG LOG ---------- */

const debugText =
`
Model: ${m}
Text Input Tokens: ${textInputTokens} → $ ${textInputCost}
Cached Text Tokens: ${cachedTextTokens} → $ ${cachedTextCost}
Text Output Tokens: ${outputTextTokens} → $ ${textOutputCost}
Image Input Tokens: ${imageInputTokens} → $ ${imageInputCost}
Cached Image Tokens: ${cachedImageTokens} → $ ${cachedImageCost}
Image Output Tokens: ${outputImageTokens} → $ ${imageOutputCost}
Total Cost → $ ${totalCost.toFixed(12)}`;

	/* global verfügbar machen */
	window.lastImageGPTCostLog = debugText;

	/* weiterhin Console Log */
	console.log(debugText);

  return Number(totalCost.toFixed(12));
};

