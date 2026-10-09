const fs = require('fs');
const text = fs.readFileSync('plate-data.js', 'utf8');
const data = Function('window', 'return (' + text.replace(/^window\.PLATE_DATA\s*=\s*/, '').replace(/;\s*$/, '') + ');')({});
const entries = new Map();
for (const [state, list] of Object.entries(data)) {
  for (const item of list) {
    entries.set(item.code, item.regions[0] || state);
  }
}
console.log('TOTAL_UNIQUE=' + entries.size);
for (const [code, region] of [...entries.entries()].sort(([a],[b]) => a.localeCompare(b, 'de'))) {
  console.log(code + ' | ' + region);
}
