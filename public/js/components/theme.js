const PREFS_KEY = 'meowzDashboardPreferences';
const LEGACY_THEME_KEY = 'meowzTheme';
const DARK_THEME = 'dark';

function clearStoredThemePreference() {
  localStorage.removeItem(LEGACY_THEME_KEY);
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (Object.prototype.hasOwnProperty.call(prefs, 'theme')) {
      delete prefs.theme;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
  } catch {
    // Invalid local preferences should not prevent the dark theme from loading.
  }
}

export function getStoredTheme() {
  return DARK_THEME;
}

export function applyTheme() {
  document.documentElement.dataset.theme = DARK_THEME;
  document.documentElement.style.colorScheme = DARK_THEME;
  return DARK_THEME;
}

export function setStoredTheme() {
  clearStoredThemePreference();
  const theme = applyTheme();
  window.dispatchEvent(new CustomEvent('meowz:theme-change', { detail: { theme } }));
  return theme;
}

export function initTheme() {
  clearStoredThemePreference();
  applyTheme();
}
