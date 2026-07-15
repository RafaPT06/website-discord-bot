const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CSS_DIR = path.join(PUBLIC_DIR, 'css');
const DARK_ONLY = true;

const hardErrors = [];
const warnings = [];
const stats = {
  cssFiles: 0,
  cssLines: 0,
  cssBytes: 0,
  importantCount: 0,
  lightSelectorCount: 0,
  duplicateSelectorCount: 0,
  referencedStylesheets: 0,
};

function walk(dir, predicate = () => true) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full, predicate));
    else if (predicate(full)) results.push(full);
  }
  return results;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function maskCommentsAndStrings(source) {
  let out = '';
  let i = 0;
  let quote = null;
  let escaped = false;
  let comment = false;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (comment) {
      if (char === '*' && next === '/') {
        out += '  ';
        i += 2;
        comment = false;
      } else {
        out += char === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        out += ' ';
        escaped = false;
      } else if (char === '\\') {
        out += ' ';
        escaped = true;
      } else if (char === quote) {
        out += ' ';
        quote = null;
      } else {
        out += char === '\n' ? '\n' : ' ';
      }
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      out += '  ';
      i += 2;
      comment = true;
      continue;
    }

    if (char === '"' || char === "'") {
      out += ' ';
      quote = char;
      i += 1;
      continue;
    }

    out += char;
    i += 1;
  }

  return { masked: out, unterminatedComment: comment, unterminatedString: Boolean(quote) };
}

