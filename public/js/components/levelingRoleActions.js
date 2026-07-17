import { deleteLevelReward } from '../api.js';
import { showStatusToast } from '../toast.js';
import { deleteGuildRole } from './roleApi.js';
import { openDashboardDialog } from './dashboardDialog.js';

let initialized = false;
let observer = null;
let frame = 0;

function isDemoMode() {
  return document.body.classList.contains('demo-mode') || window.location.pathname.startsWith('/demo');
}

function formGuildId(form) {
  return String(form?.dataset?.guildId || '').trim();
}

function selectedRole(form) {
  const select = form?.querySelector('select[name="rewardRoleId"]');
  const option = select?.options?.[select.selectedIndex];
  return option?.value ? { id: String(option.value), name: String(option.textContent || '').trim().replace(/^@/, '') } : null;
}

function resetRoleSelect(form, removedRoleId) {
  const select = form?.querySelector('select[name="rewardRoleId"]');
  if (!(select instanceof HTMLSelectElement)) return;
  select.nextElementSibling?.matches('[data-meowz-select]') && select.nextElementSibling.remove();
  const replacement = select.cloneNode(true);
  replacement.querySelector(`option[value="${CSS.escape(String(removedRoleId))}"]`)?.remove();
  const next = [...replacement.options].find((option) => option.value)?.value || '';
  replacement.value = next;
  replacement.disabled = !next;
  replacement.classList.remove('meowz-native-select');
  replacement.removeAttribute('aria-hidden');
  replacement.removeAttribute('tabindex');
  delete replacement.dataset.meowzSelectReady;
  select.replaceWith(replacement);
  replacement.dispatchEvent(new Event('change', { bubbles: true }));
}

function ensureDeletePanel(form) {
  if (!form || form.querySelector('[data-role-delete-panel]')) return;
  const creator = form.querySelector('[data-level-role-creator]');
  if (!creator) return;
  creator.querySelector('[data-create-guild-role]')?.replaceChildren(document.createTextNode('Create & select'));
  creator.insertAdjacentHTML('beforeend', `
    <div class="dash-role-delete-panel" data-role-delete-panel>
      <div><small>Selected reward role</small><strong data-selected-role-label>No role selected</strong></div>
      <button type="button" class="dash-role-delete-btn" data-delete-selected-role disabled>Delete role</button>
    </div>`);
}

function prepareRemoveButtons(form) {
  form?.querySelectorAll('[data-remove-level-reward]').forEach((button) => {
    button.dataset.rewardRemoveRequest = button.dataset.removeLevelReward;
    delete button.dataset.removeLevelReward;
    button.classList.add('dash-reward-remove-btn');
  });
}

function updateDeletePanel(form) {
  const role = selectedRole(form);
  const label = form?.querySelector('[data-selected-role-label]');
  const button = form?.querySelector('[data-delete-selected-role]');
  if (label) label.textContent = role ? `@${role.name}` : 'No role selected';
  if (button) {
    button.disabled = !role || isDemoMode();
    button.dataset.roleId = role?.id || '';
    button.dataset.roleName = role?.name || '';
  }
}

function scan(root = document) {
  const forms = [];
  if (root instanceof HTMLFormElement && root.matches('[data-settings-form="leveling"]')) forms.push(root);
  root.querySelectorAll?.('[data-settings-form="leveling"]').forEach((form) => forms.push(form));
  forms.forEach((form) => {
    ensureDeletePanel(form);
    prepareRemoveButtons(form);
    updateDeletePanel(form);
    const save = form.querySelector('[data-add-level-reward]');
    if (save && save.textContent !== 'Save reward') save.textContent = 'Save reward';
  });
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    scan(document);
  });
}

function rewardLevelsForRole(form, roleName) {
  return [...form.querySelectorAll('.dash-role-row')]
    .filter((row) => String(row.querySelector('strong')?.textContent || '').trim().replace(/^@/, '') === roleName)
    .map((row) => Number(row.querySelector('[data-reward-remove-request]')?.dataset.rewardRemoveRequest))
    .filter(Number.isInteger);
}

