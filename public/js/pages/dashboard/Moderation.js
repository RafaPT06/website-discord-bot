import { escapeHtml } from '../../utils.js';
import { switchField, channelSelectField, textareaField, saveBtn } from '../../components/forms.js';
import { userAccessForm } from '../../components/accessList.js';
import { emptyState } from '../../components/feedback.js';

/** Moderation settings and trusted-user view, without API state ownership. */
export function renderModerationPage(server, s, { simulationPanel }) {
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
    <div class="dash-section-stack"><article class="dash-card dash-automation-card"><span>Rules</span><h2>Automation</h2><div class="dash-feature-grid compact">${['Warnings','Anti-spam','Link filter','Invite filter','Mod logs'].map(x => `<div class="dash-feature-card"><strong>${x}</strong><span>Connected to bot API.</span></div>`).join('')}</div></article>${simulationPanel('Simulate automod', 'Send a safe automod test embed. It does not delete a message or punish a member.', [{ event: 'moderation', label: 'Simulate Automod', primary: true }])}</div>
  </section>`;

