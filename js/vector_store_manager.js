/* =========================================================
   Vector Store Manager – Info Panel
   ========================================================= */

let vsCurrentStoreId = null;
let vsCurrentFiles = [];
let vsStoresCache = [];

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('vectorStoreManagerBtn');
  const overlay = document.getElementById('vsOverlay');
  const closeBtn = document.getElementById('vsCloseBtn');

  if (!btn || !overlay) return;

  // ✅ Rechte Seite sofort anzeigen (auch ohne Store-Auswahl)
  renderManagePanel(null);

  btn.addEventListener('click', async () => {
    overlay.hidden = false;
    overlay.classList.add('show');

    document.getElementById('vsLeft').innerHTML = 'Lade Vector Stores...';
    await loadAllVectorStores();
  });

  closeBtn?.addEventListener('click', () => {
    overlay.classList.remove('show');
    overlay.hidden = true;
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show');
      overlay.hidden = true;
    }
  });
});

// ------------------------------
// API Helpers
// ------------------------------
async function fetchOpenAIFileMeta(fileId) {
  const api = getApiConfig();
  const res = await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
    headers: { 'Authorization': `Bearer ${api.apiKey}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (idx < items.length) {
      const current = idx++;
      try {
        results[current] = await mapper(items[current], current);
      } catch (_) {
        results[current] = items[current];
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  const kb = b / 1024;
  const mb = b / (1024 * 1024);
  return {
    bytes: b,
    kb: kb.toFixed(2),
    mb: mb.toFixed(3),
    human: `${b} Bytes (${kb.toFixed(2)} KB / ${mb.toFixed(3)} MB)`
  };
}
function formatBytesForVectorStore(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} Bytes`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function statusToBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'processed' || s === 'ready') return 'ok';
  if (s === 'in_progress' || s === 'processing' || s === 'queued') return 'warn';
  return 'err';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toastVs(msg, type = 'ok') {
  console.log('[VS]', type, msg);

  if (type === 'err' || type === 'warn') {
    // eigenes VS-Modal verwenden
    vsAlert(msg, type);
  }
}

// ------------------------------
// Stores (links)
// ------------------------------
async function loadAllVectorStores() {
  const api = getApiConfig();
  const left = document.getElementById('vsLeft');

  try {
    const res = await fetch('https://api.openai.com/v1/vector_stores', {
      headers: { 'Authorization': `Bearer ${api.apiKey}` }
    });
    const data = await res.json().catch(() => ({}));

    vsStoresCache = data.data || [];

    renderStoreList(vsStoresCache);

  } catch (e) {
    console.error(e);
    left.innerHTML = 'Fehler beim Laden der Vector Stores.';
    toastVs('Netzwerkfehler beim Laden der Vector Stores.', 'err');
  }
}

function renderStoreList(stores) {
  const left = document.getElementById('vsLeft');

  left.innerHTML = `
    <div class="vs-left-header">
      <span><i class="fas fa-list"></i> Alle Vector Stores</span>
      <button class="vs-refresh-btn" id="vsRefreshBtn">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>
    <div style="padding:0.6rem 0.9rem;font-size:0.8rem;">
      ✅ ${stores.length} Vector Stores vorhanden
    </div>
    <div class="vs-left-list" id="vsLeftList"></div>
  `;

  const list = document.getElementById('vsLeftList');

  stores.forEach(store => {
    const created = store.created_at ? new Date(store.created_at * 1000).toLocaleString() : '-';
const effectiveBytes = getEffectiveStoreBytes(store);
const sizeKB = (effectiveBytes / 1024).toFixed(2);
const sizeMB = (effectiveBytes / (1024 * 1024)).toFixed(3);

    const badgeClass =
      store.status === 'completed'
        ? 'ok'
        : store.status === 'in_progress'
          ? 'warn'
          : 'err';

    const card = document.createElement('div');
    card.className = 'vs-card';

    if (vsCurrentStoreId && store.id === vsCurrentStoreId) {
      card.classList.add('active');
    }

    card.innerHTML = `
      <div class="vs-topline">
        <div class="vs-id">${escapeHtml(store.id)}</div>
        <div class="vs-badge ${badgeClass}">${escapeHtml(store.status)}</div>
      </div>

      <div class="vs-info">
        <div><b>Name:</b> ${escapeHtml(store.name || '-')}</div>
        <div><b>Erstellt:</b> ${escapeHtml(created)}</div>
        <div><b>Store Größe:</b> ${sizeKB} KB (${sizeMB} MB)</div>
        <div><b>Dateien:</b> ${store.file_counts?.completed ?? 0} fertig,
             ${store.file_counts?.in_progress ?? 0} in Bearbeitung</div>
        <div><b>Löschung:</b> ${
          store.expires_after?.days
            ? `Nach ${store.expires_after.days} Tagen Inaktivität`
            : 'Nie'
        }</div>
        <div><b>Dateianzahl (total):</b> ${store.file_counts?.total ?? 0}</div>
      </div>
    `;

    card.addEventListener('click', async () => {
      document
        .querySelectorAll('#vsLeftList .vs-card')
        .forEach(c => c.classList.remove('active'));

      card.classList.add('active');
      vsCurrentStoreId = store.id;

      renderManagePanel(store);
      
      // Automatisch Dateien laden nach Store-Auswahl
      setTimeout(async () => {
        await loadVectorStoreFiles(store.id);
      }, 100);
    });

    list.appendChild(card);
  });

  document.getElementById('vsRefreshBtn')?.addEventListener('click', loadAllVectorStores);
}

// ------------------------------
// 🔄 Zentrale UI Synchronisation
// ------------------------------
async function syncUIAfterChange(storeId, updateLeft = true, updateRight = true, reloadFiles = false) {
  if (!storeId) return;

  if (reloadFiles) {
    await loadVectorStoreFiles(storeId);
    return;
  }

  if (updateLeft) {
    renderStoreList(vsStoresCache);
  }

  if (updateRight && storeId === vsCurrentStoreId) {
    const storeFromCache = vsStoresCache.find(s => s.id === storeId) || null;
    renderManagePanel(storeFromCache, { preserveFiles: true });
    renderFilesList(vsCurrentFiles);
    updateFilesMetaSummary(storeId, vsCurrentFiles);
  }
}

// ------------------------------
// Helper: Berechne Gesamtgröße der Dateien
// ------------------------------
function calculateTotalFileSize(files) {
  let totalBytes = 0;
  files.forEach(file => {
    totalBytes += getFileBytes(file);
  });
  return totalBytes;
}

// ------------------------------
// Helper: Aktualisiere usage_bytes im Cache
// ------------------------------
function updateStoreUsageInCache(storeId, totalBytes) {
  const store = vsStoresCache.find(s => s.id === storeId);
  if (store) {
    store.usage_bytes = totalBytes;
  }
  return store;
}
// ------------------------------
// Neuer Zentraler Helper
// ------------------------------
function getFileBytes(file) {
  const candidates = [
    file?.bytes,
    file?.usage_bytes,
    file?.size_bytes,
    file?.file_bytes,
    file?.chunking_strategy?.file_bytes,
    file?.attributes?.bytes,
    file?.attributes?.size,
    file?.attributes?.file_size,
    file?.file?.bytes,
    file?.file?.usage_bytes,
    file?.file?.size_bytes,
    file?.file?.file_bytes,
    file?.file?.attributes?.bytes,
    file?.file?.attributes?.size,
    file?.file?.attributes?.file_size
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) {
      return num;
    }
  }

  return 0;
}

