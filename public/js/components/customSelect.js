import { escapeHtml } from '../utils.js';

const SELECTOR = 'select:not([multiple]):not([data-meowz-select-ignore]):not([data-changelog-month-select])';
let sequence = 0;
let observer;
let lastViewportWidth = Math.round(window.visualViewport?.width || window.innerWidth || 0);

function usesCoarsePointer() {
  return Boolean(navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
}

function getOptions(select) {
  return [...select.options].map((option, index) => ({
    index,
    value: option.value,
    label: option.textContent?.trim() || option.value,
    selected: option.selected,
    disabled: option.disabled,
  }));
}

function getIcon(select) {
  const name = String(select.name || '').toLowerCase();
  if (name.includes('channel')) return '#';
  if (name.includes('role')) return '@';
  if (name.includes('language')) return '文';
  return '•';
}

function renderOptions(select, root) {
  const options = getOptions(select);
  const menu = root.querySelector('[data-meowz-select-menu]');
  if (!menu) return;
  const searchable = options.length > 8;
  menu.innerHTML = `
    <div class="meowz-select-menu-head"><strong>Choose an option</strong><small>${options.length} option${options.length === 1 ? '' : 's'}</small></div>
    ${searchable ? '<label class="meowz-select-search"><span class="sr-only">Search options</span><input type="search" autocomplete="off" enterkeyhint="search" placeholder="Search…" data-meowz-select-search /></label>' : ''}
    <div class="meowz-select-options">
      ${options.map((option) => `
        <button type="button" class="meowz-select-option${option.selected ? ' is-selected' : ''}" role="option" aria-selected="${option.selected ? 'true' : 'false'}" data-meowz-select-option data-value="${escapeHtml(option.value)}" ${option.disabled ? 'disabled' : ''} tabindex="-1">
          <span class="meowz-select-check" aria-hidden="true">✓</span><span>${escapeHtml(option.label)}</span>
        </button>`).join('')}
      <div class="meowz-select-empty" data-meowz-select-empty hidden>No matching options.</div>
    </div>`;
}

function findRoot(select) {
  return select.nextElementSibling?.matches('[data-meowz-select]') ? select.nextElementSibling : null;
}

function sync(select) {
  const root = findRoot(select);
  if (!root) return;
  const selected = select.options[select.selectedIndex] || select.options[0];
  const trigger = root.querySelector('[data-meowz-select-trigger]');
  const value = root.querySelector('[data-meowz-select-value]');
  if (value) value.textContent = selected?.textContent?.trim() || 'Choose an option';
  if (trigger) trigger.disabled = Boolean(select.disabled);
  root.querySelectorAll('[data-meowz-select-option]').forEach((option) => {
    const active = option.dataset.value === String(select.value);
    option.classList.toggle('is-selected', active);
    option.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function close(root, restoreFocus = false) {
  if (!root) return;
  const menu = root.querySelector('[data-meowz-select-menu]');
  const trigger = root.querySelector('[data-meowz-select-trigger]');
  root.classList.remove('is-open');
  trigger?.setAttribute('aria-expanded', 'false');
  if (menu) menu.hidden = true;
  if (restoreFocus) trigger?.focus({ preventScroll: true });
}

function closeAll(except) {
  document.querySelectorAll('[data-meowz-select].is-open').forEach((root) => {
    if (root !== except) close(root);
  });
}

function visibleOptions(root) {
  return [...root.querySelectorAll('[data-meowz-select-option]')].filter((option) => !option.hidden && !option.disabled);
}

function open(root, focus = false) {
  if (!root) return;
  const menu = root.querySelector('[data-meowz-select-menu]');
  const trigger = root.querySelector('[data-meowz-select-trigger]');
  if (!menu || !trigger || trigger.disabled) return;
  closeAll(root);
  root.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');
  menu.hidden = false;
  const search = root.querySelector('[data-meowz-select-search]');
  if (search) {
    search.value = '';
    filter(root, '');
  }
  const shouldFocusSearch = Boolean(search && focus && !usesCoarsePointer());
  requestAnimationFrame(() => {
    if (shouldFocusSearch) search.focus({ preventScroll: true });
    else if (focus) {
      const options = visibleOptions(root);
      const selected = options.find((option) => option.classList.contains('is-selected')) || options[0];
      selected?.focus({ preventScroll: true });
    }
  });
}

function choose(root, option) {
  const select = root?.previousElementSibling;
  if (!(select instanceof HTMLSelectElement) || !option || option.disabled) return;
  select.value = option.dataset.value || '';
  sync(select);
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  close(root, true);
}

function filter(root, query) {
  const value = String(query || '').trim().toLowerCase();
  let visible = 0;
  root.querySelectorAll('[data-meowz-select-option]').forEach((option) => {
    const match = !value || option.textContent.toLowerCase().includes(value);
    option.hidden = !match;
    if (match) visible += 1;
  });
  const empty = root.querySelector('[data-meowz-select-empty]');
  if (empty) empty.hidden = visible > 0;
}

function enhance(select) {
  if (!(select instanceof HTMLSelectElement) || select.dataset.meowzSelectReady === 'true' || !select.matches(SELECTOR)) return;
  sequence += 1;
  const id = `meowz-select-${sequence}`;
  const selected = select.options[select.selectedIndex] || select.options[0];
  const root = document.createElement('div');
  root.className = 'meowz-select';
  root.id = id;
  root.dataset.meowzSelect = '';
  root.innerHTML = `
    <button type="button" class="meowz-select-trigger" data-meowz-select-trigger role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-menu" ${select.disabled ? 'disabled' : ''}>
      <span class="meowz-select-leading" aria-hidden="true">${escapeHtml(getIcon(select))}</span>
      <span class="meowz-select-value" data-meowz-select-value>${escapeHtml(selected?.textContent?.trim() || 'Choose an option')}</span>
      <span class="meowz-select-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="meowz-select-menu" id="${id}-menu" role="listbox" data-meowz-select-menu hidden></div>`;
  select.dataset.meowzSelectReady = 'true';
  select.classList.add('meowz-native-select');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.insertAdjacentElement('afterend', root);
  renderOptions(select, root);
  sync(select);
  select.addEventListener('change', () => sync(select));
}

function scan(root = document) {
  if (root instanceof HTMLSelectElement) enhance(root);
  root.querySelectorAll?.(SELECTOR).forEach(enhance);
}

function move(root, option, direction) {
  const options = visibleOptions(root);
  const index = options.indexOf(option);
  if (index < 0 || !options.length) return;
  options[(index + direction + options.length) % options.length]?.focus({ preventScroll: true });
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-meowz-select-trigger]');
    if (trigger) {
      event.preventDefault();
      const root = trigger.closest('[data-meowz-select]');
      if (root.classList.contains('is-open')) close(root);
      else open(root, false);
      return;
    }
    const option = event.target.closest?.('[data-meowz-select-option]');
    if (option) {
      event.preventDefault();
      choose(option.closest('[data-meowz-select]'), option);
      return;
    }
    if (!event.target.closest?.('[data-meowz-select]')) closeAll();
  });

  document.addEventListener('input', (event) => {
    const search = event.target.closest?.('[data-meowz-select-search]');
    if (search) filter(search.closest('[data-meowz-select]'), search.value);
  });

  document.addEventListener('keydown', (event) => {
    const trigger = event.target.closest?.('[data-meowz-select-trigger]');
    const option = event.target.closest?.('[data-meowz-select-option]');
    const search = event.target.closest?.('[data-meowz-select-search]');
    if (trigger) {
      const root = trigger.closest('[data-meowz-select]');
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        open(root, true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(root, true);
      }
      return;
    }
    if (option) {
      const root = option.closest('[data-meowz-select]');
      if (event.key === 'ArrowDown') { event.preventDefault(); move(root, option, 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move(root, option, -1); }
      else if (event.key === 'Home') { event.preventDefault(); visibleOptions(root)[0]?.focus(); }
      else if (event.key === 'End') { event.preventDefault(); visibleOptions(root).at(-1)?.focus(); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(root, option); }
      else if (event.key === 'Escape') { event.preventDefault(); close(root, true); }
      return;
    }
    if (search && event.key === 'Escape') {
      event.preventDefault();
      close(search.closest('[data-meowz-select]'), true);
    }
  });

  document.addEventListener('reset', (event) => {
    requestAnimationFrame(() => event.target.querySelectorAll?.('select[data-meowz-select-ready="true"]').forEach(sync));
  });

  window.addEventListener('resize', () => {
    const width = Math.round(window.visualViewport?.width || window.innerWidth || 0);
    const widthChanged = Math.abs(width - lastViewportWidth) > 2;
    lastViewportWidth = width;
    if (widthChanged) closeAll();
  }, { passive: true });
}

export function initCustomSelects() {
  scan(document);
  bindEvents();
  if (observer || !document.body) return;
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
