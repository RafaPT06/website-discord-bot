from pathlib import Path
import json

root = Path('.')

p = root / 'public/js/dashboard.js'
s = p.read_text()
s = s.replace("const status = form.querySelector('.dash-form-card .dash-card-head .status');", "const status = form.querySelector('.dash-card-head .status');")
old = '''function moderationPage(server) {
  const s = readSettings(server.id, 'moderation', { enabled:false, warningsEnabled:true, automodEnabled:false, antiSpam:false, linkFilter:false, inviteFilter:false, modLogChannelId:'demo-ch-mod-logs', blockedWords:'' }, server);
  return `<form class="dash-designer dash-moderation-layout" data-settings-form="moderation" data-guild-id="${escapeHtml(server.id)}"><article class="dash-card dash-form-card"><div class="dash-card-head"><div><span>Moderation</span><h2>Moderation Tools</h2><p>Configure warnings, filters and moderation controls used by the bot.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>${switchField('enabled',s.enabled,'Enable moderation tools','Turn on configurable moderation features.')}<hr/>${channelSelectField(server,'modLogChannelId','Mod log channel',s.modLogChannelId ?? s.channel,'mod-logs')}${switchField('warningsEnabled',s.warningsEnabled ?? s.warnings,'Warning system','Allow moderators to warn users.')}${switchField('automodEnabled',s.automodEnabled,'Blocked words','Enable blocked word checks.')}${switchField('antiSpam',s.antiSpam,'Anti-spam','Detect repeated messages automatically.')}${switchField('linkFilter',s.linkFilter ?? s.antiLinks,'Link filter','Block links from non-trusted users.')}${switchField('inviteFilter',s.inviteFilter ?? s.antiInvites,'Invite filter','Block Discord invite links.')}${textareaField('blockedWords','Blocked words',s.blockedWords || '',500)}${saveBtn()}</article><article class="dash-card dash-form-card" data-moderation-access><span>Bypass Access</span><h2>Trusted users</h2><p>Bot owner and users with Manage Server bypass moderation filters by default. Add extra trusted users by username search or Discord ID.</p>${userAccessForm('moderation', 'Search user or paste ID')}<div data-moderation-access-list>${emptyState('Loading bypass list...', 'Please wait.')}</div></article><article class="dash-card dash-automation-card"><span>Rules</span><h2>Automation</h2><div class="dash-feature-grid compact">${['Warnings','Anti-spam','Link filter','Invite filter','Mod logs'].map(x => `<div class="dash-feature-card"><strong>${x}</strong><span>Connected to bot API.</span></div>`).join('')}</div></article></form>`;
}'''
new = '''function moderationPage(server) {
  const s = readSettings(server.id, 'moderation', { enabled:false, warningsEnabled:true, automodEnabled:false, antiSpam:false, linkFilter:false, inviteFilter:false, modLogChannelId:'demo-ch-mod-logs', blockedWords:'' }, server);
  return `<section class="dash-designer dash-moderation-layout" data-moderation-page>
    <form class="dash-card dash-form-card dash-moderation-settings" data-settings-form="moderation" data-guild-id="${escapeHtml(server.id)}">
      <div class="dash-card-head"><div><span>Moderation</span><h2>Moderation Tools</h2><p>Configure warnings, filters and moderation controls used by the bot.</p></div><b class="status ${s.enabled?'enabled':''}">${s.enabled?'Enabled':'Disabled'}</b></div>
      ${switchField('enabled',s.enabled,'Enable moderation tools','Turn on configurable moderation features.')}<hr/>
      ${channelSelectField(server,'modLogChannelId','Mod log channel',s.modLogChannelId ?? s.channel,'mod-logs')}
      ${switchField('warningsEnabled',s.warningsEnabled ?? s.warnings,'Warning system','Allow moderators to warn users.')}
      ${switchField('automodEnabled',s.automodEnabled,'Blocked words','Enable blocked word checks.')}
      ${switchField('antiSpam',s.antiSpam,'Anti-spam','Detect repeated messages automatically.')}
      ${switchField('linkFilter',s.linkFilter ?? s.antiLinks,'Link filter','Block links from non-trusted users.')}
      ${switchField('inviteFilter',s.inviteFilter ?? s.antiInvites,'Invite filter','Block Discord invite links.')}
      ${textareaField('blockedWords','Blocked words',s.blockedWords || '',500)}
      ${saveBtn()}
    </form>
    <article class="dash-card dash-form-card dash-moderation-access-card" data-moderation-access>
      <span>Bypass Access</span><h2>Trusted users</h2><p>Bot owner and users with Manage Server bypass moderation filters by default. Add extra trusted users by username search or Discord ID.</p>
      ${userAccessForm('moderation', 'Search user or paste ID')}
      <div data-moderation-access-list aria-live="polite">${emptyState('Loading bypass list...', 'Please wait.')}</div>
    </article>
    <article class="dash-card dash-automation-card"><span>Rules</span><h2>Automation</h2><div class="dash-feature-grid compact">${['Warnings','Anti-spam','Link filter','Invite filter','Mod logs'].map(x => `<div class="dash-feature-card"><strong>${x}</strong><span>Connected to bot API.</span></div>`).join('')}</div></article>
  </section>`;
}'''
if old not in s:
    raise RuntimeError('moderationPage block not found')
