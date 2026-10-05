const fs = require('fs');
const https = require('https');

function fetchWikiWikitext() {
  return new Promise((resolve, reject) => {
    const url = 'https://de.wikipedia.org/w/api.php?action=parse&page=Liste_der_Kfz-Kennzeichen_in_Deutschland&prop=wikitext&format=json&formatversion=2';
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed.parse.wikitext['*']);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
  });
}

function stripFormatting(value) {
  return String(value || '')
    .replace(/\[\[|\]\]|\*\*\*|'''/g, '')
    .replace(/\|.*$/, '')
    .trim();
}

function extractDerivation(lines, startIndex) {
  for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 20); i += 1) {
    const line = lines[i];
    if (/^\|\s*\-/.test(line)) break;
    const pipeLink = line.match(/\[\[([^\]|]+)\|/);
    if (pipeLink) {
      return stripFormatting(pipeLink[1]);
    }

    const directLink = line.match(/\[\[([^\]|]+)\]\]/);
    if (directLink) {
      return stripFormatting(directLink[1]);
    }

    const directText = line.match(/^\|\s*([^|]+)$/);
    if (directText) {
      const text = directText[1].trim();
      if (text && !/^\[\[/.test(text) && !/^\*\*/.test(text)) {
        return stripFormatting(text);
      }
    }
  }

  return null;
}

async function main() {
  const wikitext = await fetchWikiWikitext();
  const lines = wikitext.split(/\r?\n/);
  const derivations = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\|\s*'''([^']+)'''\s*$/);
    if (!match) continue;

    const code = match[1].trim();
    const derivation = extractDerivation(lines, i);
    if (derivation) {
      derivations.set(code, derivation);
    }
  }

  const filePath = 'plate-data.js';
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = Function('return (' + raw.replace(/^window\.PLATE_DATA\s*=\s*/, '').replace(/;\s*$/, '') + ');')();

  let changed = 0;
  for (const [state, entries] of Object.entries(data)) {
    for (const entry of entries) {
      const derivation = derivations.get(entry.code) || entry.regions?.[0] || state;
      entry.derivation = derivation;
      changed += 1;
    }
  }

  fs.writeFileSync(filePath, 'window.PLATE_DATA = ' + JSON.stringify(data, null, 4) + ';\n', 'utf8');
  console.log('Entries updated:', changed);
  console.log('Examples:', {
    BL: derivations.get('BL'),
    MOS: derivations.get('MOS'),
    AIC: derivations.get('AIC'),
    ZW: derivations.get('ZW'),
    WÜ: derivations.get('WÜ'),
    FÜS: derivations.get('FÜS')
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
