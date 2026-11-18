import { escapeHtml } from '../../utils.js';
import { switchField, channelSelectField, variableButtons, textareaField, saveBtn } from '../../components/forms.js';

/** Presentational Welcome/Goodbye page. State loading and event handlers stay in the controller. */
export function renderWelcomePage(server, s, { welcomePreview, simulationPanel }) {
  return `<form class="dash-designer dash-designer-wide dash-welcome-layout" data-settings-form="welcome" data-guild-id="${escapeHtml(server.id)}">
    <div class="dash-welcome-settings-stack">
      <article class="dash-card dash-form-card">
        <div class="dash-card-head"><div><span>Welcome Messages</span><h2>Welcome Messages</h2><p>Configure the Discord message Meowz sends when someone joins ${escapeHtml(server.name)}.</p></div><b class="status ${s.welcomeEnabled?'enabled':''}">${s.welcomeEnabled?'Enabled':'Disabled'}</b></div>
        ${switchField('welcomeEnabled',s.welcomeEnabled,'Enable welcome messages','Send a message when someone joins the server.')}
        <hr/>
        ${channelSelectField(server,'welcomeChannelId','Welcome Channel',s.welcomeChannelId,'welcome')}
        <label class="dash-field"><span>Welcome Style</span><select name="welcomeStyle"><option ${s.welcomeStyle === 'Custom Card (Modern)' ? 'selected' : ''}>Custom Card (Modern)</option><option ${s.welcomeStyle === 'Text only' ? 'selected' : ''}>Text only</option></select></label>
        ${variableButtons('welcomeMessage')}
        ${textareaField('welcomeMessage','Welcome Message',s.welcomeMessage,200)}
        <div class="dash-option-list">${switchField('showMember',s.showMember,'Show member number on the card','Display the member position in the server.')}${switchField('showAvatar',s.showAvatar,'Show avatar on the card','Display the member avatar on the profile card.')}</div>
      </article>

      <article class="dash-card dash-form-card">
        <div class="dash-card-head"><div><span>Goodbye Messages</span><h2>Goodbye Messages</h2><p>Configure the separate leave message and destination channel.</p></div><b class="status ${s.goodbyeEnabled?'enabled':''}">${s.goodbyeEnabled?'Enabled':'Disabled'}</b></div>
        ${switchField('goodbyeEnabled',s.goodbyeEnabled,'Enable goodbye messages','Send a message when someone leaves the server.')}
        <hr/>
        ${channelSelectField(server,'goodbyeChannelId','Goodbye Channel',s.goodbyeChannelId,'bye')}
        <label class="dash-field"><span>Goodbye Style</span><select name="goodbyeStyle"><option ${s.goodbyeStyle === 'Text only' ? 'selected' : ''}>Text only</option><option ${s.goodbyeStyle === 'Custom Card (Modern)' ? 'selected' : ''}>Custom Card (Modern)</option></select></label>
        ${variableButtons('goodbyeMessage')}
        ${textareaField('goodbyeMessage','Goodbye Message',s.goodbyeMessage,200)}
        <small class="preview-note">The message text stays in Discord. Custom cards are compact profile cards with avatar, username and optional member number.</small>
        ${saveBtn()}
      </article>
    </div>
    <aside class="dash-welcome-preview-column dash-sticky-column">
      ${welcomePreview(server,s)}
      ${simulationPanel('Send test events', 'Send safe welcome and goodbye simulations to the saved Discord channels.', [{ event: 'welcome', label: 'Simulate Join', primary: true }, { event: 'goodbye', label: 'Simulate Leave' }])}
    </aside>
  </form>`;
}
