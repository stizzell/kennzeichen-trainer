const fs = require('fs');
const data = JSON.parse(fs.readFileSync('wiki.json', 'utf8'));
const lines = data.parse.wikitext['*'].split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('=== A ==='));
for (let i = start; i < Math.min(start + 70, lines.length); i += 1) {
  console.log(lines[i]);
}
