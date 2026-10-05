const fs = require('fs');

function readWikiData() {
  const text = fs.readFileSync('wiki.json', 'utf8');
  return JSON.parse(text).parse.wikitext['*'];
}

function normalizeName(value) {
  return String(value || '')
    .replace(/\[\[|\]\]|'''/g, '')
    .replace(/\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDerivationForCode(code, lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!new RegExp(`^\\|\\s*'''${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'''\\s*$`).test(line)) {
      continue;
    }

    let seenArea = false;
    for (let j = i + 1; j < Math.min(lines.length, i + 20); j += 1) {
      const candidate = lines[j];
      if (!candidate.startsWith('|')) continue;
      if (/^\|\s*-\s*$/.test(candidate)) break;

      const withAlias = candidate.match(/\[\[([^\]|]+)\|/);
      if (withAlias) {
        const name = normalizeName(withAlias[1]);
        if (name && name !== code) {
          return name;
        }
      }

      if (candidate.includes('[[')) {
        seenArea = true;
      }
    }

    return null;
  }

  return null;
}

function main() {
  const sourceText = readWikiData();
  const lines = sourceText.split(/\r?\n/);
  const known = new Map();

  const codeMatches = [...sourceText.matchAll(/\|\s*'''([^']+)'''\s*/g)];
  for (const match of codeMatches) {
    const code = match[1].trim();
    const derivation = extractDerivationForCode(code, lines);
    if (derivation) {
      known.set(code, derivation);
    }
  }

  const fileText = fs.readFileSync('plate-data.js', 'utf8');
  const data = Function('return (' + fileText.replace(/^window\.PLATE_DATA\s*=\s*/, '').replace(/;\s*$/, '') + ');')();

  let touched = 0;
  for (const entries of Object.values(data)) {
    for (const entry of entries) {
      const code = String(entry.code || '').trim();
      const derivation = known.get(code) || entry.regions?.[0] || 'Unbekannt';
      entry.derivation = derivation;
      touched += 1;
    }
  }

  fs.writeFileSync('plate-data.js', 'window.PLATE_DATA = ' + JSON.stringify(data, null, 4) + ';\n', 'utf8');
  console.log('updated entries:', touched);
  console.log('examples:', {
    BL: known.get('BL'),
    MOS: known.get('MOS'),
    AIC: known.get('AIC'),
    ZW: known.get('ZW'),
    'WÜ': known.get('WÜ'),
    'FÜS': known.get('FÜS')
  });
}

main();
