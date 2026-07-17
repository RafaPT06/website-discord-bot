let initialized = false;
let observer = null;
let frame = 0;

function usesCoarsePointer() {
  return Boolean(navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
}

function stabilize(root = document) {
  if (!usesCoarsePointer()) return;
  const forms = [];
  if (root instanceof HTMLFormElement && root.matches('[data-settings-form="leveling"]')) forms.push(root);
  root.querySelectorAll?.('[data-settings-form="leveling"]').forEach((form) => forms.push(form));

  forms.forEach((form) => {
    const select = form.querySelector('select[name="rewardRoleId"]');
    const picker = select?.nextElementSibling?.matches('[data-meowz-select]') ? select.nextElementSibling : null;
    const search = picker?.querySelector('[data-meowz-select-search]');
    if (!picker || !search || picker.dataset.mobileScrollOnly === 'true') return;

    picker.dataset.mobileScrollOnly = 'true';
    search.hidden = true;
    search.readOnly = true;
    search.inputMode = 'none';
    search.tabIndex = -1;

    const count = picker.querySelector('.meowz-select-menu-head small');
    if (count && !picker.querySelector('[data-role-scroll-hint]')) {
      count.insertAdjacentHTML('afterend', '<em class="dash-role-scroll-hint" data-role-scroll-hint>Scroll to choose</em>');
    }
  });
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    stabilize(document);
  });
}

export function initLevelingMobileDropdown() {
  if (initialized || !document.body) return;
  initialized = true;
  stabilize(document);
  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
}