function getEffectiveStoreBytes(store) {
  if (!store) return 0;

  if (
    vsCurrentStoreId &&
    store.id === vsCurrentStoreId &&
    Array.isArray(vsCurrentFiles) &&
    vsCurrentFiles.length
  ) {
    return calculateTotalFileSize(vsCurrentFiles);
  }

  return Number(store.usage_bytes) || 0;
}

function updateStoreFileCountsInCache(storeId, files) {
  const store = vsStoresCache.find(s => s.id === storeId);
  if (!store) return null;

  const completed = files.filter(f => {
    const s = String(f?.status || '').toLowerCase();
    return s === 'completed' || s === 'processed' || s === 'ready';
  }).length;

  const inProgress = files.filter(f => {
    const s = String(f?.status || '').toLowerCase();
    return s === 'in_progress' || s === 'processing' || s === 'queued';
  }).length;

  store.file_counts = store.file_counts || {};
  store.file_counts.total = files.length;
  store.file_counts.completed = completed;
  store.file_counts.in_progress = inProgress;
  store.file_counts.failed = Math.max(0, files.length - completed - inProgress);

  store.usage_bytes = calculateTotalFileSize(files);

  return store;
}

function updateStoreFieldsInCache(storeId, patch = {}) {
  const store = vsStoresCache.find(s => s.id === storeId);
  if (!store) return null;

  Object.assign(store, patch);
  return store;
}

