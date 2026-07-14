import { getStoredLanguage, setStoredLanguage } from './i18n.js';

const selector = 'select[name="language"]';

function syncLanguageControl(root = document) {
  root.querySelectorAll?.(selector).forEach((select) => {
    select.value = getStoredLanguage();
    const description = select.closest('.dash-card')?.querySelector('.dash-card-head p');
    if (description) description.textContent = 'Choose the language used across the Meowz website and dashboard.';

    const field = select.closest('.dash-field');
    if (field && !field.querySelector('[data-language-preference-note]')) {
      const note = document.createElement('small');
      note.className = 'dash-field-note';
      note.dataset.languagePreferenceNote = '';
      note.textContent = 'Language changes apply immediately and are saved on this browser.';
      field.append(note);
    }
  });
}

export function initLanguagePreferences() {
  syncLanguageControl();

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.(selector);
    if (!select) return;
    setStoredLanguage(select.value);
    syncLanguageControl();
  });

  const observer = new MutationObserver(() => syncLanguageControl());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('meowz:language-change', () => syncLanguageControl());
}
