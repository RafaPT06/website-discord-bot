const PREFS_KEY = 'meowzDashboardPreferences';
const LEGACY_THEME_KEY = 'meowzTheme';

const SETTINGS_COPY = {
  en: 'Control dashboard and language preferences. Language preferences are saved locally on this browser, even when you are not logged in.',
  pt: 'Controla as preferências do painel e do idioma. A preferência de idioma fica guardada localmente neste navegador, mesmo sem sessão iniciada.',
  es: 'Controla las preferencias del panel y del idioma. La preferencia de idioma se guarda localmente en este navegador, incluso sin iniciar sesión.',
  de: 'Verwalte Dashboard- und Spracheinstellungen. Die Spracheinstellung wird lokal in diesem Browser gespeichert, auch wenn du nicht angemeldet bist.',
  fr: 'Gérez les préférences du tableau de bord et de langue. La préférence de langue est enregistrée localement dans ce navigateur, même sans connexion.',
};

function forceDarkDocument() {
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.style.colorScheme = 'dark';
}

function removeStoredThemePreference() {
  try {
    localStorage.removeItem(LEGACY_THEME_KEY);
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (Object.prototype.hasOwnProperty.call(prefs, 'theme')) {
      delete prefs.theme;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
  } catch {
    localStorage.removeItem(LEGACY_THEME_KEY);
  }
}

function currentLanguage() {
  const raw = String(document.documentElement.lang || 'en').toLowerCase();
  return raw.split('-')[0] || 'en';
}

function markSettingsLayout(settingsForm) {
  settingsForm.classList.add('dash-settings-dark-only');

  const languageCard = settingsForm.querySelector('select[name="language"]')?.closest('.dash-card');
  languageCard?.classList.add('dash-settings-language-card');

  const futureCard = settingsForm.querySelector('.dash-feature-grid.compact')?.closest('.dash-card');
  futureCard?.classList.add('dash-settings-future-card');
}

function cleanSettingsPage(root = document) {
  root.querySelectorAll?.('[data-theme-toggle]').forEach((toggle) => {
    toggle.closest('.dash-card')?.remove();
  });

  const settingsForm = root.querySelector?.('[data-dashboard-settings]')
    || (root.matches?.('[data-dashboard-settings]') ? root : null);
  if (!settingsForm) return;

  markSettingsLayout(settingsForm);

  const intro = settingsForm.parentElement?.querySelector('.dash-page-title p');
  if (intro) intro.textContent = SETTINGS_COPY[currentLanguage()] || SETTINGS_COPY.en;
}

export function initDarkThemeOnly() {
  forceDarkDocument();
  removeStoredThemePreference();
  cleanSettingsPage(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        forceDarkDocument();
        cleanSettingsPage(node);
        cleanSettingsPage(document);
      }
    }
  });

  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('meowz:language-change', () => cleanSettingsPage(document));
  window.addEventListener('storage', forceDarkDocument);
}