function updateFilesMetaSummary(storeId, files) {
  const meta = document.getElementById('vsFilesMeta');
  if (!meta) return;

  if (!storeId) {
    meta.textContent = 'Keine Vector Store ausgewählt.';
    return;
  }

  if (!Array.isArray(files) || !files.length) {
    meta.textContent = '✅ Keine Dateien vorhanden';
    return;
  }

  meta.textContent = `✅ ${files.length} Dateien vorhanden`;
}

function refreshStoreViews(storeId, { preserveFiles = true } = {}) {
  const activeStore = vsStoresCache.find(s => s.id === storeId) || null;

  renderStoreList(vsStoresCache);

  if (storeId && storeId === vsCurrentStoreId) {
    renderManagePanel(activeStore, { preserveFiles });

    if (preserveFiles) {
      renderFilesList(vsCurrentFiles);
      updateFilesMetaSummary(storeId, vsCurrentFiles);
    }
  }
}
// ------------------------------
// Rechts: Verwaltung + Dateien
// ------------------------------
async function renderManagePanel(store, options = {}) {
  const right = document.getElementById('vsRight');
  if (!right) return;

  const storeId = store?.id || '';
  const storeName = store?.name || '';
  const preserveFiles = options.preserveFiles === true;

  const isStoreChange =
    !!storeId &&
    !!vsCurrentStoreId &&
    storeId !== vsCurrentStoreId;

  if (storeId) vsCurrentStoreId = storeId;

  if (!preserveFiles && (isStoreChange || !storeId)) {
    vsCurrentFiles = [];
  }

  right.innerHTML = `
    <div class="vs-right-header">
      <span><i class="fas fa-cogs"></i> Vector Store verwalten</span>
      <button class="vs-action-btn" id="vsLoadFilesBtn">
        <i class="fas fa-sync-alt"></i> <!--  Dateien anzeigen -->
      </button>
    </div>

    <div style="padding:0.6rem 0.9rem;font-size:0.8rem;" id="vsFilesMeta" class="vs-files-meta">${
      storeId
        ? (vsCurrentFiles.length
            ? `✅ ${vsCurrentFiles.length} Dateien vorhanden`
            : 'Dateien noch nicht geladen.')
        : 'Keine Vector Store ausgewählt.'
    }</div>

    <div class="vs-manage-box">
      <input id="vsStoreIdInput" class="vs-input" placeholder="Store ID" value="${escapeHtml(storeId)}" />

      <div class="vs-row">
        <input id="vsRenameInput" class="vs-input" placeholder="Neuer Name" value="${escapeHtml(storeName)}" />
        <button class="vs-action-btn" id="vsRenameBtn">
          <i class="fas fa-edit"></i> Store Name ändern
        </button>
      </div>

      <div class="vs-row">
        <select id="vsLifetimeSelect" class="vs-input">
          <option value="7">7 Tage</option>
          <option value="14">14 Tage</option>
          <option value="30">30 Tage</option>
          <option value="60">60 Tage</option>
          <option value="90">90 Tage</option>
          <option value="180">180 Tage</option>
          <option value="360">360 Tage</option>
          <option value="never">Nie löschen</option>
        </select>
        <button class="vs-action-btn" id="vsLifetimeBtn">
          <i class="fas fa-calendar-alt"></i> Lebensdauer aktualisieren
        </button>
      </div>

      <div class="vs-row">
        <button class="vs-danger-btn" id="vsDeleteStoreBtn">
          <i class="fas fa-trash"></i> Store löschen
        </button>
        <button class="vs-danger-btn" id="vsDeleteFilesBtn">
          <i class="fas fa-trash"></i> Einzelne Dateien löschen
        </button>
      </div>
    </div>

    <div class="vs-files-area">
      <div id="vsFilesList" class="vs-files-list"></div>
    </div>
  `;

  // Aktuelle Auswahl für Lifetime setzen
  if (store?.expires_after?.days) {
    const select = document.getElementById('vsLifetimeSelect');
    if (select) {
      const days = store.expires_after.days.toString();
      const option = select.querySelector(`option[value="${days}"]`);
      if (option) option.selected = true;
      else if (store.expires_after.days) {
        // Falls nicht in der Liste, "Nie" auswählen
        select.value = 'never';
      }
    }
  }

  // Event Listener
  document.getElementById('vsLoadFilesBtn')?.addEventListener('click', async () => {
    const id = (document.getElementById('vsStoreIdInput')?.value || '').trim();
    if (!id) return toastVs('Bitte eine Store ID eingeben.', 'warn');
    await loadVectorStoreFiles(id);
  });

  document.getElementById('vsRenameBtn')?.addEventListener('click', async () => {
    const id = (document.getElementById('vsStoreIdInput')?.value || '').trim();
    const newName = (document.getElementById('vsRenameInput')?.value || '').trim();
    if (!id) return toastVs('Bitte eine Store ID eingeben.', 'warn');
    if (!newName) return toastVs('Bitte einen neuen Namen eingeben.', 'warn');

    const ok = await renameVectorStore(id, newName);
    if (!ok) return;

    if (id === vsCurrentStoreId) {
      const activeStore = vsStoresCache.find(s => s.id === id) || null;
      renderManagePanel(activeStore, { preserveFiles: true });
      renderFilesList(vsCurrentFiles);
      updateFilesMetaSummary(id, vsCurrentFiles);
    }
  });

  document.getElementById('vsLifetimeBtn')?.addEventListener('click', async () => {
    const id = (document.getElementById('vsStoreIdInput')?.value || '').trim();
    const val = document.getElementById('vsLifetimeSelect')?.value;
    if (!id) return toastVs('Bitte eine Store ID eingeben.', 'warn');

    const ok = await updateVectorStoreLifetime(id, val);
    if (!ok) return;

    if (id === vsCurrentStoreId) {
      const activeStore = vsStoresCache.find(s => s.id === id) || null;
      renderManagePanel(activeStore, { preserveFiles: true });
      renderFilesList(vsCurrentFiles);
      updateFilesMetaSummary(id, vsCurrentFiles);
    }
  });

  document.getElementById('vsDeleteStoreBtn')?.addEventListener('click', async () => {
    const id = (document.getElementById('vsStoreIdInput')?.value || '').trim();
    if (!id) return toastVs('Bitte eine Store ID eingeben.', 'warn');
    const ok = await vsConfirm(
	  'Store wirklich löschen?\nDiese Aktion kann nicht rückgängig gemacht werden.'
	);
	if (!ok) return;

    await deleteVectorStore(id);

    // Store aus Cache entfernen
    vsStoresCache = vsStoresCache.filter(s => s.id !== id);
    vsCurrentStoreId = null;
    vsCurrentFiles = [];

    // Beide Seiten aktualisieren
    renderStoreList(vsStoresCache);
    renderManagePanel(null);
    
    toastVs('✅ Store erfolgreich gelöscht.', 'ok');
  });

  document.getElementById('vsDeleteFilesBtn')?.addEventListener('click', async () => {
    const id = (document.getElementById('vsStoreIdInput')?.value || '').trim();
    if (!id) return toastVs('Bitte eine Store ID eingeben.', 'warn');

    const selected = Array.from(document.querySelectorAll('.vs-file-check:checked'))
      .map(cb => cb.getAttribute('data-file-id'))
      .filter(Boolean);

    if (!selected.length) return toastVs('Bitte erst Dateien auswählen.', 'warn');

    const ok = await vsConfirm(
	  `Möchten Sie ${selected.length} Datei(en) wirklich löschen?\nDiese Aktion kann nicht rückgängig gemacht werden.`
	);
	if (!ok) return;

    // Dateien löschen und beide Seiten aktualisieren
    await deleteSelectedFiles(id, selected);
  });

  // Automatisch Dateien laden, wenn ein Store ausgewählt ist
  if (storeId && !preserveFiles) {
    setTimeout(async () => {
      await loadVectorStoreFiles(storeId);
    }, 100);
  }
}