s = s.replace(old, new)

old = '''async function loadModerationAccess(guildId) {
  const holder = document.querySelector('[data-moderation-access-list]');
  if (!holder) return;
  holder.innerHTML = emptyState('Loading bypass list...', 'Please wait.');
  const fallback = { ok: true, defaultUsers: [], users: [], fallback: true, warning: 'Moderation access took too long to respond.' };
  try {
    const data = await Promise.race([
      getModerationAccess(guildId),
      new Promise((resolve) => setTimeout(() => resolve(fallback), 9000)),
    ]);
    holder.innerHTML = renderAccessList(data, 'No manual moderation bypass users.');
  } catch (err) {
    holder.innerHTML = renderAccessList({ ok: true, defaultUsers: [], users: [], fallback: true, error: err.message }, 'No manual moderation bypass users.');
    showStatusToast('error', 'Moderation bypass loaded with fallback', err.message || 'The bot API did not respond in time.');
  }
}'''
new = '''async function loadModerationAccess(guildId, holder = document.querySelector('[data-moderation-access-list]')) {
  if (!holder) return;
  const requestId = `${guildId}:${Date.now()}:${Math.random()}`;
  holder.dataset.moderationRequestId = requestId;
  holder.innerHTML = emptyState('Loading bypass list...', 'Fetching trusted users from the bot API.');
  try {
    const data = await getModerationAccess(guildId);
    if (!holder.isConnected || holder.dataset.moderationRequestId !== requestId) return;
    holder.innerHTML = renderAccessList(data || {}, 'No manual moderation bypass users.');
  } catch (err) {
    if (!holder.isConnected || holder.dataset.moderationRequestId !== requestId) return;
    holder.innerHTML = renderAccessList({ ok: true, defaultUsers: [], users: [], fallback: true, error: err.message }, 'No manual moderation bypass users.');
    showStatusToast('error', 'Moderation bypass loaded with fallback', err.message || 'The bot API did not respond in time.');
  }
}'''
if old not in s:
    raise RuntimeError('loadModerationAccess block not found')
s = s.replace(old, new)

old = '''function attachModerationAccess(server) {
  const form = document.querySelector('[data-access-form="moderation"]');
  if (!form) return;
  loadModerationAccess(server.id);
  attachUserSearch(form, server);'''
new = '''function attachModerationAccess(server) {
  const page = document.querySelector('[data-moderation-page]');
  const holder = page?.querySelector('[data-moderation-access-list]');
  if (!page || !holder) return;
  loadModerationAccess(server.id, holder);
  const form = page.querySelector('[data-access-form="moderation"]');
  if (!form) {
    holder.innerHTML = errorCard('Could not initialize trusted users.', 'The moderation access form is unavailable.');
    return;
  }
  attachUserSearch(form, server);'''
if old not in s:
    raise RuntimeError('attachModerationAccess block not found')
s = s.replace(old, new)
s = s.replace("  const list = document.querySelector('[data-moderation-access-list]');\n  list?.addEventListener", "  holder.addEventListener", 1)
s = s.replace("await loadModerationAccess(server.id);", "await loadModerationAccess(server.id, holder);")
p.write_text(s)

p = root / 'public/js/api.js'
s = p.read_text()
old = '''export async function getModerationAccess(guildId) {
  if (isDemoRoute()) return Promise.resolve({ ...DEMO_MODERATION_ACCESS });
  try {
    return await fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/moderation-access`, { cacheKey: `moderation-access:${guildId}`, cacheMs: 15000, timeoutMs: 9000 });
  } catch (err) {
    return { ok: true, users: [], defaultUsers: [], fallback: true, error: err.message || 'Moderation access API unavailable.' };
  }
}'''
new = '''export function getModerationAccess(guildId) {
  if (isDemoRoute()) return Promise.resolve({ ...DEMO_MODERATION_ACCESS });
  return fetchJson(`/api/dashboard/servers/${encodeURIComponent(guildId)}/moderation-access`, {
    cacheKey: `moderation-access:${guildId}`,
    cacheMs: 15000,
    timeoutMs: 9000,
  });
}'''
if old not in s:
    raise RuntimeError('getModerationAccess block not found')
p.write_text(s.replace(old, new))

