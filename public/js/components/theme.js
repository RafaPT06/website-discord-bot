const PREFS_KEY = 'meowzDashboardPreferences';
const THEME_KEY = 'meowzTheme';
const VALID = new Set(['dark', 'light']);

export function getStoredTheme() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (VALID.has(prefs.theme)) return prefs.theme;
  } catch {}
  const legacy = localStorage.getItem(THEME_KEY);
  return VALID.has(legacy) ? legacy : 'dark';
}

export function applyTheme(theme = getStoredTheme()) {
  const normalized = VALID.has(theme) ? theme : 'dark';
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;
  return normalized;
}

export function setStoredTheme(theme) {
  const normalized = applyTheme(theme);
  localStorage.setItem(THEME_KEY, normalized);
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    prefs.theme = normalized;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: normalized }));
  }
  window.dispatchEvent(new CustomEvent('meowz:theme-change', { detail: { theme: normalized } }));
  return normalized;
}

export function initTheme() {
  applyTheme();
}
