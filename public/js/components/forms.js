import { escapeHtml } from '../utils.js';

export function switchField(name, checked, label, desc) {
  return `<label class="dash-switch"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}/><i></i><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(desc)}</small></span></label>`;
}

export function textField(name, label, value, placeholder='') {
  return `<label class="dash-field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}" /></label>`;
}

export function numberField(name, label, value, min=0) {
  return `<label class="dash-field"><span>${escapeHtml(label)}</span><input type="number" min="${Number(min)}" name="${escapeHtml(name)}" value="${escapeHtml(String(value ?? ''))}" /></label>`;
}

export function textareaField(name, label, value, max=200) {
  return `<label class="dash-field"><span>${escapeHtml(label)}</span><textarea name="${escapeHtml(name)}" maxlength="${Number(max)}">${escapeHtml(value ?? '')}</textarea><small><b data-count-for="${escapeHtml(name)}">${String(value ?? '').length}</b>/${Number(max)}</small></label>`;
}

export function variableButtons(target = 'welcomeMessage', label = 'Insert Variable') {
  return `<div class="dash-variable-row"><span>${escapeHtml(label)}</span><div>${['{user}','{server}','{memberCount}'].map(v => `<button type="button" data-insert-variable="${v}" data-insert-target="${escapeHtml(target)}">${v}</button>`).join('')}</div></div>`;
}

export function saveBtn(label = 'Save Changes') {
  return `<button class="dash-save-btn dash-tab-save-legacy" type="submit" hidden>${escapeHtml(label)}</button>`;
}

export function normalizeChannelValue(value) {
  return String(value ?? '').trim().replace(/^#\s*/, '').toLowerCase();
}

export function textChannels(server) {
  const channels = Array.isArray(server?.channels) ? server.channels : [];
  return channels
    .filter((channel) => {
      const type = String(channel.type ?? channel.channelType ?? '').toUpperCase();
      return !type || type === '0' || type === 'GUILD_TEXT' || type === 'TEXT' || type === 'ANNOUNCEMENT' || type === 'GUILD_ANNOUNCEMENT';
    })
    .map((channel) => ({
      id: String(channel.id ?? channel.value ?? channel.name ?? ''),
      name: String(channel.name ?? channel.label ?? channel.id ?? 'channel').replace(/^#\s*/, ''),
    }))
    .filter((channel) => channel.id && channel.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function channelSelectField(server, name, label, value, fallbackName = 'general') {
  const channels = textChannels(server);
  const current = normalizeChannelValue(value || fallbackName);
  if (!channels.length) {
    const savedValue = value === undefined || value === null ? '' : String(value);
    return `<label class="dash-field"><span>${escapeHtml(label)}</span><select data-meowz-select-ignore disabled><option>Channel list unavailable</option></select><input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(savedValue)}" /><small>The saved channel is preserved, but the channel list could not be loaded.</small></label>`;
  }
  const hasCurrent = channels.some((channel) => channel.id === String(value) || normalizeChannelValue(channel.name) === current);
  const options = channels.map((channel) => {
    const selected = channel.id === String(value) || normalizeChannelValue(channel.name) === current;
    return `<option value="${escapeHtml(channel.id)}" ${selected ? 'selected' : ''}>#${escapeHtml(channel.name)}</option>`;
  }).join('');
  const custom = hasCurrent || !value ? '' : `<option value="${escapeHtml(String(value))}" selected>#${escapeHtml(String(value).replace(/^#\s*/, ''))}</option>`;
  return `<label class="dash-field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}">${custom}${options}</select></label>`;
}

export function guildRoles(server) {
  const roles = Array.isArray(server?.roles) ? server.roles : [];
  return roles
    .filter((role) => role && role.id && role.name && role.editable !== false && role.managed !== true)
    .map((role) => ({ id: String(role.id), name: String(role.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function roleSelectField(server, name, label, value) {
  const roles = guildRoles(server);
  if (!roles.length) return `<label class="dash-field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}" disabled><option>No editable roles available</option></select></label>`;
  return `<label class="dash-field"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}"><option value="">Select role</option>${roles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === String(value || '') ? 'selected' : ''}>@${escapeHtml(role.name)}</option>`).join('')}</select></label>`;
}
