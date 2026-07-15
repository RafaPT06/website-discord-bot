# Meowz CSS architecture

`main.css` is the only root stylesheet. It contains the shared foundation and legacy consolidated rules.

## Folders

- `components/` — reusable controls, dialogs, previews, status UI and owner controls.
- `dashboard/` — authenticated/demo dashboard layout and dashboard-only overrides.
- `pages/` — page-specific styles such as Changelog and Settings.
- `responsive/desktop.css` — desktop application-shell rules (`min-width: 981px`).
- `responsive/tablet.css` — tablet-only additions (`721px–980px`).
- `responsive/mobile.css` — phone-only additions (`max-width: 720px`).
- `responsive/shared.css` — responsive rules shared by multiple pages or breakpoints.

## Rules for new CSS

1. Keep shared tokens and global elements in `main.css`.
2. Put reusable UI in `components/`.
3. Put page-specific UI in `pages/` or `dashboard/`.
4. Put viewport-only overrides in the matching `responsive/` file.
5. Do not create another root-level CSS file.
6. Run `npm run audit:css` before committing.

The current files were moved without rewriting selectors so the refactor does not change desktop, tablet, mobile, authenticated or demo behavior.
