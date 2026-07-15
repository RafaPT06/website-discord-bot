import { showStatusToast } from '../toast.js';
import { escapeHtml } from '../utils.js';
import { createGuildRole } from './roleApi.js';

const COLLAPSED_REWARD_LIMIT = 4;
let initialized = false;
let observer = null;
let scanFrame = 0;

function isDemoMode() {
  return document.body.classList.contains('demo-mode') || window.location.pathname.startsWith('/demo');
}

function guildIdFromForm(form) {
  return String(form?.dataset?.guildId || '').trim();
}

function creatorMarkup(form) {
  const rewardLevel = Number(form.querySelector('input[name="rewardLevel"]')?.value || 0);
  const suggestion = Number.isInteger(rewardLevel) && rewardLevel > 0 ? `Level ${rewardLevel}` : 'Level 60';
  const disabled = isDemoMode() ? 'disabled' : '';
  return `<div class="dash-role-create-panel" data-level-role-creator>
    <div class="dash-role-create-copy">
      <strong>Create a Discord role</strong>
      <span>Create the role here, then it will be selected automatically for the reward above.</span>
    </div>
    <div class="dash-role-create-controls">
      <label class="dash-field">
        <span>Role name</span>
        <input type="text" maxlength="100" placeholder="${escapeHtml(suggestion)}" data-new-role-name ${disabled} />
      </label>
      <button type="button" class="dash-secondary-btn" data-create-guild-role ${disabled}>Create role</button>
    </div>
    ${isDemoMode() ? '<small>Role creation is disabled in the read-only demo.</small>' : '<small>Meowz needs Manage Roles permission and must be above the new role.</small>'}
  </div>`;
}

function ensureRoleCreator(form) {
  if (!form || form.querySelector('[data-level-role-creator]')) return;
  const editor = form.querySelector('.dash-reward-editor');
  if (!editor) return;
  editor.insertAdjacentHTML('afterend', creatorMarkup(form));
}

function updateCreatorSuggestion(form) {
  const input = form?.querySelector('[data-new-role-name]');
  if (!input || input.value.trim()) return;
  const level = Number(form.querySelector('input[name="rewardLevel"]')?.value || 0);
  input.placeholder = Number.isInteger(level) && level > 0 ? `Level ${level}` : 'Level 60';
}

function rebuildRoleSelect(form, role) {
  const select = form?.querySelector('select[name="rewardRoleId"]');
  if (!(select instanceof HTMLSelectElement) || !role?.id) return;

  const customRoot = select.nextElementSibling?.matches('[data-meowz-select]')
    ? select.nextElementSibling
    : null;
  customRoot?.remove();

  const replacement = select.cloneNode(true);
  const roleId = String(role.id);
  let option = [...replacement.options].find((item) => item.value === roleId);
  if (!option) {
    option = document.createElement('option');
    option.value = roleId;
    option.textContent = `@${role.name || 'New role'}`;
    replacement.appendChild(option);
  }

  replacement.disabled = false;
  replacement.value = roleId;
  [...replacement.options].forEach((item) => { item.selected = item.value === roleId; });
  replacement.classList.remove('meowz-native-select');
  replacement.removeAttribute('aria-hidden');
  replacement.removeAttribute('tabindex');
  delete replacement.dataset.meowzSelectReady;
  select.replaceWith(replacement);
}

function directRewardRows(holder) {
  return [...holder.querySelectorAll(':scope > .dash-role-row')];
}

function ensureRewardList(holder) {
  const directRows = directRewardRows(holder);
  let list = holder.querySelector(':scope > [data-level-reward-list]');

  if (directRows.length) {
    list?.remove();
    list = document.createElement('div');
    list.className = 'dash-level-reward-list';
    list.setAttribute('data-level-reward-list', '');
    directRows[0].before(list);
    directRows.forEach((row) => list.appendChild(row));
  }

  const empty = holder.querySelector(':scope > .dash-empty, :scope > .dash-error');
  if (empty && !directRows.length && list) {
    list.remove();
    list = null;
  }

  return list;
}

function ensureRewardCount(holder, count) {
  const head = holder.querySelector(':scope > .dash-role-table-head');
  if (!head) return;
  let badge = head.querySelector('[data-level-reward-count]');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'dash-level-reward-count';
    badge.setAttribute('data-level-reward-count', '');
    head.appendChild(badge);
  }
  const text = `${count} configured`;
  if (badge.textContent !== text) badge.textContent = text;
}

