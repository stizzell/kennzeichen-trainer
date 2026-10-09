const fs = require('fs');
const data = JSON.parse(fs.readFileSync('wiki.json', 'utf8'));
const lines = data.parse.wikitext['*'].split(/\r?\n/);
let count = 0;
for (let i = 0; i < lines.length && count < 10; i += 1) {
  const line = lines[i];
  if (/^\|\s*(rowspan=|\*\*\*)?/.test(line) && /'''/.test(line)) {
    const code = line.match(/'''([^']+)'''/)?.[1] || '??';
    const preview = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 7); j += 1) {
      const next = lines[j];
      if (/^\|\-/.test(next)) break;
      if (next.startsWith('|')) preview.push(next);
    }
    console.log(JSON.stringify({ code, preview }));
    count += 1;
  }
}
