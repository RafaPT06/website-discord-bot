const VERSION_ENDPOINT = '/api/site-version';
const CHECK_INTERVAL_MS = 45_000;
const REQUEST_TIMEOUT_MS = 8_000;
const SAVE_TIMEOUT_MS = 45_000;
const STATUS_EVENT = 'meowz:status-toast';

const COPY = {
  en: {
    updatedTitle: 'Website updated',
    updatedBody: 'A newer version of Meowz is ready. Refresh to use the latest changes.',
    refresh: 'Refresh now',
    refreshingBody: 'Loading the newest Meowz website version…',
    savingTitle: 'Website updated',
    savingBody: 'Saving your pending dashboard changes before refreshing…',
    savedTitle: 'Changes saved',
    savedBody: 'Your changes are safe. Refreshing Meowz now…',
    failedTitle: 'Could not save changes',
    failedBody: 'The refresh was stopped so your unsaved changes stay on this page. Check the connection and try again.',
    retry: 'Save and refresh',
    demoBody: 'A newer version of Meowz is ready. Demo mode is read-only, so you can refresh safely.',
  },
  pt: {
    updatedTitle: 'Website atualizado',
    updatedBody: 'Está disponível uma versão mais recente do Meowz. Atualiza a página para usares as alterações mais recentes.',
    refresh: 'Atualizar agora',
    refreshingBody: 'A carregar a versão mais recente do website do Meowz…',
    savingTitle: 'Website atualizado',
    savingBody: 'A guardar as alterações pendentes do painel antes de atualizar…',
    savedTitle: 'Alterações guardadas',
    savedBody: 'As tuas alterações estão seguras. A atualizar o Meowz…',
    failedTitle: 'Não foi possível guardar',
    failedBody: 'A atualização foi interrompida para manteres as alterações nesta página. Verifica a ligação e tenta novamente.',
    retry: 'Guardar e atualizar',
    demoBody: 'Está disponível uma versão mais recente do Meowz. O modo de demonstração é apenas de leitura, por isso podes atualizar em segurança.',
  },
  es: {
    updatedTitle: 'Sitio web actualizado',
    updatedBody: 'Hay una versión más reciente de Meowz. Actualiza la página para usar los últimos cambios.',
    refresh: 'Actualizar ahora',
    refreshingBody: 'Cargando la versión más reciente del sitio de Meowz…',
    savingTitle: 'Sitio web actualizado',
    savingBody: 'Guardando los cambios pendientes del panel antes de actualizar…',
    savedTitle: 'Cambios guardados',
    savedBody: 'Tus cambios están seguros. Actualizando Meowz…',
    failedTitle: 'No se pudieron guardar los cambios',
    failedBody: 'La actualización se detuvo para mantener tus cambios en esta página. Comprueba la conexión e inténtalo de nuevo.',
    retry: 'Guardar y actualizar',
    demoBody: 'Hay una versión más reciente de Meowz. El modo de demostración es de solo lectura, así que puedes actualizar con seguridad.',
  },
  de: {
    updatedTitle: 'Website aktualisiert',
    updatedBody: 'Eine neuere Meowz-Version ist verfügbar. Aktualisiere die Seite, um die neuesten Änderungen zu verwenden.',
    refresh: 'Jetzt aktualisieren',
    refreshingBody: 'Die neueste Meowz-Website-Version wird geladen…',
    savingTitle: 'Website aktualisiert',
    savingBody: 'Ausstehende Dashboard-Änderungen werden vor dem Aktualisieren gespeichert…',
    savedTitle: 'Änderungen gespeichert',
    savedBody: 'Deine Änderungen sind sicher. Meowz wird jetzt aktualisiert…',
    failedTitle: 'Änderungen konnten nicht gespeichert werden',
    failedBody: 'Die Aktualisierung wurde angehalten, damit deine Änderungen auf dieser Seite erhalten bleiben. Prüfe die Verbindung und versuche es erneut.',
    retry: 'Speichern und aktualisieren',
    demoBody: 'Eine neuere Meowz-Version ist verfügbar. Der Demo-Modus ist schreibgeschützt, daher kannst du sicher aktualisieren.',
  },
  fr: {
    updatedTitle: 'Site mis à jour',
    updatedBody: 'Une version plus récente de Meowz est disponible. Actualisez la page pour utiliser les dernières modifications.',
    refresh: 'Actualiser maintenant',
    refreshingBody: 'Chargement de la version la plus récente du site Meowz…',
    savingTitle: 'Site mis à jour',
    savingBody: 'Enregistrement des modifications du tableau de bord avant l’actualisation…',
    savedTitle: 'Modifications enregistrées',
    savedBody: 'Vos modifications sont en sécurité. Actualisation de Meowz…',
    failedTitle: 'Impossible d’enregistrer les modifications',
    failedBody: 'L’actualisation a été arrêtée afin de conserver vos modifications sur cette page. Vérifiez la connexion et réessayez.',
    retry: 'Enregistrer et actualiser',
    demoBody: 'Une version plus récente de Meowz est disponible. Le mode démo est en lecture seule, vous pouvez donc actualiser sans risque.',
  },
};

