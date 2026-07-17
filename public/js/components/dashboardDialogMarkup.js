function ensureStyle(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export function initDashboardDialogMarkup() {
  ensureStyle('meowz-leveling-role-manager-css', '/css/dashboard/leveling-role-manager.css');
  ensureStyle('meowz-leveling-role-actions-css', '/css/dashboard/leveling-role-actions.css');
  if (document.querySelector('[data-dashboard-action-dialog]')) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'dash-confirm-dialog';
  dialog.setAttribute('data-dashboard-action-dialog', '');
  dialog.innerHTML = `
    <div class="dash-confirm-surface">
      <div class="dash-confirm-icon" data-action-icon>!</div>
      <div class="dash-confirm-copy">
        <span data-action-label>Confirm action</span>
        <h2 data-action-title>Are you sure?</h2>
        <p data-action-description></p>
        <div class="dash-confirm-impact" data-action-impact hidden></div>
      </div>
      <label class="dash-field" data-action-confirm-field hidden>
        <span>Type <b data-action-confirm-name></b> to confirm</span>
        <input type="text" autocomplete="off" data-action-confirm-input />
      </label>
      <div class="dash-confirm-actions">
        <button type="button" class="dash-secondary-btn" data-action-cancel>Cancel</button>
        <button type="button" class="dash-danger-btn" data-action-submit>Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
}