function requestRewardRemoval(button) {
  const form = button.closest('[data-settings-form="leveling"]');
  const guildId = formGuildId(form);
  const level = Number(button.dataset.rewardRemoveRequest);
  const row = button.closest('.dash-role-row');
  const roleName = String(row?.querySelector('strong')?.textContent || 'the selected role').trim();
  if (!form || !guildId || !Number.isInteger(level)) return;
  if (isDemoMode()) return showStatusToast('info', 'Demo mode is read-only', 'Reward roles cannot be changed in demo mode.');

  openDashboardDialog({
    label: 'Level reward',
    title: `Remove the Level ${level} reward?`,
    description: `Members will no longer receive ${roleName} when they reach Level ${level}.`,
    impact: 'The Discord role itself will remain in the server.',
    confirmLabel: 'Remove reward',
    pendingLabel: 'Removing reward...',
    onConfirm: async () => {
      try {
        await deleteLevelReward(guildId, level);
        row?.remove();
        showStatusToast('success', 'Reward removed', `The Level ${level} reward mapping was removed.`);
      } catch (error) {
        showStatusToast('error', 'Reward removal failed', error.message || 'Could not remove the reward.');
        throw error;
      }
    },
  });
}

function requestRoleDeletion(button) {
  const form = button.closest('[data-settings-form="leveling"]');
  const guildId = formGuildId(form);
  const roleId = String(button.dataset.roleId || '');
  const roleName = String(button.dataset.roleName || '');
  if (!form || !guildId || !roleId || !roleName) return;
  if (isDemoMode()) return showStatusToast('info', 'Demo mode is read-only', 'Discord roles cannot be deleted in demo mode.');

  const levels = rewardLevelsForRole(form, roleName);
  openDashboardDialog({
    label: 'Discord role',
    title: `Delete @${roleName}?`,
    description: 'This permanently deletes the role from Discord and cannot be undone.',
    impact: levels.length ? `Also removes ${levels.length} linked reward mapping${levels.length === 1 ? '' : 's'}: ${levels.map((level) => `Level ${level}`).join(', ')}.` : 'No configured level rewards currently use this role.',
    confirmText: roleName,
    confirmLabel: 'Delete role',
    pendingLabel: 'Deleting role...',
    onConfirm: async () => {
      try {
        const data = await deleteGuildRole(guildId, roleId, roleName);
        resetRoleSelect(form, roleId);
        const removed = Array.isArray(data.removedRewardLevels) ? data.removedRewardLevels.map(Number) : levels;
        removed.forEach((level) => form.querySelector(`[data-reward-remove-request="${CSS.escape(String(level))}"]`)?.closest('.dash-role-row')?.remove());
        updateDeletePanel(form);
        showStatusToast(data.ok === false ? 'error' : 'success', data.ok === false ? 'Role deleted with warning' : 'Discord role deleted', data.message || `Deleted @${roleName}.`);
      } catch (error) {
        showStatusToast('error', 'Role deletion failed', error.message || 'Could not delete the Discord role.');
        throw error;
      }
    },
  });
}

function handleClick(event) {
  const rewardButton = event.target.closest?.('[data-reward-remove-request]');
  if (rewardButton) {
    event.preventDefault();
    requestRewardRemoval(rewardButton);
    return;
  }
  const roleButton = event.target.closest?.('[data-delete-selected-role]');
  if (roleButton) {
    event.preventDefault();
    requestRoleDeletion(roleButton);
  }
}

export function initLevelingRoleActions() {
  if (initialized || !document.body) return;
  initialized = true;
  scan(document);
  document.addEventListener('click', handleClick);
  document.addEventListener('change', (event) => {
    if (event.target.matches?.('select[name="rewardRoleId"]')) updateDeletePanel(event.target.closest('[data-settings-form="leveling"]'));
  });
  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
}