let baselineVersion = null;
let availableVersion = null;
let checkInFlight = false;
let refreshInFlight = false;
let pollTimer = null;
let noticeHost = null;
let noticeState = 'updated';
let updateChannel = null;

function currentCopy() {
  const language = String(document.documentElement.lang || 'en').toLowerCase().split('-')[0];
  return COPY[language] || COPY.en;
}

function ensureStylesheet() {
  if (document.querySelector('link[data-site-update-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/site-update.css';
  link.dataset.siteUpdateStyles = '';
  document.head.appendChild(link);
}

function ensureNoticeHost() {
  ensureStylesheet();
  if (noticeHost?.isConnected) return noticeHost;
  noticeHost = document.querySelector('[data-site-update-host]');
  if (!noticeHost) {
    noticeHost = document.createElement('div');
    noticeHost.className = 'site-update-host';
    noticeHost.dataset.siteUpdateHost = '';
    noticeHost.setAttribute('aria-live', 'assertive');
    noticeHost.setAttribute('aria-atomic', 'true');
    document.body.appendChild(noticeHost);
  }
  return noticeHost;
}

function isDemoMode() {
  return document.body.classList.contains('demo-mode') || window.location.pathname.startsWith('/demo');
}

function pendingSaveBar() {
  return [...document.querySelectorAll('[data-global-save-bar]')]
    .find((bar) => bar.isConnected) || null;
}

function hasPendingDashboardChanges() {
  return Boolean(pendingSaveBar());
}

function renderNotice(state = noticeState) {
  noticeState = state;
  const host = ensureNoticeHost();
  const copy = currentCopy();
  const busy = state === 'saving' || state === 'saved' || state === 'refreshing';
  const failed = state === 'failed';
  const title = state === 'saving'
    ? copy.savingTitle
    : state === 'saved'
      ? copy.savedTitle
      : failed
        ? copy.failedTitle
        : copy.updatedTitle;
  const body = state === 'saving'
    ? copy.savingBody
    : state === 'saved'
      ? copy.savedBody
      : state === 'refreshing'
        ? copy.refreshingBody
        : failed
          ? copy.failedBody
          : isDemoMode()
            ? copy.demoBody
            : copy.updatedBody;
  const buttonLabel = failed ? copy.retry : copy.refresh;
  const icon = failed ? '!' : '↻';

  host.innerHTML = `
    <section class="site-update-card" data-site-update-card data-state="${state}" data-busy="${busy}" role="status">
      <div class="site-update-icon" aria-hidden="true">${icon}</div>
      <div class="site-update-copy">
        <strong>${title}</strong>
        <span>${body}</span>
      </div>
      <div class="site-update-actions">
        <button class="site-update-button site-update-button-primary" type="button" data-site-update-refresh ${busy ? 'disabled' : ''}>${buttonLabel}</button>
      </div>
    </section>`;

  host.querySelector('[data-site-update-refresh]')?.addEventListener('click', () => {
    void saveAndRefresh();
  });
}

function clearPollTimer() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function finishReload() {
  setTimeout(() => window.location.reload(), 650);
}

function lockDashboardEdits() {
  const tabContent = document.querySelector('[data-server-tab-content]');
  if (!tabContent) return () => {};

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && tabContent.contains(activeElement)) activeElement.blur();
  tabContent.setAttribute('inert', '');
  tabContent.dataset.siteUpdateLocked = '';

  return () => {
    tabContent.removeAttribute('inert');
    delete tabContent.dataset.siteUpdateLocked;
  };
}

function waitForDashboardSave() {
  const bar = pendingSaveBar();
  if (!bar) return Promise.resolve({ ok: true });
  if (isDemoMode()) return Promise.resolve({ ok: true, readOnly: true });

  const button = bar.querySelector('[data-save-drafts]');
  if (!button) return Promise.resolve({ ok: false, reason: 'save-control-missing' });

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener(STATUS_EVENT, handleStatus);
      resolve(result);
    };

    const handleStatus = (event) => {
      const title = String(event.detail?.title || '');
      if (title === 'Server settings saved') finish({ ok: true });
      if (title === 'Some settings failed to save') finish({ ok: false, reason: 'save-failed' });
    };

    const timeout = setTimeout(() => {
      finish({ ok: !pendingSaveBar(), reason: pendingSaveBar() ? 'save-timeout' : null });
    }, SAVE_TIMEOUT_MS);

    window.addEventListener(STATUS_EVENT, handleStatus);
    if (!button.disabled) button.click();
  });
}