function ensureRewardToggle(holder, list, count, expanded) {
  let button = holder.querySelector(':scope > [data-toggle-level-rewards]');
  if (count <= COLLAPSED_REWARD_LIMIT || !list) {
    button?.remove();
    return;
  }

  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'dash-secondary-btn dash-level-reward-toggle';
    button.setAttribute('data-toggle-level-rewards', '');
    list.insertAdjacentElement('afterend', button);
  }

  const text = expanded ? 'Show fewer rewards' : `Show all ${count} rewards`;
  if (button.textContent !== text) button.textContent = text;
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function syncRewardList(holder) {
  if (!holder) return;
  const list = ensureRewardList(holder);
  const rows = list ? [...list.querySelectorAll(':scope > .dash-role-row')] : [];
  let expanded = holder.dataset.rewardsExpanded === 'true';
  if (rows.length <= COLLAPSED_REWARD_LIMIT) expanded = false;
  holder.dataset.rewardsExpanded = expanded ? 'true' : 'false';
  list?.classList.toggle('is-expanded', expanded);

  rows.forEach((row, index) => {
    row.hidden = !expanded && index >= COLLAPSED_REWARD_LIMIT;
  });

  ensureRewardCount(holder, rows.length);
  ensureRewardToggle(holder, list, rows.length, expanded);
}

function scanLeveling(root = document) {
  const forms = [];
  if (root instanceof HTMLFormElement && root.matches('[data-settings-form="leveling"]')) forms.push(root);
  root.querySelectorAll?.('[data-settings-form="leveling"]').forEach((form) => forms.push(form));

  forms.forEach((form) => {
    ensureRoleCreator(form);
    updateCreatorSuggestion(form);
    syncRewardList(form.querySelector('[data-level-rewards]'));
  });
}

function scheduleScan() {
  if (scanFrame) return;
  scanFrame = requestAnimationFrame(() => {
    scanFrame = 0;
    scanLeveling(document);
  });
}

async function createRole(button) {
  const form = button.closest('[data-settings-form="leveling"]');
  const guildId = guildIdFromForm(form);
  const input = form?.querySelector('[data-new-role-name]');
  if (!form || !guildId || !input) return;

  if (isDemoMode()) {
    showStatusToast('info', 'Demo mode is read-only', 'Discord roles cannot be created from the demo dashboard.');
    return;
  }

  const rewardLevel = Number(form.querySelector('input[name="rewardLevel"]')?.value || 0);
  const suggested = Number.isInteger(rewardLevel) && rewardLevel > 0 ? `Level ${rewardLevel}` : '';
  const name = String(input.value || suggested).replace(/\s{2,}/g, ' ').trim();
  if (!name || name.length > 100) {
    showStatusToast('error', 'Invalid role name', 'Use a role name between 1 and 100 characters.');
    input.focus();
    return;
  }

  const original = button.textContent;
  input.disabled = true;
  button.disabled = true;
  button.textContent = 'Creating...';

  try {
    const data = await createGuildRole(guildId, name);
    rebuildRoleSelect(form, data.role);
    input.value = '';
    updateCreatorSuggestion(form);
    showStatusToast(
      'success',
      data.created ? 'Discord role created' : 'Existing role selected',
      data.message || `@${data.role.name || name} is ready to use as a reward.`,
    );
  } catch (err) {
    showStatusToast('error', 'Role creation failed', err.message || 'Could not create the Discord role.');
  } finally {
    input.disabled = false;
    button.disabled = false;
    button.textContent = original;
  }
}

function handleClick(event) {
  const createButton = event.target.closest?.('[data-create-guild-role]');
  if (createButton) {
    event.preventDefault();
    void createRole(createButton);
    return;
  }

  const toggle = event.target.closest?.('[data-toggle-level-rewards]');
  if (toggle) {
    event.preventDefault();
    const holder = toggle.closest('[data-level-rewards]');
    if (!holder) return;
    holder.dataset.rewardsExpanded = holder.dataset.rewardsExpanded === 'true' ? 'false' : 'true';
    syncRewardList(holder);
  }
}

function handleInput(event) {
  if (!event.target.matches?.('input[name="rewardLevel"]')) return;
  updateCreatorSuggestion(event.target.closest('[data-settings-form="leveling"]'));
}

function handleKeydown(event) {
  const input = event.target.closest?.('[data-new-role-name]');
  if (!input || event.key !== 'Enter') return;
  event.preventDefault();
  input.closest('[data-level-role-creator]')?.querySelector('[data-create-guild-role]')?.click();
}

export function initLevelingRoleManager() {
  if (initialized || !document.body) return;
  initialized = true;
  scanLeveling(document);
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
}
