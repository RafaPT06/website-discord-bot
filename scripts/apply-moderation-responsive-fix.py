from pathlib import Path
import json

root = Path('.')

css_path = root / 'public/css/main.css'
css = css_path.read_text()

old_content = '''.dash-content {
  padding-top: 0 !important;
}'''
new_content = '''.dash-content {
  padding-top: 0 !important;
  container-type: inline-size;
  container-name: dashboard-content;
}'''
if old_content not in css:
    raise RuntimeError('dashboard content block not found')
css = css.replace(old_content, new_content, 1)

old_layout = '''.dash-moderation-layout {
  display: grid !important;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr) !important;
  align-items: start !important;
  gap: clamp(1.1rem, 2.4vw, 1.55rem) !important;
}
.dash-moderation-layout > .dash-card {
  min-width: 0;
  margin: 0 !important;
}
.dash-moderation-settings {
  grid-row: span 2;
}
.dash-moderation-access-card,
.dash-automation-card {
  align-self: start;
}'''
new_layout = '''.dash-moderation-layout {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  align-items: start !important;
  gap: clamp(1.1rem, 2.4vw, 1.55rem) !important;
}
.dash-moderation-layout > .dash-card {
  min-width: 0;
  margin: 0 !important;
}
.dash-moderation-settings {
  grid-row: auto;
}
.dash-moderation-access-card {
  container-type: inline-size;
  container-name: moderation-access;
}
.dash-moderation-access-card,
.dash-automation-card {
  align-self: start;
}
@container dashboard-content (min-width: 68rem) {
  .dash-moderation-layout {
    grid-template-columns: minmax(34rem, 1.08fr) minmax(22rem, .92fr) !important;
  }
  .dash-moderation-settings {
    grid-row: span 2;
  }
}
@container moderation-access (max-width: 28rem) {
  .dash-user-search-form {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: .7rem !important;
  }
  .dash-user-search-form .dash-save-btn {
    width: 100%;
  }
}'''
if old_layout not in css:
    raise RuntimeError('moderation layout block not found')
css = css.replace(old_layout, new_layout, 1)

if css.count('{') != css.count('}'):
    raise RuntimeError('CSS brace balance failed')
css_path.write_text(css)

changelog_path = root / 'public/data/changelog.json'
items = json.loads(changelog_path.read_text())
entry = {
    'date': '2026-07-10',
    'title': 'Moderation responsive width fix',
    'items': [
        'Changed the moderation tab to use its available dashboard content width instead of the browser viewport when deciding between one and two columns.',
        'Prevented Android Chrome desktop-site mode from squeezing Moderation Tools and Trusted users into narrow scaled-down columns.',
        'Made the trusted-user search controls stack automatically whenever their card becomes too narrow.'
    ]
}
items = [entry] + [item for item in items if item.get('title') != entry['title']]
changelog_path.write_text(json.dumps(items, indent=2, ensure_ascii=False) + '\n')