p = root / 'public/js/components/accessList.js'
s = p.read_text()
old = '''export function renderAccessList(data, manualEmpty = 'No manually added users.') {
  const { defaultUsers, manual } = normalizeAccessPayload(data);
  const owner = defaultUsers.filter((user) => ['bot_owner', 'owner'].includes(String(user.source || user.type || '').toLowerCase()));
  const managers = defaultUsers.filter((user) => !owner.includes(user));
  return `<div class="dash-access-list"><div class="dash-note"><strong>Default access</strong><span>Bot owner and users with Manage Server are included automatically and cannot be removed.</span></div>${owner.map(u => accessUserRow(u, false, 'Bot Owner')).join('')}${managers.map(u => accessUserRow(u, false, 'Manage Server')).join('')}${manual.length ? `<h3>Manual access</h3>${manual.map(u => accessUserRow(u, true, 'Manual')).join('')}` : emptyState(manualEmpty, 'Search by username or paste a Discord ID to add someone.')}</div>`;
}'''
new = '''export function renderAccessList(data = {}, manualEmpty = 'No manually added users.') {
  const { defaultUsers, manual } = normalizeAccessPayload(data);
  const owner = defaultUsers.filter((user) => ['bot_owner', 'owner'].includes(String(user.source || user.type || '').toLowerCase()));
  const managers = defaultUsers.filter((user) => !owner.includes(user));
  const fallbackNote = data?.fallback
    ? '<div class="dash-note dash-note-warning"><strong>Limited access data</strong><span>The live moderation access API is unavailable, so safe defaults are shown for now.</span></div>'
    : '';
  return `<div class="dash-access-list">${fallbackNote}<div class="dash-note"><strong>Default access</strong><span>Bot owner and users with Manage Server are included automatically and cannot be removed.</span></div>${owner.map(u => accessUserRow(u, false, 'Bot Owner')).join('')}${managers.map(u => accessUserRow(u, false, 'Manage Server')).join('')}${manual.length ? `<h3>Manual access</h3>${manual.map(u => accessUserRow(u, true, 'Manual')).join('')}` : emptyState(manualEmpty, 'Search by username or paste a Discord ID to add someone.')}</div>`;
}'''
if old not in s:
    raise RuntimeError('renderAccessList block not found')
p.write_text(s.replace(old, new))

for name in ['dashboard.html', 'demo.html']:
    p = root / 'public' / name
    s = p.read_text()
    p.write_text(s.replace('  <script type="module" src="/js/dashboardFlowFixes.js"></script>\n', ''))

p = root / 'public/css/main.css'
s = p.read_text()
start = s.find('/* ===== 2026-07-10 floating dashboard state cards =====')
end = s.find('/* ===== 2026-07-10 dashboard flow + mobile nav reconstruction =====')
if start < 0 or end <= start:
    raise RuntimeError('obsolete floating save block not found')
s = s[:start] + s[end:]
old = '''.dash-moderation-layout {
  gap: clamp(1rem, 2vw, 1.35rem) !important;
  row-gap: clamp(1.1rem, 2.5vw, 1.5rem) !important;
}
.dash-moderation-layout > .dash-card {
  min-width: 0;
}
.dash-automation-card {
  align-self: start;
}'''
new = '''.dash-moderation-layout {
  display: grid !important;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr) !important;
  align-items: start !important;
  gap: clamp(1.1rem, 2.4vw, 1.55rem) !important;
}
.dash-moderation-layout > .dash-card {
  min-width: 0;
  margin: 0 !important;
}
.dash-moderation-settings {
  grid-row: span 2;
}
.dash-moderation-access-card,
.dash-automation-card {
  align-self: start;
}'''
if old not in s:
    raise RuntimeError('moderation CSS block not found')
s = s.replace(old, new)
s = s.replace('  .dash-moderation-layout { gap: clamp(1rem, 2.8dvh, 1.25rem) !important; }\n  .dash-moderation-layout > .dash-card + .dash-card { margin-top: .15rem !important; }', '''  .dash-moderation-layout {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: clamp(1rem, 2.8dvh, 1.35rem) !important;
  }
  .dash-moderation-settings { grid-row: auto; }
  .dash-moderation-layout > .dash-card + .dash-card { margin-top: 0 !important; }''')
needle = '''[data-moderation-access-list] {
  display: block;
  margin-top: clamp(.85rem, 2vw, 1.1rem);
}
'''
if needle not in s:
    raise RuntimeError('moderation list CSS block not found')
s = s.replace(needle, needle + '''.dash-note-warning {
  border-color: rgba(245, 158, 11, .28) !important;
  background: rgba(245, 158, 11, .08) !important;
}
''', 1)
p.write_text(s)

p = root / 'public/data/changelog.json'
data = json.loads(p.read_text())
entry = {
    'date': '2026-07-10',
    'title': 'Moderation trusted users structural fix',
    'items': [
        'Separated the moderation settings form from the trusted-user form so the browser no longer repairs invalid nested forms and splits the automation card out of the dashboard grid.',
        'Placed Moderation Tools, Trusted users and Automation under one responsive grid container with consistent spacing on desktop, tablet and mobile.',
        'Fixed trusted-user loading and add/remove initialization in the real dashboard code, including safe fallback feedback when the bot API is unavailable.',
        'Removed the obsolete floating save-card CSS and deleted references to the temporary dashboard flow helper bundle.'
    ]
}
data = [entry] + [item for item in data if item.get('title') not in {'Moderation bypass and save card hotfix', 'Moderation trusted users structural fix'}]
p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
