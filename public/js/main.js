import { initAuth } from './auth.js';
import { loadChangelog } from './changelog.js';
import { initDocumentation } from './documentation.js';
import { initNavigation } from './navigation.js';
import { initPageModal } from './pageModal.js';
import { initStats } from './stats.js';

initNavigation();
initPageModal();
initStats();
initDocumentation();
loadChangelog();
initAuth();
