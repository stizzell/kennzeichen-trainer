const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'plate-data.js');
const outputPath = path.join(__dirname, 'plate-origin-data.js');
const csvPath = path.join(__dirname, 'kennzeichen_ursprung.csv');
const jsonPath = path.join(__dirname, 'kennzeichen_ursprung.json');

const text = fs.readFileSync(inputPath, 'utf8');
const match = text.match(/window\.PLATE_DATA\s*=\s*(\{[\s\S]*\});?\s*$/);

if (!match) {
  throw new Error('PLATE_DATA not found in plate-data.js');
}

const data = eval('(' + match[1] + ')');

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

const rows = [];

for (const [stateName, entries] of Object.entries(data)) {
  for (const entry of entries) {
    const code = cleanValue(entry.code);
    const kreis = Array.isArray(entry.regions) && entry.regions.length ? cleanValue(entry.regions[0]) : '';
    const derivation = cleanValue(entry.derivation);
    const city = derivation || (Array.isArray(entry.answers) && entry.answers.length ? cleanValue(entry.answers[0]) : kreis);

    rows.push({
      kennzeichen: code,
      bundesland: stateName,
      kreis,
      stadt_oder_ursprung: city,
      abkuerzung_ursprung: derivation,
      alternativen: Array.isArray(entry.answers) ? entry.answers.join(' | ') : ''
    });
  }
}

const normalizedJs = `window.PLATE_ORIGIN_DATA = ${JSON.stringify(rows, null, 2)};\n`;
fs.writeFileSync(outputPath, normalizedJs, 'utf8');

const headers = ['kennzeichen', 'bundesland', 'kreis', 'stadt_oder_ursprung', 'abkuerzung_ursprung', 'alternativen'];
const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;
const csvRows = [headers.join(',')];

for (const row of rows) {
  csvRows.push(headers.map((header) => escapeCsv(row[header] ?? '')).join(','));
}

fs.writeFileSync(csvPath, csvRows.join('\n') + '\n', 'utf8');
fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2) + '\n', 'utf8');

console.log(`Erzeugt ${rows.length} Einträge in ${outputPath}`);
console.log(`CSV: ${csvPath}`);
console.log(`JSON: ${jsonPath}`);
