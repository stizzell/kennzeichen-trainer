const fs = require('fs');
const text = fs.readFileSync('plate-data.js', 'utf8');
const data = eval('(' + text.replace(/^window\.PLATE_DATA\s*=\s*/, '').replace(/;\s*$/, '') + ')');
const out = [];
for (const [state, entries] of Object.entries(data)) {
  for (const entry of entries) {
    const first = entry.regions && entry.regions[0] ? entry.regions[0] : '';
    if (!first) continue;
    const cleaned = first
      .replace(/^(Stadt|Landkreis|Kreis|Gemeinde|Ortschaft|Samtgemeinde|Stadt und Landkreis|Stadtverband|Verbandsgemeinde)\s+/i, '')
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
    const ok = letters.split('').every(ch => cleaned.includes(ch));
    const direct = ok && letters.length <= cleaned.length;
    if (!direct) {
      out.push({ code: entry.code, state, region: first, letters, cleaned });
    }
  }
}
out.sort((a, b) => a.code.localeCompare(b.code, 'de'));
console.log(JSON.stringify(out, null, 2));
