const ACTIVE_KEY = 'meowz-private-puzzle-v2';
const LIBRARY_KEY = 'meowz-private-puzzle-library-v1';
const MAX_SAVED = 30;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

function fingerprint(puzzle) {
  const source = JSON.stringify({
    title: puzzle?.title || '', rows: puzzle?.rows || 0, cols: puzzle?.cols || 0,
    cells: puzzle?.cells || [], words: puzzle?.words || [],
  });
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `p${(hash >>> 0).toString(36)}`;
}

function getLibrary() {
  const saved = readJson(LIBRARY_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

function saveSnapshot(state) {
  if (!state?.puzzle?.cells || !state?.puzzle?.words) return;
  const now = new Date().toISOString();
  const id = fingerprint(state.puzzle);
  const library = getLibrary();
  const index = library.findIndex((item) => item.id === id);
  const entry = {
    id,
    title: String(state.puzzle.title || 'Imported puzzle'),
    puzzle: state.puzzle,
    values: state.values || {},
    createdAt: index >= 0 ? library[index].createdAt : now,
    updatedAt: now,
  };
  if (index >= 0) library.splice(index, 1);
  library.unshift(entry);
  writeJson(LIBRARY_KEY, library.slice(0, MAX_SAVED));
}

function formatDate(value) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return ''; }
}

function progressFor(entry) {
  const cells = Array.isArray(entry?.puzzle?.cells) ? entry.puzzle.cells : [];
  let filled = 0;
  for (const cell of cells) {
    const key = `${cell.row}:${cell.col}`;
    if (String(entry?.values?.[key] || cell.visibleLetter || '').trim()) filled += 1;
  }
  return `${filled}/${cells.length}`;
}

function ensureLibraryUi() {
  if (document.querySelector('[data-puzzle-library]')) return;
  const uploadCard = document.querySelector('.card');
  if (!uploadCard) return;

  const section = document.createElement('section');
  section.className = 'card';
  section.setAttribute('data-puzzle-library', '');
  section.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div><p class="tool-kicker">Owner library</p><h2 style="margin:0">Saved puzzles</h2><p class="tool-copy" style="margin-top:7px">Your imported puzzles and progress are saved automatically on this device, so building another puzzle will not replace the previous one.</p></div>
      <button class="btn btn-secondary" type="button" data-refresh-puzzles>Refresh</button>
    </div>
    <div data-puzzle-library-list style="display:grid;gap:10px;margin-top:16px"></div>
    <div class="privacy-note">Saved copies contain only the detected grid, word bank and your letters — not the uploaded screenshot.</div>`;
  uploadCard.parentNode.insertBefore(section, uploadCard);
  section.querySelector('[data-refresh-puzzles]')?.addEventListener('click', renderLibrary);
  renderLibrary();
}

function renderLibrary() {
  const host = document.querySelector('[data-puzzle-library-list]');
  if (!host) return;
  const library = getLibrary();
  host.innerHTML = '';
  if (!library.length) {
    host.innerHTML = '<div style="color:#aeb1c7;padding:4px 0">No saved puzzles yet. Import one below and it will appear here automatically.</div>';
    return;
  }

  for (const entry of library) {
    const row = document.createElement('article');
    row.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 14px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)';
    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = entry.title || 'Imported puzzle';
    title.style.display = 'block';
    const meta = document.createElement('span');
    meta.textContent = `${progressFor(entry)} squares · saved ${formatDate(entry.updatedAt)}`;
    meta.style.cssText = 'display:block;margin-top:4px;color:#aeb1c7;font-size:.85rem';
    info.append(title, meta);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end';
    const open = document.createElement('button');
    open.className = 'btn'; open.type = 'button'; open.textContent = 'Open';
    open.style.padding = '9px 12px';
    open.addEventListener('click', () => {
      writeJson(ACTIVE_KEY, { puzzle: entry.puzzle, values: entry.values || {} });
      location.reload();
    });
    const remove = document.createElement('button');
    remove.className = 'btn btn-secondary'; remove.type = 'button'; remove.textContent = 'Delete';
    remove.style.padding = '9px 12px';
    remove.addEventListener('click', () => {
      if (!confirm(`Delete the saved copy of “${entry.title || 'this puzzle'}”?`)) return;
      writeJson(LIBRARY_KEY, getLibrary().filter((item) => item.id !== entry.id));
      renderLibrary();
    });
    actions.append(open, remove);
    row.append(info, actions);
    host.appendChild(row);
  }
}

let lastActive = '';
function syncActiveToLibrary() {
  const raw = localStorage.getItem(ACTIVE_KEY) || '';
  if (!raw || raw === lastActive) return;
  lastActive = raw;
  try {
    saveSnapshot(JSON.parse(raw));
    renderLibrary();
  } catch {}
}

ensureLibraryUi();
syncActiveToLibrary();
setInterval(syncActiveToLibrary, 500);
window.addEventListener('storage', (event) => {
  if (event.key === ACTIVE_KEY || event.key === LIBRARY_KEY) {
    syncActiveToLibrary();
    renderLibrary();
  }
});
