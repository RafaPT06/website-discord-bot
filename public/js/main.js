import { initFooterYear, loadBotStats } from './stats.js';
import { initNavigation } from './navigation.js';
import { initDocumentation, loadCommands } from './documentation.js';
import { loadChangelog } from './changelog.js';

initFooterYear();
initNavigation();
initDocumentation();

loadBotStats();
loadCommands();
loadChangelog();

setInterval(loadBotStats, 30000);
setInterval(loadCommands, 60000);
