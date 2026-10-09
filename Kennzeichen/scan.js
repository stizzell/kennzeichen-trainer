const fs = require('fs');
const text = fs.readFileSync('plate-data.js', 'utf8');
const data = Function('return (' + text.replace(/^window\.PLATE_DATA\s*=\s*/, '').replace(/;\s*$/, '') + ');')();
const list = [];
for (const [state, entries] of Object.entries(data)) {
  for (const entry of entries) {
    const region = entry.regions && entry.regions[0] ? entry.regions[0] : '';
    if (!region) continue;
    const cleaned = region
      .replace(/^(Stadt|Landkreis|Kreis|Gemeinde|Stadt und Landkreis|Samtgemeinde|Landratsamt|Verbandsgemeinde|Stadtverband)\s+/i, '')
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
    const direct = letters.split('').every(ch => cleaned.includes(ch));
    if (!direct || letters.length > cleaned.length) {
      list.push({ code: entry.code, region, letters, cleaned });
    }
  }
}
console.log('NON_DIRECT_COUNT=' + list.length);
for (const item of list.sort((a,b) => a.code.localeCompare(b.code, 'de'))) {
  console.log(item.code + ' | ' + item.region + ' | letters=' + item.letters + ' | cleaned=' + item.cleaned);
}
