const path = require('path');

const CODE_EXTENSIONS = new Set([
  '.ino', '.pde',
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx',
  '.py', '.pyw',
  '.java', '.kt', '.swift',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.rs', '.go',
  '.asm', '.s',
  '.sh', '.bash', '.zsh', '.ps1',
  '.txt', '.md', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.properties',
  '.cmake', '.mk', '.make'
]);

const ALLOWED_BARE_FILENAMES = new Set([
  'makefile', 'cmakelists.txt', 'dockerfile', 'platformio.ini', 'arduino.json'
]);

const EXCLUDED_DIR_PARTS = new Set([
  '.git', 'node_modules', '__pycache__', '.venv', 'venv', 'env',
  '.vscode', '.idea', 'build', 'dist', 'target', 'out', 'bin',
  '.pio', '.pioenvs', '.piolibdeps'
]);

const MAX_BUNDLE_BYTES = 500 * 1024;

function shouldInclude(relativePath) {
  const parts = relativePath.split(/[\\/]+/);
  for (let i = 0; i < parts.length - 1; i++) {
    if (EXCLUDED_DIR_PARTS.has(parts[i].toLowerCase())) return false;
  }
  const leaf = parts[parts.length - 1];
  if (!leaf || leaf.startsWith('.')) return false;
  const ext = path.extname(leaf).toLowerCase();
  if (ext && CODE_EXTENSIONS.has(ext)) return true;
  if (!ext && ALLOWED_BARE_FILENAMES.has(leaf.toLowerCase())) return true;
  return false;
}

function looksLikeText(buffer) {
  const sample = buffer.slice(0, Math.min(buffer.length, 4096));
  let nonPrintable = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) nonPrintable++;
  }
  return nonPrintable / (sample.length || 1) < 0.1;
}

function normalizePath(p) {
  return (p || '').replace(/\\+/g, '/').replace(/^\.?\/+/, '');
}

function bundleCodeFiles(files) {
  const accepted = [];
  const skipped = [];
  let totalBytes = 0;

  const sorted = files
    .map((f) => ({ ...f, originalname: normalizePath(f.originalname) }))
    .sort((a, b) => a.originalname.localeCompare(b.originalname));

  for (const f of sorted) {
    if (!shouldInclude(f.originalname)) {
      skipped.push({ path: f.originalname, reason: 'not a recognized code/text file' });
      continue;
    }
    if (!looksLikeText(f.buffer)) {
      skipped.push({ path: f.originalname, reason: 'looks like a binary file' });
      continue;
    }
    if (totalBytes + f.buffer.length > MAX_BUNDLE_BYTES) {
      skipped.push({ path: f.originalname, reason: 'would exceed 500KB bundle cap' });
      continue;
    }
    accepted.push(f);
    totalBytes += f.buffer.length;
  }

  if (accepted.length === 0) {
    const err = new Error(
      'No recognized code or text files were found in the upload. ' +
        'Accepted extensions include .ino, .cpp, .h, .py, .js, .txt, etc.'
    );
    err.status = 400;
    throw err;
  }

  const sections = accepted.map((f) => {
    return `--- FILE: ${f.originalname} ---\n${f.buffer.toString('utf8')}`;
  });

  return {
    bundleText: sections.join('\n\n'),
    acceptedPaths: accepted.map((f) => f.originalname),
    skipped,
    totalBytes
  };
}

module.exports = { bundleCodeFiles, MAX_BUNDLE_BYTES };
