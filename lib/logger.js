const fs = require('fs');
const path = require('path');

const isServerless = !!process.env.VERCEL;
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'usage.log');

if (!isServerless && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logUsage(entry) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
  if (isServerless) {
    process.stdout.write(line);
    return;
  }
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('Failed to write usage log:', err);
  });
}

module.exports = { logUsage };