async function saveAndRefresh() {
  if (refreshInFlight || !availableVersion) return;
  refreshInFlight = true;

  if (!hasPendingDashboardChanges() || isDemoMode()) {
    renderNotice('refreshing');
    finishReload();
    return;
  }

  const unlock = lockDashboardEdits();
  renderNotice('saving');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const result = await waitForDashboardSave();
  if (!result.ok) {
    unlock();
    refreshInFlight = false;
    renderNotice('failed');
    return;
  }

  renderNotice('saved');
  finishReload();
}

async function fetchSiteVersion() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${VERSION_ENDPOINT}?ts=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Version check failed with ${response.status}.`);
    const data = await response.json();
    const version = String(data?.version || '').trim();
    if (!version) throw new Error('Version response was empty.');
    return version;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleAvailableVersion(version, { broadcast = true } = {}) {
  if (!version || version === baselineVersion || availableVersion) return;
  availableVersion = version;
  clearPollTimer();
  if (broadcast) updateChannel?.postMessage?.({ type: 'site-update', version });
  renderNotice('updated');

  if (hasPendingDashboardChanges() && !isDemoMode()) {
    await saveAndRefresh();
  }
}

async function checkForUpdate() {
  if (checkInFlight || availableVersion || document.visibilityState === 'hidden') return;
  checkInFlight = true;
  try {
    const version = await fetchSiteVersion();
    if (!baselineVersion) {
      baselineVersion = version;
      return;
    }
    if (version !== baselineVersion) await handleAvailableVersion(version);
  } catch {
    // Deployments and temporary connection loss are expected. The next check retries.
  } finally {
    checkInFlight = false;
  }
}

function startCrossTabUpdates() {
  if (typeof BroadcastChannel === 'undefined') return;
  updateChannel = new BroadcastChannel('meowz-site-update');
  updateChannel.addEventListener('message', (event) => {
    if (event.data?.type !== 'site-update') return;
    void handleAvailableVersion(String(event.data.version || ''), { broadcast: false });
  });
}

export function initSiteUpdateMonitor() {
  if (window.__meowzSiteUpdateMonitorStarted) return;
  window.__meowzSiteUpdateMonitorStarted = true;
  ensureStylesheet();
  startCrossTabUpdates();

  void checkForUpdate();
  pollTimer = setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);

  window.addEventListener('focus', () => void checkForUpdate(), { passive: true });
  window.addEventListener('online', () => void checkForUpdate(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  window.addEventListener('meowz:language-change', () => {
    if (availableVersion) renderNotice(noticeState);
  });
}
