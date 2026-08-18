const OWNER_VIEW_STORAGE_KEY = 'meowzDashboardViewMode';

async function syncPuzzleNav() {
  const nav = document.querySelector('[data-nav-links]');
  if (!nav) return;
  let link = nav.querySelector('[data-owner-puzzle-link]');
  const wantsOwner = localStorage.getItem(OWNER_VIEW_STORAGE_KEY) === 'owner';

  if (!wantsOwner) {
    link?.remove();
    return;
  }

  try {
    const response = await fetch('/api/dashboard/guilds?mode=owner', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.isOwner || !data?.ownerMode) {
      link?.remove();
      return;
    }

    if (!link) {
      link = document.createElement('a');
      link.href = '/tools/puzzle';
      link.textContent = 'Puzzles';
      link.setAttribute('data-owner-puzzle-link', '');
      link.setAttribute('data-nav-link', '');
      const settings = nav.querySelector('a[href="/dashboard/settings"]');
      nav.insertBefore(link, settings || nav.querySelector('[data-auth-area]'));
    }
  } catch {
    link?.remove();
  }
}

syncPuzzleNav();
window.addEventListener('storage', (event) => {
  if (event.key === OWNER_VIEW_STORAGE_KEY) syncPuzzleNav();
});
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-owner-mode]')) setTimeout(syncPuzzleNav, 120);
});
