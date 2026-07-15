import {
  deleteLevelReward,
  getGuildRoles,
  getLevelRewards,
  getModerationAccess,
  saveLevelReward,
} from '../api.js';
import { showStatusToast } from '../toast.js';
import { escapeHtml } from '../utils.js';
import { renderAccessList } from './accessList.js';

const rememberedForms = new Map();
let observer = null;
let scanFrame = 0;
let initialized = false;

function isDemoMode() {
  return document.body.classList.contains('demo-mode') || window.location.pathname.startsWith('/demo');
}

function guildIdFromForm(form) {
  return String(form?.dataset?.guildId || '').trim();
}

function rememberSettingsForms(root = document) {
  const forms = [];
  if (root instanceof HTMLFormElement && root.matches('[data-settings-form][data-guild-id]')) forms.push(root);
  root.querySelectorAll?.('[data-settings-form][data-guild-id]').forEach((form) => forms.push(form));
  forms.forEach((form) => {
    const guildId = guildIdFromForm(form);
    if (guildId) rememberedForms.set(guildId, form);
  });
}

function activeSettingsForm(guildId) {
  const selector = `[data-settings-form][data-guild-id="${CSS.escape(String(guildId || ''))}"]`;
  return document.querySelector(selector) || rememberedForms.get(String(guildId || '')) || null;
}

function resetNativeSelect(select, options, selectedValue = '') {
  if (!(select instanceof HTMLSelectElement)) return;
  const customRoot = select.nextElementSibling?.matches('[data-meowz-select]') ? select.nextElementSibling : null;
  customRoot?.remove();

  const replacement = select.cloneNode(false);
  replacement.innerHTML = options;
  replacement.disabled = !options;
  replacement.value = selectedValue;
  replacement.classList.remove('meowz-native-select');
  replacement.removeAttribute('aria-hidden');
  replacement.removeAttribute('tabindex');
  delete replacement.dataset.meowzSelectReady;
  select.replaceWith(replacement);
}

