const fs = require('fs');
const text = fs.readFileSync('plate-data.js', 'utf8');
const data = Function('return (' + text.replace(/^window\.PLATE_DATA\s*=\s*/, '').replace(/;\s*$/, '') + ');')();
const out = [];
for (const [state, entries] of Object.entries(data)) {
  for (const entry of entries) {
    const first = entry.regions && entry.regions[0] ? entry.regions[0] : '';
    if (!first) continue;
    const base = first
      .replace(/^(Stadt|Landkreis|Kreis|Gemeinde|Stadt und Landkreis|Samtgemeinde|Ortschaft|Landratsamt|Verbandsgemeinde)\s+/i, '')
      .replace(/\s*\(.*\)$/, '')
      .replace(/[-–—]/g, ' ')
      .replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    const letters = entry.code
      .replace(/[^A-ZÄÖÜ]/g, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase();
    const ok = letters.split('').every(ch => base.includes(ch));
    if (!ok || letters.length > base.length) {
      out.push({ code: entry.code, region: first, letters, base });
    }
  }
}
console.log(JSON.stringify(out.sort((a, b) => a.code.localeCompare(b.code, 'de')), null, 2));
