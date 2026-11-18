import { escapeHtml, formatNumber } from '../../utils.js';

function infoRow(label, value) {
  return `<div class="dash-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

/** Server overview view; routing and simulation handlers remain in dashboard.js. */
export function renderOverviewPage(server, { sectionPath, simulationPanel }) {
  return `<section class="dash-grid two"><article class="dash-card"><span>Information</span><h2>Server information</h2><div class="dash-info-list">${infoRow('Name',server.name)}${infoRow('Server ID',server.id)}${infoRow('Members',typeof server.memberCount === 'number' ? formatNumber(server.memberCount) : 'Unavailable')}${infoRow('Status','Meowz installed')}</div></article><article class="dash-card"><span>Permissions</span><h2>Dashboard access</h2><div class="dash-info-list">${infoRow('Your access',server.accessLabel || 'Manage Server')}${infoRow('Dashboard access','Allowed')}${infoRow('View mode',server.ownerView ? 'Owner View' : 'User View')}</div></article></section><section class="dash-card"><span>Server tools</span><h2>Configure Meowz</h2><div class="dash-feature-grid">${[['welcome','Welcome / Goodbye','Member join and leave messages.'],['leveling','Leveling System','XP, cooldowns and level rewards.'],['ai-image-access','AI Image Access','Control who can use image editing.'],['logs','Logs','Server activity and audit events.'],['moderation','Moderation','Warnings and automod settings.']].map(([key,title,desc]) => `<a href="${escapeHtml(sectionPath(server,key))}" class="dash-feature-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></a>`).join('')}</div></section>${simulationPanel('Test bot connection', 'Verify that the website can reach Meowz and that the bot can see this server.', [{ event: 'connection', label: 'Test Connection', primary: true }])}`;
}

