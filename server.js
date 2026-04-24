require('dotenv').config();

const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const { analyze } = require('./lib/analyze');
const { logUsage } = require('./lib/logger');
const { bundleCodeFiles } = require('./lib/bundle');
const { listPresets, getPresetText } = require('./lib/rules-presets');

const PORT = process.env.PORT || 3000;
const MAX_FILE_BYTES = 200 * 1024;
const MAX_FILES = 200;

const app = express();
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES + 1 }
});

const analyzeLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait 30 seconds between analyses.' }
});

function checkAccessCode(req, res, next) {
  const expected = process.env.ACCESS_CODE;
  if (!expected) {
    return res.status(500).json({ error: 'Server is missing ACCESS_CODE configuration.' });
  }
  const provided = req.body && req.body.accessCode;
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid access code.' });
  }
  next();
}

app.get('/api/rules', (req, res) => {
  res.json({ presets: listPresets() });
});

app.post(
  '/api/analyze',
  upload.fields([
    { name: 'rules', maxCount: 1 },
    { name: 'code', maxCount: MAX_FILES }
  ]),
  checkAccessCode,
  analyzeLimiter,
  async (req, res) => {
    const started = Date.now();
    const ip = req.ip;

    const uploadedRules = req.files && req.files.rules && req.files.rules[0];
    const rulesPresetId = (req.body && req.body.rulesPreset) || '';
    const codeFiles = (req.files && req.files.code) || [];

    let rulesText = null;
    let rulesSource = null;
    let rulesBytes = 0;

    if (uploadedRules) {
      rulesText = uploadedRules.buffer.toString('utf8');
      rulesSource = 'upload:' + uploadedRules.originalname;
      rulesBytes = uploadedRules.size;
    } else if (rulesPresetId) {
      const presetText = getPresetText(rulesPresetId);
      if (!presetText) {
        return res.status(400).json({ error: `Unknown rules preset: ${rulesPresetId}` });
      }
      rulesText = presetText;
      rulesSource = 'preset:' + rulesPresetId;
      rulesBytes = Buffer.byteLength(presetText, 'utf8');
    } else {
      return res.status(400).json({ error: 'Select a rules preset or upload a custom rules file.' });
    }

    if (codeFiles.length === 0) {
      return res.status(400).json({ error: 'At least one code file is required.' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY configuration.' });
    }

    let bundle;
    try {
      bundle = bundleCodeFiles(codeFiles);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const codeSummary = {
      fileCount: bundle.acceptedPaths.length,
      totalBytes: bundle.totalBytes,
      skippedCount: bundle.skipped.length
    };

    try {
      const { questions, questionCount } = await analyze({
        rulesText,
        codeBundle: bundle.bundleText,
        codePaths: bundle.acceptedPaths,
        apiKey: process.env.ANTHROPIC_API_KEY
      });

      const durationMs = Date.now() - started;
      logUsage({
        ip,
        rulesSource,
        rulesBytes,
        ...codeSummary,
        questionCount,
        durationMs
      });

      res.json({
        questions,
        questionCount,
        rulesSource,
        rulesText,
        acceptedFiles: bundle.acceptedPaths,
        skippedFiles: bundle.skipped
      });
    } catch (err) {
      const durationMs = Date.now() - started;
      logUsage({
        ip,
        rulesSource,
        rulesBytes,
        ...codeSummary,
        questionCount: null,
        durationMs,
        error: err.message
      });
      console.error('Analyze error:', err);
      const msg =
        err.code === 'BAD_JSON'
          ? 'The AI response could not be parsed. Please try again.'
          : 'Analysis failed. ' + (err.message || 'Unknown error.');
      res.status(502).json({ error: msg });
    }
  }
);

app.use((err, req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'A file exceeded the 200KB per-file limit.' });
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ error: `Too many files (limit is ${MAX_FILES}).` });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`SciOly Code Compliance Checker listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
