const express = require('express');
const multer = require('multer');
const { parseFile } = require('../utils/parseFile');
const { validateRows } = require('../services/validateService');


const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();
router.post('/validate-file', upload.single('file'), async (req, res) => {
try {
if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

const content = req.file.buffer;
const filename = req.file.originalname || '';
const { leadColumn, certColumn } = req.body;
const rows = parseFile(content, filename);
const result = await validateRows(rows, { leadColumn, certColumn });
res.json(result);
} catch (err) {
console.error(err);
res.status(500).json({ error: err.message || 'Server error' });
}
});


module.exports = router;