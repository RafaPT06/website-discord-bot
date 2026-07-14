import { getStoredLanguage, setStoredLanguage } from './i18n.js';

const SELECTOR = 'select[name="language"]';
const LEGACY_COPY = 'The selector is ready for future translations. English remains the active dashboard copy for now.';
const ACTIVE_COPY = 'Choose the language used across the Meowz website and dashboard.';
const NOTE_COPY = 'Language changes apply immediately and are saved on this browser.';

function syncSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  const storedLanguage = getStoredLanguage();
  if (select.value !== storedLanguage) select.value = storedLanguage;

  const description = select.closest('.dash-card')?.querySelector('.dash-card-head p');
  if (description?.textContent.trim() === LEGACY_COPY) description.textContent = ACTIVE_COPY;

  const field = select.closest('.dash-field');
  if (field && !field.querySelector('[data-language-preference-note]')) {
    const note = document.createElement('small');
    note.className = 'dash-field-note';
    note.dataset.languagePreferenceNote = '';
    note.textContent = NOTE_COPY;
    field.append(note);
  }
}

function syncLanguageControls(root = document) {
  if (root instanceof HTMLSelectElement && root.matches(SELECTOR)) syncSelect(root);
  root.querySelectorAll?.(SELECTOR).forEach(syncSelect);
}

export function initLanguagePreferences() {
  syncLanguageControls();

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.(SELECTOR);
    if (!select) return;
    setStoredLanguage(select.value);
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) syncLanguageControls(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('meowz:language-change', () => {
    document.querySelectorAll(SELECTOR).forEach(syncSelect);
  });
}
