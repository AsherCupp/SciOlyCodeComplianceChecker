const fs = require('fs');
const path = require('path');

const RULES_DIR = path.join(__dirname, '..', 'rules');

const PRESET_DEFS = [
  { id: 'robot-tour',       name: 'Robot Tour',       file: 'robot-tour.txt' },
  { id: 'electric-vehicle', name: 'Electric Vehicle', file: 'electric-vehicle.txt' }
];

const presets = {};
for (const def of PRESET_DEFS) {
  const full = path.join(RULES_DIR, def.file);
  presets[def.id] = {
    id: def.id,
    name: def.name,
    text: fs.readFileSync(full, 'utf8')
  };
}

function listPresets() {
  return PRESET_DEFS.map((d) => ({ id: d.id, name: d.name }));
}

function getPresetText(id) {
  return presets[id] ? presets[id].text : null;
}

module.exports = { listPresets, getPresetText };
