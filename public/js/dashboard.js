import { getDashboardGuilds, getDashboardServer } from './api.js';
import { escapeHtml, formatNumber, setText } from './utils.js';

const els = {
  home: document.querySelector('[data-dashboard-home]'),
  detail: document.querySelector('[data-server-detail]'),
  title: document.querySelector('[data-dashboard-title]'),
  intro: document.querySelector('[data-dashboard-intro]'),
  installed: document.querySelector('[data-installed-servers]'),
  available: document.querySelector('[data-available-servers]'),
  installedCount: document.querySelector('[data-installed-count]'),
  availableCount: document.querySelector('[data-available-count]'),
  heroManagedCount: document.querySelector('[data-dashboard-managed-count]'),
  heroAvailableCount: document.querySelector('[data-dashboard-available-count]'),
  detailContent: document.querySelector('[data-server-detail-content]'),
};

function currentServerId() {
  const match = window.location.pathname.match(/^\/dashboard\/server\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function serverInitial(name = 'S') {
  return escapeHtml((name.trim().charAt(0) || 'S').toUpperCase());
}

function serverIcon(server, className = 'server-icon') {
  if (server.iconUrl) {
    return `<span class="${className}"><img src="${escapeHtml(server.iconUrl)}" alt="" loading="lazy" /></span>`;
  }
  return `<span class="${className} ${className}-fallback">${serverInitial(server.name)}</span>`;
}

function serverSubtitle(server, fallback) {
  if (typeof server.memberCount === 'number') return `${formatNumber(server.memberCount)} members`;
  return fallback;
}

function renderServerList(container, servers, type) {
  if (!container) return;

  if (!servers.length) {
    container.innerHTML = type === 'installed'
      ? `<div class="server-empty-state"><strong>No manageable servers with Meowz yet.</strong><span>Invite Meowz to a server where you have Manage Server permissions to start managing it here.</span></div>`
      : `<div class="server-empty-state"><strong>Meowz is already installed in all your manageable servers.</strong><span>If you get access to another server later, it will appear here.</span></div>`;
    return;
  }

  container.innerHTML = servers.map((server) => {
    const isInstalled = type === 'installed';
    const href = isInstalled ? server.manageUrl : server.inviteUrl;
    const label = isInstalled ? 'Open' : 'Invite';
    const subtitle = isInstalled ? serverSubtitle(server, 'Meowz installed') : 'You can invite Meowz here';
    const target = isInstalled ? '' : ' target="_blank" rel="noopener noreferrer"';

    return `
      <a class="server-row" href="${escapeHtml(href || '#')}"${target}>
        ${serverIcon(server)}
        <span class="server-row-main">
          <strong>${escapeHtml(server.name)}</strong>
          <span>${escapeHtml(subtitle)}</span>
        </span>
        <span class="server-row-action">${escapeHtml(label)}</span>
      </a>
    `;
  }).join('');
}

function renderDashboard(data) {
  const installed = Array.isArray(data.installed) ? data.installed : [];
  const available = Array.isArray(data.available) ? data.available : [];
  setText(els.installedCount, `${installed.length} server${installed.length === 1 ? '' : 's'}`);
  setText(els.availableCount, `${available.length} server${available.length === 1 ? '' : 's'}`);
  setText(els.heroManagedCount, formatNumber(installed.length));
  setText(els.heroAvailableCount, formatNumber(available.length));
  renderServerList(els.installed, installed, 'installed');
  renderServerList(els.available, available, 'available');
}

function renderDashboardError(message) {
  const html = `<div class="server-empty-state error"><strong>Could not load servers.</strong><span>${escapeHtml(message || 'Try logging out and logging in again.')}</span></div>`;
  if (els.installed) els.installed.innerHTML = html;
  if (els.available) els.available.innerHTML = html;
}

function renderServerDetail(data) {
  if (!els.home || !els.detail || !els.detailContent) return;
  const server = data.server;
  els.home.hidden = true;
  els.detail.hidden = false;
  document.title = `${server.name} — Meowz Dashboard`;

  const memberText = typeof server.memberCount === 'number' ? `${formatNumber(server.memberCount)} member${server.memberCount === 1 ? '' : 's'}` : 'Members unavailable';
  const tools = [
    ['Leveling settings', 'XP system, level roles and leaderboards.'],
    ['Welcome messages', 'Member join and leave messages.'],
    ['Logs', 'Server activity and audit events.'],
    ['AI image access', 'Control who can use image editing.'],
    ['Moderation tools', 'Warnings, automod and actions.'],
  ];

  els.detailContent.innerHTML = `
    <div class="server-detail-hero">
      <a class="server-breadcrumb" href="/dashboard">Dashboard / ${escapeHtml(server.name)}</a>
      <div class="server-detail-heading">
        ${serverIcon(server, 'server-detail-icon')}
        <div>
          <span class="dashboard-eyebrow">Server overview</span>
          <h2>${escapeHtml(server.name)}</h2>
          <div class="server-detail-pills">
            <span>${escapeHtml(memberText)}</span>
            <span>Manage Server</span>
            <span>Bot Installed</span>
          </div>
          <p class="muted">Basic server information is ready. Customization tools are coming soon.</p>
        </div>
      </div>
    </div>

    <div class="server-detail-grid">
      <article class="dashboard-card compact">
        <span class="dashboard-card-label">Information</span>
        <div class="server-info-list">
          <div><span>Name</span><strong>${escapeHtml(server.name)}</strong></div>
          <div><span>Server ID</span><strong>${escapeHtml(server.id)}</strong></div>
          <div><span>Members</span><strong>${typeof server.memberCount === 'number' ? formatNumber(server.memberCount) : 'Unavailable'}</strong></div>
          <div><span>Status</span><strong>Meowz installed</strong></div>
        </div>
      </article>

      <article class="dashboard-card compact">
        <span class="dashboard-card-label">Permissions</span>
        <div class="server-info-list">
          <div><span>Your access</span><strong>Manage Server</strong></div>
          <div><span>Dashboard access</span><strong>Allowed</strong></div>
          <div><span>Customization</span><strong>Coming soon</strong></div>
        </div>
      </article>

      <article class="dashboard-card compact server-coming-card">
        <span class="dashboard-card-label">Customization coming soon</span>
        <h3>Server tools</h3>
        <p class="muted">These sections will become configurable from the website later.</p>
        <div class="coming-grid">
          ${tools.map(([title, description]) => `<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small><em>Coming soon</em></span>`).join('')}
        </div>
      </article>
    </div>
  `;
}

function renderServerDetailError(message) {
  if (!els.home || !els.detail || !els.detailContent) return;
  els.home.hidden = true;
  els.detail.hidden = false;
  els.detailContent.innerHTML = `
    <div class="dashboard-card server-detail-error">
      <span class="dashboard-card-label">Server unavailable</span>
      <h2>Could not open this server.</h2>
      <p class="muted">${escapeHtml(message || 'You may not have permission to manage this server, or Meowz is not installed there.')}</p>
      <a class="btn btn-secondary" href="/dashboard">Back to dashboard</a>
    </div>
  `;
}

async function loadServerDetail(id) {
  try {
    const data = await getDashboardServer(id);
    renderServerDetail(data);
  } catch (err) {
    renderServerDetailError(err.message);
  }
}

async function loadDashboardHome() {
  if (!els.home) return;
  if (els.detail) els.detail.hidden = true;
  els.home.hidden = false;
  try {
    const data = await getDashboardGuilds();
    renderDashboard(data);
  } catch (err) {
    renderDashboardError(err.message);
  }
}

export function initDashboard() {
  if (!els.home && !els.detail) return;
  const serverId = currentServerId();
  if (serverId) {
    loadServerDetail(serverId);
  } else {
    loadDashboardHome();
  }
}
