import { escapeHtml } from './utils.js';

const changelogList = document.querySelector('[data-changelog-list]');
let restoreFocusAfterRender = false;
let pickerSequence = 0;

function selectedOption(select) {
  return select.options[select.selectedIndex] || select.options[0] || null;
}

function optionMarkup(option, pickerId, index) {
  const selected = option.selected;
  return `
    <button
      type="button"
      id="${pickerId}-option-${index}"
      class="changelog-select-option${selected ? ' is-selected' : ''}"
      role="option"
      aria-selected="${selected ? 'true' : 'false'}"
      tabindex="-1"
      data-changelog-custom-option
      data-value="${escapeHtml(option.value)}"
    >
      <span class="changelog-select-check" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="m5 10.25 3.1 3.1L15 6.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
      <span>${escapeHtml(option.textContent)}</span>
    </button>`;
}

function enhanceSelect(select) {
  if (!select || select.dataset.customSelectReady === 'true') return;

  const field = select.closest('.changelog-month-filter');
  const fieldLabel = field?.querySelector(':scope > span');
  if (!field || !fieldLabel) return;

  pickerSequence += 1;
  const pickerId = `changelog-month-picker-${pickerSequence}`;
  const listboxId = `${pickerId}-listbox`;
  const labelId = fieldLabel.id || `${pickerId}-label`;
  const current = selectedOption(select);

  fieldLabel.id = labelId;
  select.dataset.customSelectReady = 'true';
  select.classList.add('changelog-native-select');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const picker = document.createElement('div');
  picker.className = 'changelog-custom-select';
  picker.dataset.changelogCustomSelect = '';
  picker.innerHTML = `
    <button
      type="button"
      class="changelog-select-trigger"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-controls="${listboxId}"
      aria-labelledby="${labelId} ${pickerId}-value"
      data-changelog-custom-trigger
    >
      <span class="changelog-select-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </span>
      <span class="changelog-select-value" id="${pickerId}-value">${escapeHtml(current?.textContent || 'All months')}</span>
      <span class="changelog-select-chevron" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="m5.5 7.5 4.5 4.5 4.5-4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>
    <div
      id="${listboxId}"
      class="changelog-select-menu"
      role="listbox"
      aria-labelledby="${labelId}"
      data-changelog-custom-menu
      hidden
    >
      <div class="changelog-select-menu-head" aria-hidden="true">
        <span>Browse archive</span>
        <small>${select.options.length} views</small>
      </div>
      <div class="changelog-select-options">
        ${[...select.options].map((option, index) => optionMarkup(option, pickerId, index)).join('')}
      </div>
    </div>`;

  select.insertAdjacentElement('afterend', picker);

  if (restoreFocusAfterRender) {
    restoreFocusAfterRender = false;
    requestAnimationFrame(() => picker.querySelector('[data-changelog-custom-trigger]')?.focus());
  }
}

function enhanceAllSelects() {
  changelogList?.querySelectorAll('select[data-changelog-month-select]').forEach(enhanceSelect);
}

function getPickerParts(root) {
  if (!root) return null;
  return {
    root,
    trigger: root.querySelector('[data-changelog-custom-trigger]'),
    menu: root.querySelector('[data-changelog-custom-menu]'),
    options: [...root.querySelectorAll('[data-changelog-custom-option]')],
    native: root.previousElementSibling?.matches('select[data-changelog-month-select]')
      ? root.previousElementSibling
      : root.parentElement?.querySelector('select[data-changelog-month-select]'),
  };
}

function closePicker(root, { restoreFocus = false } = {}) {
  const picker = getPickerParts(root);
  if (!picker) return;
  picker.root.classList.remove('is-open');
  picker.trigger?.setAttribute('aria-expanded', 'false');
  if (picker.menu) picker.menu.hidden = true;
  if (restoreFocus) picker.trigger?.focus();
}

function closeOtherPickers(except = null) {
  document.querySelectorAll('[data-changelog-custom-select].is-open').forEach((root) => {
    if (root !== except) closePicker(root);
  });
}

function focusOption(root, index) {
  const picker = getPickerParts(root);
  if (!picker?.options.length) return;
  const safeIndex = Math.max(0, Math.min(index, picker.options.length - 1));
  picker.options[safeIndex]?.focus();
}

function openPicker(root, focusMode = false) {
  const picker = getPickerParts(root);
  if (!picker?.trigger || !picker.menu) return;

  closeOtherPickers(root);
  picker.root.classList.add('is-open');
  picker.trigger.setAttribute('aria-expanded', 'true');
  picker.menu.hidden = false;

  if (!focusMode) return;
  const selectedIndex = Math.max(0, picker.options.findIndex((option) => option.getAttribute('aria-selected') === 'true'));
  const targetIndex = focusMode === 'last' ? picker.options.length - 1 : selectedIndex;
  requestAnimationFrame(() => focusOption(root, targetIndex));
}

function chooseOption(root, option) {
  const picker = getPickerParts(root);
  if (!picker?.native || !option) return;

  picker.native.value = option.dataset.value || 'all';
  restoreFocusAfterRender = true;
  picker.native.dispatchEvent(new Event('change', { bubbles: true }));
}

function moveOptionFocus(root, option, direction) {
  const picker = getPickerParts(root);
  if (!picker?.options.length) return;
  const index = picker.options.indexOf(option);
  const nextIndex = (index + direction + picker.options.length) % picker.options.length;
  focusOption(root, nextIndex);
}

changelogList?.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-changelog-custom-trigger]');
  if (trigger) {
    const root = trigger.closest('[data-changelog-custom-select]');
    if (root?.classList.contains('is-open')) closePicker(root);
    else openPicker(root);
    return;
  }

  const option = event.target.closest('[data-changelog-custom-option]');
  if (option) chooseOption(option.closest('[data-changelog-custom-select]'), option);
});

document.addEventListener('click', (event) => {
  document.querySelectorAll('[data-changelog-custom-select].is-open').forEach((root) => {
    if (!root.contains(event.target)) closePicker(root);
  });
});

document.addEventListener('keydown', (event) => {
  const trigger = event.target.closest?.('[data-changelog-custom-trigger]');
  const option = event.target.closest?.('[data-changelog-custom-option]');

  if (trigger) {
    const root = trigger.closest('[data-changelog-custom-select]');
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openPicker(root, 'selected');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openPicker(root, 'last');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (root?.classList.contains('is-open')) closePicker(root);
      else openPicker(root, 'selected');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(root, { restoreFocus: true });
    }
    return;
  }

  if (option) {
    const root = option.closest('[data-changelog-custom-select]');
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveOptionFocus(root, option, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveOptionFocus(root, option, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOption(root, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      const count = getPickerParts(root)?.options.length || 1;
      focusOption(root, count - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseOption(root, option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(root, { restoreFocus: true });
    } else if (event.key === 'Tab') {
      closePicker(root);
    }
    return;
  }

  if (event.key === 'Escape') closeOtherPickers();
});

window.addEventListener('resize', () => closeOtherPickers());

const observer = new MutationObserver(enhanceAllSelects);
if (changelogList) observer.observe(changelogList, { childList: true, subtree: true });
enhanceAllSelects();
