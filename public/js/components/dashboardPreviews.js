import { escapeHtml } from '../utils.js';
import { textChannels, normalizeChannelValue } from './forms.js';

export function simulationPanel(title, description, events = []) {
  const buttons = events.map(({ event, label, primary = false }) => `<button type="button" class="${primary ? 'dash-save-btn' : 'dash-secondary-btn'} dash-simulation-btn" data-simulation-event="${escapeHtml(event)}">${escapeHtml(label)}</button>`).join('');
  return `<article class="dash-card dash-simulation-card" data-simulation-panel><span>Simulation</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><div class="dash-simulation-actions">${buttons}</div><div class="dash-simulation-result" data-simulation-result hidden aria-live="polite"></div><small class="preview-note">Discord simulations use the last saved settings and never grant XP, roles, warnings or punishments.</small></article>`;
}

function renderTemplate(template, server) {
  return String(template || '').replaceAll('{user}', 'Rafa').replaceAll('{server}', server.name).replaceAll('{memberCount}', '11');
}
function messagePreviewLine(server, template, fallback) {
  return renderTemplate(template || fallback, server).split('\n').map(x => x.trim()).filter(Boolean).join(' ');
}
function selectedChannelName(server, channelId, fallback) {
  const channels = textChannels(server);
  const found = channels.find((channel) => channel.id === String(channelId) || normalizeChannelValue(channel.name) === normalizeChannelValue(channelId));
  return `#${escapeHtml((found?.name || fallback || 'channel').replace(/^#\s*/, ''))}`;
}
export function welcomePreview(server, settings, { livePreviewShell }) {
  const welcomeText = messagePreviewLine(server, settings.welcomeMessage, `Welcome {user} to {server}!`);
  const goodbyeText = messagePreviewLine(server, settings.goodbyeMessage, `Goodbye {user}.`);
  const welcomeCardMarkup = settings.welcomeStyle === 'Text only' ? '' : livePreviewShell('welcome', 'Welcome card preview');
  const goodbyeCardMarkup = settings.goodbyeStyle === 'Text only' ? '' : livePreviewShell('goodbye', 'Goodbye card preview');
  return `<article class="dash-card dash-preview" data-welcome-preview><span>Live Preview</span><h2>Discord preview</h2><p>The Discord message remains fully editable. The attached image is a compact profile card that avoids long-text wrapping.</p><div class="dash-discord-stack"><div class="dash-discord-message"><div class="bot-avatar">M</div><div><div class="msg-head"><strong>Meowz</strong><em>APP</em><small>${selectedChannelName(server, settings.welcomeChannelId, 'welcome')}</small></div><p>${escapeHtml(welcomeText)}</p>${welcomeCardMarkup}</div></div><div class="dash-discord-message goodbye"><div class="bot-avatar">M</div><div><div class="msg-head"><strong>Meowz</strong><em>APP</em><small>${selectedChannelName(server, settings.goodbyeChannelId, 'bye')}</small></div><p>${escapeHtml(goodbyeText)}</p>${goodbyeCardMarkup}</div></div></div><small class="preview-note">These previews regenerate live and do not require saving first.</small></article>`;
}