function editableRoles(data = {}) {
  return (Array.isArray(data.roles) ? data.roles : [])
    .filter((role) => role?.id && role?.name && role.managed !== true && role.editable !== false)
    .map((role) => ({ id: String(role.id), name: String(role.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function updateRewardRoleSelect(form, rolesData) {
  const select = form?.querySelector('select[name="rewardRoleId"]');
  if (!select || rolesData?.fallback) return;
  const roles = editableRoles(rolesData);
  const current = String(select.value || '');
  const selected = roles.some((role) => role.id === current) ? current : '';
  const options = roles.length
    ? `<option value="">Select role</option>${roles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === selected ? 'selected' : ''}>@${escapeHtml(role.name)}</option>`).join('')}`
    : '<option value="">No editable roles available</option>';
  resetNativeSelect(select, options, selected);
  const replacement = form.querySelector('select[name="rewardRoleId"]');
  if (replacement) replacement.disabled = !roles.length;
}

function clearRewardRows(holder) {
  holder.querySelectorAll(':scope > .dash-role-row, :scope > .dash-empty, :scope > .dash-error, :scope > [data-level-resource-state]')
    .forEach((node) => node.remove());
}

function rewardRowsHtml(rewards = []) {
  if (!rewards.length) {
    return '<div class="dash-empty"><strong>No reward roles configured.</strong><span>Add a level and an editable role above.</span></div>';
  }
  return [...rewards]
    .sort((a, b) => Number(a.level) - Number(b.level))
    .map((reward) => {
      const level = Number(reward.level);
      const role = reward.roleName || reward.role || reward.roleId || 'Unknown role';
      return `<div class="dash-role-row"><span>Level ${escapeHtml(Number.isFinite(level) ? level : reward.level)}</span><strong>@${escapeHtml(role)}</strong><button type="button" data-remove-level-reward="${escapeHtml(reward.level)}">Remove</button></div>`;
    })
    .join('');
}

function resourceWarningHtml(messages = []) {
  const text = messages.filter(Boolean).join(' ') || 'Role data is temporarily unavailable.';
  return `<div class="dash-note dash-note-warning" data-level-resource-state><strong>Leveling data unavailable</strong><span>${escapeHtml(text)}</span><button type="button" class="dash-secondary-btn" data-retry-level-resources>Retry</button></div>`;
}

async function refreshLevelingResources(form, { announce = false } = {}) {
  if (!form?.isConnected || form.dataset.levelResourcesLoading === 'true') return;
  const guildId = guildIdFromForm(form);
  const holder = form.querySelector('[data-level-rewards]');
  if (!guildId || !holder) return;

  form.dataset.levelResourcesLoading = 'true';
  const retry = holder.querySelector('[data-retry-level-resources]');
  if (retry) {
    retry.disabled = true;
    retry.textContent = 'Loading...';
  }

  try {
    const [rolesData, rewardsData] = await Promise.all([getGuildRoles(guildId), getLevelRewards(guildId)]);
    const messages = [];
    if (rolesData?.fallback || rolesData?.ok === false) messages.push(rolesData?.error || 'Editable roles could not be loaded.');
    if (rewardsData?.fallback || rewardsData?.ok === false) messages.push(rewardsData?.error || 'Reward roles could not be loaded.');

    updateRewardRoleSelect(form, rolesData);
    if (!rewardsData?.fallback && rewardsData?.ok !== false) {
      clearRewardRows(holder);
      holder.insertAdjacentHTML('beforeend', rewardRowsHtml(Array.isArray(rewardsData?.rewards) ? rewardsData.rewards : []));
    } else {
      holder.querySelectorAll(':scope > [data-level-resource-state]').forEach((node) => node.remove());
    }

    if (messages.length) {
      holder.insertAdjacentHTML('beforeend', resourceWarningHtml(messages));
      if (announce) showStatusToast('error', 'Leveling data unavailable', messages.join(' '));
    } else if (announce) {
      showStatusToast('success', 'Leveling data refreshed', 'Roles and rewards are up to date.');
    }
  } catch (err) {
    holder.querySelectorAll(':scope > [data-level-resource-state]').forEach((node) => node.remove());
    holder.insertAdjacentHTML('beforeend', resourceWarningHtml([err.message || 'Could not refresh leveling data.']));
    if (announce) showStatusToast('error', 'Leveling data unavailable', err.message || 'Could not refresh roles and rewards.');
  } finally {
    delete form.dataset.levelResourcesLoading;
  }
}

async function addLevelReward(button) {
  const form = button.closest('[data-settings-form="leveling"]');
  const guildId = guildIdFromForm(form);
  if (!form || !guildId) return;
  if (isDemoMode()) {
    showStatusToast('info', 'Demo mode is read-only', 'Reward roles cannot be changed in demo mode.');
    return;
  }

  const levelInput = form.querySelector('input[name="rewardLevel"]');
  const roleSelect = form.querySelector('select[name="rewardRoleId"]');
  const level = Number(levelInput?.value);
  const roleId = String(roleSelect?.value || '').trim();
  if (!Number.isInteger(level) || level < 1 || level > 1000) {
    showStatusToast('error', 'Invalid reward level', 'Use a whole number between 1 and 1000.');
    return;
  }
  if (!/^\d{15,25}$/.test(roleId)) {
    showStatusToast('error', 'Missing reward role', 'Choose an editable Discord role.');
    return;
  }

  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    await saveLevelReward(guildId, level, roleId);
    await refreshLevelingResources(form);
    showStatusToast('success', 'Reward role saved', `Level ${level} now uses the selected role.`);
  } catch (err) {
    showStatusToast('error', 'Reward save failed', err.message || 'Could not save the reward role.');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function removeLevelReward(button) {
  const form = button.closest('[data-settings-form="leveling"]');
  const guildId = guildIdFromForm(form);
  const level = Number(button.dataset.removeLevelReward);
  if (!form || !guildId || !Number.isInteger(level)) return;
  if (isDemoMode()) {
    showStatusToast('info', 'Demo mode is read-only', 'Reward roles cannot be changed in demo mode.');
    return;
  }
  if (!window.confirm(`Remove the reward configured for level ${level}?`)) return;

  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Removing...';
  try {
    await deleteLevelReward(guildId, level);
    await refreshLevelingResources(form);
    showStatusToast('success', 'Reward role removed', `The level ${level} reward was removed.`);
  } catch (err) {
    showStatusToast('error', 'Remove failed', err.message || 'Could not remove the reward role.');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function moderationFallbackActions(holder, data) {
  if (!data?.fallback || holder.querySelector('[data-retry-moderation-access]')) return;
  holder.insertAdjacentHTML('beforeend', '<button type="button" class="dash-secondary-btn" data-retry-moderation-access>Retry trusted users</button>');
}

async function refreshModerationAccess(page, { announce = false } = {}) {
  const holder = page?.querySelector('[data-moderation-access-list]');
  const form = page?.querySelector('[data-access-form="moderation"]');
  const guildId = guildIdFromForm(page?.querySelector('[data-settings-form="moderation"]'));
  if (!holder || !guildId || holder.dataset.reliabilityLoading === 'true') return;

  holder.dataset.reliabilityLoading = 'true';
  const retry = holder.querySelector('[data-retry-moderation-access]');
  if (retry) {
    retry.disabled = true;
    retry.textContent = 'Loading...';
  }
  try {
    const data = await getModerationAccess(guildId);
    if (!holder.isConnected) return;
    holder.innerHTML = renderAccessList(data || {}, 'No manual moderation bypass users.');
    moderationFallbackActions(holder, data);
    if (data?.fallback && announce) {
      showStatusToast('error', 'Trusted users loaded with safe defaults', data.errors?.[0] || 'The live bypass list is temporarily unavailable.');
    } else if (announce) {
      showStatusToast('success', 'Trusted users refreshed', 'The moderation bypass list is up to date.');
    }
    if (form) form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
  } catch (err) {
    if (!holder.isConnected) return;
    holder.innerHTML = renderAccessList({ fallback: true, defaultUsers: [], users: [] }, 'No manual moderation bypass users.');
    moderationFallbackActions(holder, { fallback: true });
    if (announce) showStatusToast('error', 'Could not load trusted users', err.message || 'Try again later.');
  } finally {
    delete holder.dataset.reliabilityLoading;
  }
}

function startModerationWatchdog(page) {
  if (!page || page.dataset.reliabilityWatchdog === 'true') return;
  page.dataset.reliabilityWatchdog = 'true';
  setTimeout(() => {
    if (!page.isConnected) return;
    const holder = page.querySelector('[data-moderation-access-list]');
    const text = String(holder?.textContent || '').toLowerCase();
    if (text.includes('loading bypass') || text.includes('please wait')) {
      void refreshModerationAccess(page);
    }
  }, 6500);
}

function scanDashboard(root = document) {
  rememberSettingsForms(root);
  const levelingForms = [];
  if (root instanceof HTMLFormElement && root.matches('[data-settings-form="leveling"]')) levelingForms.push(root);
  root.querySelectorAll?.('[data-settings-form="leveling"]').forEach((form) => levelingForms.push(form));
  levelingForms.forEach((form) => {
    if (form.dataset.reliabilityLeveling === 'true') return;
    form.dataset.reliabilityLeveling = 'true';
    setTimeout(() => {
      if (form.isConnected) void refreshLevelingResources(form);
    }, 80);
  });

  const moderationPages = [];
  if (root instanceof HTMLElement && root.matches('[data-moderation-page]')) moderationPages.push(root);
  root.querySelectorAll?.('[data-moderation-page]').forEach((page) => moderationPages.push(page));
  moderationPages.forEach(startModerationWatchdog);
}

function scheduleScan() {
  if (scanFrame) return;
  scanFrame = requestAnimationFrame(() => {
    scanFrame = 0;
    scanDashboard(document);
  });
}

function handleCapturedClick(event) {
  const save = event.target.closest?.('[data-save-drafts]');
  if (save) {
    const bar = save.closest('[data-global-save-bar]');
    const guildId = String(bar?.dataset?.guildId || '').trim();
    const form = activeSettingsForm(guildId);
    if (!guildId || !form || save.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    form.dispatchEvent(new Event('submit', { bubbles: false, cancelable: true }));
    return;
  }

  const addReward = event.target.closest?.('[data-add-level-reward]');
  if (addReward) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void addLevelReward(addReward);
    return;
  }

  const removeReward = event.target.closest?.('[data-remove-level-reward]');
  if (removeReward) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void removeLevelReward(removeReward);
    return;
  }

  const retryLevel = event.target.closest?.('[data-retry-level-resources]');
  if (retryLevel) {
    event.preventDefault();
    const form = retryLevel.closest('[data-settings-form="leveling"]');
    void refreshLevelingResources(form, { announce: true });
    return;
  }

  const retryModeration = event.target.closest?.('[data-retry-moderation-access]');
  if (retryModeration) {
    event.preventDefault();
    const page = retryModeration.closest('[data-moderation-page]');
    void refreshModerationAccess(page, { announce: true });
  }
}

export function initDashboardReliability() {
  if (initialized || !document.body) return;
  initialized = true;
  scanDashboard(document);
  document.addEventListener('click', handleCapturedClick, true);
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
}