async function loadVectorStoreFiles(storeId) {
  const api = getApiConfig();
  const meta = document.getElementById('vsFilesMeta');
  const list = document.getElementById('vsFilesList');
  if (!meta || !list) return;

  meta.innerHTML = 'Lade Dateien...';
  list.innerHTML = '';

  try {
    const res = await fetch(`https://api.openai.com/v1/vector_stores/${encodeURIComponent(storeId)}/files`, {
      headers: { 'Authorization': `Bearer ${api.apiKey}` }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      meta.innerHTML = 'Fehler beim Laden der Dateien.';
      toastVs(data?.error?.message || 'Fehler beim Laden der Dateien.', 'err');
      return;
    }

    const files = data.data || [];

    // Metadaten anreichern (filename/bytes/purpose)
    const hydrated = await mapWithConcurrency(files, 6, async (f) => {
      const m = await fetchOpenAIFileMeta(f.id);
      if (!m) {
        return {
          ...f,
          filename: f.filename || f.id,
          bytes: getFileBytes(f),
          purpose: f.purpose || '-'
        };
      }

return {
  ...f,
  ...m,
  status: f.status,
  last_error: f.last_error,
  filename: m.filename || f.filename || f.id,
  bytes: getFileBytes(m) || getFileBytes(f),
  purpose: m.purpose || f.purpose || '-'
};
    });

    // Cache aktualisieren
    vsCurrentStoreId = storeId;
    vsCurrentFiles = hydrated;

    updateStoreFileCountsInCache(storeId, hydrated);

    renderFilesList(hydrated);
    updateFilesMetaSummary(storeId, hydrated);
    renderStoreList(vsStoresCache);
    
  } catch (e) {
    console.error(e);
    meta.innerHTML = 'Fehler beim Laden der Dateien.';
    toastVs('Netzwerkfehler beim Laden der Dateien.', 'err');
  }
}

function renderFilesList(files) {
  const meta = document.getElementById('vsFilesMeta');
  const list = document.getElementById('vsFilesList');
  if (!meta || !list) return;

  list.innerHTML = '';

  if (!files.length) {
    updateFilesMetaSummary(vsCurrentStoreId, []);
    return;
  }

  updateFilesMetaSummary(vsCurrentStoreId, files);

  let totalBytes = 0;
  const types = new Set();

  files.forEach(f => {
    totalBytes += getFileBytes(f);

    const ext = (f.filename || '').includes('.') ? f.filename.split('.').pop() : '-';
    if (ext && ext !== '-') types.add(ext);

    const created = f.created_at ? new Date(f.created_at * 1000).toLocaleString() : '-';
    const fileBytes = getFileBytes(f);
    const fileSizeLabel = formatBytesForVectorStore(fileBytes);

    const card = document.createElement('div');
    card.className = 'vs-card vs-file-card';

    card.innerHTML = `
      <label class="vs-file-checkwrap">
        <input type="checkbox" class="vs-file-check" data-file-id="${escapeHtml(f.id)}" />
        <span class="vs-file-box"></span>
      </label>

      <div class="vs-file-body">
        <div class="vs-file-title">
          ${escapeHtml(f.filename || f.id)}
          <span class="vs-mini-badge ${statusToBadgeClass(f.status)}">${escapeHtml(f.status || '-')}</span>
        </div>
        <div class="vs-file-line">Größe: ${escapeHtml(fileSizeLabel)}</div>
        <div class="vs-file-line">Datei-ID: ${escapeHtml(f.id)}</div>
        <div class="vs-file-line">Typ: ${escapeHtml(ext || '-')}</div>
        <div class="vs-file-line">Zweck: ${escapeHtml(f.purpose || '-')}</div>
        <div class="vs-file-line">Erstellt: ${escapeHtml(created)}</div>
      </div>
    `;

const cb = card.querySelector('.vs-file-check');

cb.addEventListener('change', () => {
  card.classList.toggle('selected', cb.checked);
});

card.addEventListener('click', (e) => {
  const clickedCheckbox =
    e.target.closest('.vs-file-checkwrap') ||
    e.target.closest('.vs-file-check') ||
    e.target.closest('.vs-file-box');

  if (clickedCheckbox) return;

  cb.checked = !cb.checked;
  card.classList.toggle('selected', cb.checked);
});

    list.appendChild(card);
  });

  // Stats in den Scroll-Bereich integrieren
  const avg = (totalBytes / files.length) || 0;
  const typeList = [...types].filter(Boolean);

  const statsCard = document.createElement('div');
  statsCard.className = 'vs-card vs-stats-card';
  statsCard.innerHTML = `
    📊 Gesamtstatistiken ${files.length} Dateien<br>
    Gesamtgröße: ${totalBytes} Bytes (${(totalBytes / 1024).toFixed(2)} KB / ${(totalBytes / (1024 * 1024)).toFixed(3)} MB)<br>
    Durchschnitt: ${avg.toFixed(0)} Bytes (${(avg / 1024).toFixed(2)} KB pro Datei)<br>
    Dateitypen: ${typeList.length ? typeList.join(', ') : '-'}
  `;
  list.appendChild(statsCard);
}

// ------------------------------
// Mutations (rename/lifetime/delete)
// ------------------------------
async function renameVectorStore(storeId, newName) {
  const api = getApiConfig();
  const res = await fetch(`https://api.openai.com/v1/vector_stores/${encodeURIComponent(storeId)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${api.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: newName })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toastVs(data?.error?.message || 'Fehler beim Umbenennen.', 'err');
    return false;
  }

  updateStoreFieldsInCache(storeId, {
    name: data?.name ?? newName
  });

  renderStoreList(vsStoresCache);
  toastVs('✅ Store Name geändert.', 'ok');
  return true;
}

async function updateVectorStoreLifetime(storeId, value) {
  const api = getApiConfig();
  const payload = (value === 'never')
    ? { expires_after: null }
    : { expires_after: { anchor: 'last_active_at', days: Number(value) } };

  const res = await fetch(`https://api.openai.com/v1/vector_stores/${encodeURIComponent(storeId)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${api.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toastVs(data?.error?.message || 'Fehler beim Aktualisieren.', 'err');
    return false;
  }

  updateStoreFieldsInCache(storeId, {
    expires_after: value === 'never'
      ? null
      : { anchor: 'last_active_at', days: Number(value) }
  });

  renderStoreList(vsStoresCache);
  toastVs('✅ Lebensdauer aktualisiert.', 'ok');
  return true;
}

async function deleteVectorStore(storeId) {
  const api = getApiConfig();
  const res = await fetch(`https://api.openai.com/v1/vector_stores/${encodeURIComponent(storeId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${api.apiKey}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return toastVs(data?.error?.message || 'Fehler beim Löschen.', 'err');
  return true;
}

async function deleteSelectedFiles(storeId, fileIds) {
  const api = getApiConfig();
  let deletedCount = 0;
  const errors = [];

  for (const fid of fileIds) {
    try {
      const res = await fetch(
        `https://api.openai.com/v1/vector_stores/${encodeURIComponent(storeId)}/files/${encodeURIComponent(fid)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${api.apiKey}` }
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        errors.push(`Fehler bei Datei ${fid}: ${data?.error?.message || 'Unbekannter Fehler'}`);
        continue;
      }

      deletedCount++;
      vsCurrentFiles = vsCurrentFiles.filter(f => f.id !== fid);

    } catch (error) {
      errors.push(`Fehler bei Datei ${fid}: ${error.message}`);
    }
  }

  if (deletedCount > 0) {
    updateStoreFileCountsInCache(storeId, vsCurrentFiles);
    refreshStoreViews(storeId, { preserveFiles: true });
    toastVs(`✅ ${deletedCount} Datei(en) gelöscht.`, 'ok');
  }

  if (errors.length > 0) {
    console.error('Fehler beim Löschen:', errors);
    toastVs(errors[0], 'err');
  }

  return deletedCount;
}
// ------------------------------
// Zentrale Dialog-API
// ------------------------------
let vsDialogResolve = null;