function auditStructure(file, source) {
  const name = relative(file);
  const { masked, unterminatedComment, unterminatedString } = maskCommentsAndStrings(source);

  if (unterminatedComment) hardErrors.push(`${name}: unterminated /* comment.`);
  if (unterminatedString) hardErrors.push(`${name}: unterminated quoted string.`);

  const stack = [];
  for (let i = 0; i < masked.length; i += 1) {
    if (masked[i] === '{') stack.push(i);
    if (masked[i] === '}') {
      if (!stack.length) {
        hardErrors.push(`${name}:${lineAt(masked, i)} has a closing brace without a matching opening brace.`);
      } else {
        stack.pop();
      }
    }
  }
  for (const index of stack) {
    hardErrors.push(`${name}:${lineAt(masked, index)} has an opening brace without a matching closing brace.`);
  }

  for (const marker of ['<<<<<<<', '=======', '>>>>>>>']) {
    const index = source.indexOf(marker);
    if (index !== -1) hardErrors.push(`${name}:${lineAt(source, index)} contains an unresolved merge marker (${marker}).`);
  }

  const slashComment = masked.match(/(^|\n)\s*\/\//);
  if (slashComment) warnings.push(`${name}:${lineAt(masked, slashComment.index)} contains // syntax, which is not a valid CSS comment.`);
}

function auditRules(file, source, selectorRegistry) {
  const name = relative(file);
  const { masked } = maskCommentsAndStrings(source);
  const rulePattern = /([^{}]+)\{/g;
  let match;
  const localSelectors = new Map();

  while ((match = rulePattern.exec(masked))) {
    const header = match[1].trim();
    if (!header || header.startsWith('@')) continue;

    const selector = header.replace(/\s+/g, ' ');
    const line = lineAt(masked, match.index);
    if (localSelectors.has(selector)) {
      stats.duplicateSelectorCount += 1;
      warnings.push(`${name}:${line} repeats selector "${selector}" already declared at line ${localSelectors.get(selector)}.`);
    } else {
      localSelectors.set(selector, line);
    }

    if (!selectorRegistry.has(selector)) selectorRegistry.set(selector, []);
    selectorRegistry.get(selector).push({ file: name, line });
  }

  const importantMatches = source.match(/!important\b/g) || [];
  stats.importantCount += importantMatches.length;
  if (importantMatches.length >= 40) {
    warnings.push(`${name} contains ${importantMatches.length} !important declarations; this suggests heavy cascade overrides.`);
  }

  if (DARK_ONLY) {
    const lightMatches = [...source.matchAll(/:root\[data-theme=["']light["']\]/g)];
    stats.lightSelectorCount += lightMatches.length;
    for (const item of lightMatches.slice(0, 5)) {
      warnings.push(`${name}:${lineAt(source, item.index)} contains dead light-theme CSS although Meowz is dark-only.`);
    }
    if (lightMatches.length > 5) warnings.push(`${name} contains ${lightMatches.length - 5} additional dead light-theme selectors.`);
  }

  const redundantClamp = /clamp\(\s*([^,]+),\s*([^,]+),\s*\1\s*\)/g;
  while ((match = redundantClamp.exec(source))) {
    warnings.push(`${name}:${lineAt(source, match.index)} uses clamp() with identical minimum and maximum values; use the fixed value instead.`);
  }

  const invalidViewport = /\b(?:width|min-width|max-width)\s*:\s*(?:[2-9]\d{3,}|1\d{4,})px\b/g;
  while ((match = invalidViewport.exec(source))) {
    warnings.push(`${name}:${lineAt(source, match.index)} contains a very large fixed width (${match[0].split(':')[1].trim()}). Verify responsiveness.`);
  }
}

function collectStylesheetReferences() {
  const sourceFiles = walk(PUBLIC_DIR, (file) => /\.(?:html|js)$/i.test(file));
  const references = new Map();
  const pattern = /(?:href\s*=\s*["']|\.href\s*=\s*["']|href:\s*["'])(\/css\/[^"']+\.css)/g;

  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = pattern.exec(source))) {
      const href = match[1].split('?')[0];
      if (!references.has(href)) references.set(href, []);
      references.get(href).push({ file: relative(file), line: lineAt(source, match.index) });
    }
  }

  stats.referencedStylesheets = references.size;
  return references;
}

function auditReferences(cssFiles) {
  const references = collectStylesheetReferences();
  const cssRelative = new Set(cssFiles.map((file) => `/${relative(file).replace(/^public\//, '')}`));

  for (const [href, uses] of references) {
    const diskPath = path.join(PUBLIC_DIR, href.replace(/^\//, ''));
    if (!fs.existsSync(diskPath)) {
      hardErrors.push(`${uses[0].file}:${uses[0].line} references missing stylesheet ${href}.`);
    }
    if (uses.length > 1 && uses.some((item, index) => uses.findIndex((other) => other.file === item.file) !== index)) {
      warnings.push(`${href} is referenced more than once from the same source file.`);
    }
  }

  for (const cssPath of cssRelative) {
    if (cssPath === '/css/site-update.css') continue;
    if (!references.has(cssPath) && !cssPath.endsWith('/main.css')) {
      warnings.push(`${cssPath} is not referenced by HTML or JavaScript and may be obsolete.`);
    }
  }
}

function printSection(title, items, stream = console.log) {
  stream(`\n${title} (${items.length})`);
  if (!items.length) {
    stream('  None');
    return;
  }
  for (const item of items) stream(`  - ${item}`);
}

function run() {
  const cssFiles = walk(CSS_DIR, (file) => file.endsWith('.css')).sort();
  const selectorRegistry = new Map();
  stats.cssFiles = cssFiles.length;

  for (const file of cssFiles) {
    const source = fs.readFileSync(file, 'utf8');
    stats.cssLines += source.split('\n').length;
    stats.cssBytes += Buffer.byteLength(source);
    auditStructure(file, source);
    auditRules(file, source, selectorRegistry);
  }

  for (const [selector, uses] of selectorRegistry) {
    const files = [...new Set(uses.map((use) => use.file))];
    if (files.length >= 4) {
      warnings.push(`Selector "${selector}" is declared across ${files.length} CSS files (${files.join(', ')}), increasing cascade risk.`);
    }
  }

  auditReferences(cssFiles);

  console.log('Meowz CSS audit');
  console.log('================');
  console.log(`CSS files: ${stats.cssFiles}`);
  console.log(`CSS lines: ${stats.cssLines}`);
  console.log(`CSS size: ${(stats.cssBytes / 1024).toFixed(1)} KiB`);
  console.log(`Stylesheet references: ${stats.referencedStylesheets}`);
  console.log(`!important declarations: ${stats.importantCount}`);
  console.log(`Dead light-theme selectors: ${stats.lightSelectorCount}`);
  console.log(`Repeated selectors inside a file: ${stats.duplicateSelectorCount}`);

  printSection('Hard errors', hardErrors, console.error);
  printSection('Warnings', warnings);

  if (hardErrors.length) {
    process.exitCode = 1;
  }
}

run();
