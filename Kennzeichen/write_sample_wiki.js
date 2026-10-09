const fs = require('fs');
const data = JSON.parse(fs.readFileSync('wiki.json', 'utf8'));
const lines = data.parse.wikitext['*'].split(/\r?\n/);
const out = [];
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i].includes('=== A ===')) {
    for (let j = i; j < Math.min(i + 80, lines.length); j += 1) {
      out.push(lines[j]);
    }
    break;
  }
}
fs.writeFileSync('wiki_sample.txt', out.join('\n'), 'utf8');
console.log('written', out.length, 'lines');
