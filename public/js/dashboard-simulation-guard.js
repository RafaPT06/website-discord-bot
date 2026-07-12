const SIMULATION_SELECTOR = '[data-simulation-event]';
const SAVE_BAR_SELECTOR = '[data-global-save-bar]';
const SAVE_BUTTON_SELECTOR = '[data-save-drafts]';
const DEMO_PATH = /^\/demo(?:\/|$)/;

function isDemoMode() {
  return DEMO_PATH.test(window.location.pathname);
}

function simulationButtons(root = document) {
  return [...root.querySelectorAll(SIMULATION_SELECTOR)];
}

function syncSimulationLabels() {
  if (isDemoMode()) return;
  const hasUnsavedChanges = Boolean(document.querySelector(SAVE_BAR_SELECTOR));
  for (const button of simulationButtons()) {
    if (!button.dataset.baseSimulationLabel) {
      button.dataset.baseSimulationLabel = button.textContent.trim() || 'Run Simulation';
    }
    if (button.disabled || button.dataset.saveSimulationBusy === 'true') continue;
    const base = button.dataset.baseSimulationLabel;
    button.textContent = hasUnsavedChanges ? `Save & ${base}` : base;
  }
}

function showSaveFailure(button) {
  const panel = button.closest('[data-simulation-panel]');
  const result = panel?.querySelector('[data-simulation-result]');
  if (!result) return;
  result.hidden = false;
  result.className = 'dash-simulation-result is-error';
  result.textContent = 'Settings could not be saved. Fix the save error before running this simulation.';
}

function waitForSave(timeoutMs = 18000) {
  if (!document.querySelector(SAVE_BAR_SELECTOR)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      if (!document.querySelector(SAVE_BAR_SELECTOR)) finish(true);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = setTimeout(() => finish(false), timeoutMs);
  });
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest(SIMULATION_SELECTOR);
  if (!button || isDemoMode() || button.dataset.skipSaveGuard === 'true') return;

  const saveBar = document.querySelector(SAVE_BAR_SELECTOR);
  const saveButton = saveBar?.querySelector(SAVE_BUTTON_SELECTOR);
  if (!saveBar || !saveButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (!button.dataset.baseSimulationLabel) {
    button.dataset.baseSimulationLabel = button.textContent.trim() || 'Run Simulation';
  }

  button.dataset.saveSimulationBusy = 'true';
  button.disabled = true;
  button.textContent = 'Saving settings…';
  saveButton.click();

  const saved = await waitForSave();
  button.dataset.saveSimulationBusy = 'false';
  button.disabled = false;
  button.textContent = button.dataset.baseSimulationLabel;

  if (!saved) {
    showSaveFailure(button);
    syncSimulationLabels();
    return;
  }

  button.dataset.skipSaveGuard = 'true';
  button.click();
  delete button.dataset.skipSaveGuard;
}, true);

const observer = new MutationObserver(syncSimulationLabels);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('pageshow', syncSimulationLabels);
queueMicrotask(syncSimulationLabels);
