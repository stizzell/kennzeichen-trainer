const fs = require('fs');

const stateNames = new Set([
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
  'Sonderkennzeichen'
]);

function stripMarkdown(value) {
  return String(value || '')
    .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/{{.*?}}/g, '')
    .replace(/\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLocationPrefix(value) {
  return String(value || '')
    .replace(/^(Stadt|Landkreis|Kreis|Gemeinde|Ortschaft|Samtgemeinde|Stadt und Landkreis|Stadtverband|Verbandsgemeinde)\s+/i, '')
    .replace(/\s*\(.*\)$/, '')
    .trim();
}

function normalizeEntryName(value) {
  return stripLocationPrefix(stripMarkdown(value)).replace(/\s+/g, ' ').trim();
}

function isStateName(value) {
  return stateNames.has(value) || value === 'Deutschland' || value === 'Bundesweit';
}

const raw = fs.readFileSync('wiki.json', 'utf8');
const parsed = JSON.parse(raw);
const wikitext = parsed.parse.wikitext['*'];
const lines = wikitext.split(/\r?\n/);
const grouped = {};

let currentCode = null;
let currentState = null;
let currentRows = [];
let currentRegions = [];
let currentDerivation = null;

function flushCurrent() {
  if (!currentCode) {
    return;
  }

  const regions = [...new Set(currentRegions.filter(Boolean))];
  const derivation = currentDerivation || regions[0] || currentState || 'Unbekannt';
  const answers = [...new Set(
    [
      ...regions.map((region) => normalizeEntryName(region)),
      normalizeEntryName(derivation)
    ].filter(Boolean))
  ];

  const safeState = currentState || 'Sonderkennzeichen';
  if (!grouped[safeState]) {
    grouped[safeState] = [];
  }

  grouped[safeState].push({
    code: currentCode,
    regions: regions.length ? regions : [safeState],
    answers: answers.length ? answers : [safeState],
    derivation: normalizeEntryName(derivation) || safeState
  });

  currentCode = null;
  currentState = null;
  currentRows = [];
  currentRegions = [];
  currentDerivation = null;
}

for (const line of lines) {
  const codeMatch = line.match(/^\|\s*'''([^']+)'''\s*$/);

  if (codeMatch) {
    flushCurrent();
    currentCode = codeMatch[1].trim();
    currentRows = [];
    continue;
  }

  if (!currentCode) {
    continue;
  }

  if (/^\|\-/.test(line) || /^\|\}/.test(line)) {
    flushCurrent();
    continue;
  }

  if (!line.startsWith('|')) {
    continue;
  }

  const cell = line.replace(/^\|\s*/, '').trim();
  if (!cell) {
    continue;
  }

  currentRows.push(cell);

  const cleanCell = stripMarkdown(cell);
  if (!cleanCell) {
    continue;
  }

  if (isStateName(cleanCell)) {
    currentState = cleanCell;
    continue;
  }

  if (cell.includes("'''")) {
    currentDerivation = currentDerivation || normalizeEntryName(cleanCell);
  }

  if (!cell.includes("'''") && cleanCell.startsWith('Liste aller')) {
    continue;
  }

  const isExcludedState = /^(Landesregierung|Landtag|Polizei|Bundes|Deutschland|Bundesweit|Bayern|Baden-Wuerttemberg|Baden-Württemberg|Brandenburg|Mecklenburg-Vorpommern|Schleswig-Holstein|Sachsen-Anhalt|Nordrhein-Westfalen|Rheinland-Pfalz|Saarland|Thüringen|Niedersachsen|Berlin|Hamburg|Bremen|Sachsen|Hessen)$/i;
  if (cleanCell && !isExcludedState.test(cleanCell)) {
    currentRegions.push(cleanCell);
  }
}

flushCurrent();

const ordered = {};
for (const stateName of Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'de'))) {
  ordered[stateName] = grouped[stateName];
}

const outPath = 'plate-data.js';
fs.writeFileSync(outPath, 'window.PLATE_DATA = ' + JSON.stringify(ordered, null, 2) + ';\n', 'utf8');
console.log('states:', Object.keys(ordered).length);
console.log('samples:', JSON.stringify({
  Bayern: ordered.Bayern.slice(0, 3),
  'Baden-Württemberg': ordered['Baden-Württemberg'].slice(0, 3),
  Berlin: ordered.Berlin?.slice(0, 3),
  Sonderkennzeichen: ordered['Sonderkennzeichen']?.slice(0, 3)
}, null, 2));
