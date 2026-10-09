const fs = require('fs');
const raw = fs.readFileSync('wiki.json', 'utf8');
const data = JSON.parse(raw);
const w = data.parse.wikitext['*'];
const lines = w.split(/\r?\n/);
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i].includes("'''BL'''") || lines[i].includes("'''AA'''") || lines[i].includes("'''A'''")) {
    console.log('--- INDEX', i, '---');
    for (let j = i; j < Math.min(i + 20, lines.length); j += 1) {
      console.log(lines[j]);
    }
    break;
  }
}
