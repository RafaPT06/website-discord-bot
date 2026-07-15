import { initTheme } from './components/theme.js';
import { initDarkThemeOnly } from './components/darkThemeOnly.js';
import { initI18n } from './components/i18n.js';
import { initCustomSelects } from './components/customSelect.js';
import { initSiteUpdateMonitor } from './components/siteUpdate.js';
import { mountNavbar } from './components/navbar.js';
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
    jobs.push(Promise.all([
      import('./dashboard.js'),
      import('./components/dashboardReliability.js'),
      import('./components/levelingRoleManager.js'),
    ]).then(([dashboard, reliability, levelingRoles]) => {
      dashboard.initDashboard();
      reliability.initDashboardReliability();
      levelingRoles.initLevelingRoleManager();
    }));
  }

  await Promise.allSettled(jobs);
}

async function boot() {
  initTheme();
  initDarkThemeOnly();
  initI18n();
  initCustomSelects();
  mountNavbar();
  initNavigation();
  setFooterYear();
  initStatusToasts();
  await initAuth();
  await bootPageModules();
  initSiteUpdateMonitor();
}

boot();
