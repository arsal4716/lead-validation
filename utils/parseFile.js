const Papa = require('papaparse');
const XLSX = require('xlsx');


function tryParseCsv(buffer) {
const text = buffer.toString('utf8');
const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
if (parsed && parsed.data && parsed.data.length) return parsed.data;
return null;
}


function tryParseXlsx(buffer) {
const workbook = XLSX.read(buffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
return json;
}


function parseFile(buffer, filename) {
const lower = filename.toLowerCase();
if (lower.endsWith('.csv')) {
const d = tryParseCsv(buffer);
if (d) return d;
}


// attempt XLSX
try {
const d = tryParseXlsx(buffer);
if (d && d.length) return d;
} catch (e) {
}

const d = tryParseCsv(buffer);
if (d) return d;


throw new Error('Unable to parse uploaded file (supported: CSV, XLSX)');
}


module.exports = { parseFile };