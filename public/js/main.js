import { initAuth } from './auth.js';
import { initNavigation } from './navigation.js';
import { initStatusToasts } from './toast.js';

function setFooterYear() {
  document.querySelectorAll('[data-footer-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

async function bootPageModules() {
  const jobs = [];

  if (document.querySelector('[data-stat]') || document.querySelector('[data-status-pill]')) {
    jobs.push(import('./stats.js').then(({ initStats }) => initStats()));
  }

  if (document.querySelector('[data-commands-body]')) {
    jobs.push(Promise.all([
      import('./pageModal.js'),
      import('./documentation.js'),
    ]).then(([modal, docs]) => {
      modal.initPageModal();
      docs.initDocumentation();
    }));
  }

  if (document.querySelector('[data-changelog-list]') || document.querySelector('[data-changelog]')) {
    jobs.push(import('./changelog.js').then(({ loadChangelog }) => loadChangelog()));
  }

  if (document.querySelector('[data-dashboard]') || document.querySelector('[data-dashboard-guest]')) {
    jobs.push(import('./dashboard.js').then(({ initDashboard }) => initDashboard()));
  }

  await Promise.allSettled(jobs);
}

initNavigation();
setFooterYear();
initStatusToasts();

// Dashboard rendering depends on the signed-in user. Wait for auth first so the
// dashboard does not render with fallback names or stay on stale loading text.
Promise.resolve(initAuth())
  .catch(() => {})
  .finally(() => bootPageModules());