function openVsDialog({ title, message, confirm = false }) {
  const overlay = document.getElementById('vsDialogOverlay');
  const titleEl = document.getElementById('vsDialogTitle');
  const msgEl = document.getElementById('vsDialogMessage');
  const btnOk = document.getElementById('vsDialogOk');
  const btnCancel = document.getElementById('vsDialogCancel');
  const btnClose = document.getElementById('vsDialogClose');

  titleEl.textContent = title;
  msgEl.innerHTML = escapeHtml(message).replace(/\n/g, '<br>');

  btnCancel.hidden = !confirm;

  overlay.hidden = false;
  overlay.classList.add('show');

  const cleanup = () => {
    overlay.classList.remove('show');
    overlay.hidden = true;
    btnOk.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;
  };

  return new Promise(resolve => {
    vsDialogResolve = resolve;

    btnOk.onclick = () => {
      cleanup();
      resolve(true);
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(false);
    };

    btnClose.onclick = () => {
      cleanup();
      resolve(false);
    };
  });
}

/* === Öffentliche Helfer === */

function vsAlert(message, type = 'info') {
  return openVsDialog({
    title: type === 'err' ? 'Fehler' : type === 'warn' ? 'Hinweis' : 'Information',
    message,
    confirm: false
  });
}

function vsConfirm(message) {
  return openVsDialog({
    title: 'Bestätigung',
    message,
    confirm: true
  });
}

