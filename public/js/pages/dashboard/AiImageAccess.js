import { escapeHtml } from '../../utils.js';
import { userAccessForm } from '../../components/accessList.js';
import { emptyState } from '../../components/feedback.js';

export function renderAiPage(server, { simulationPanel }) {
  return `<section class="dash-designer" data-ai-page><article class="dash-card dash-form-card"><span>AI Image Access</span><h2>Allowed users</h2><p>Control who can use the image editing command in ${escapeHtml(server.name)}.</p>${userAccessForm('ai', 'Search user or paste ID')}<small class="preview-note">Bot owner and users with Manage Server permission have access by default. Manual users can be added by username search or Discord ID.</small></article><div class="dash-section-stack"><article class="dash-card"><span>Current Access</span><h2>People allowed</h2><div data-ai-access-list>${emptyState('Loading access list...', 'Please wait.')}</div></article>${simulationPanel('Test your access', 'Ask the bot whether your current Discord account can use AI image editing in this server.', [{ event: 'image-access', label: 'Test AI Access', primary: true }])}</div></section>`;
}
