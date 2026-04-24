const form = document.getElementById('analyze-form');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const summaryBanner = document.getElementById('summary-banner');
const submittedFilesEl = document.getElementById('submitted-files');
const questionsEl = document.getElementById('questions');
const rulesUsedEl = document.getElementById('rules-used');
const rulesUsedTextEl = document.getElementById('rules-used-text');
const codeSummaryEl = document.getElementById('code-summary');
const codeSummaryBodyEl = document.getElementById('code-summary-body');

const folderInput = document.getElementById('code-folder');
const fileInput = document.getElementById('code-file');
const filePreview = document.getElementById('file-preview');
const codeHint = document.getElementById('code-hint');
const modeRadios = document.querySelectorAll('input[name="mode"]');

const rulesOptions = document.getElementById('rules-options');
const rulesFileInput = document.getElementById('rules-file');
const rulesHint = document.getElementById('rules-hint');

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

async function loadRulesPresets() {
  try {
    const res = await fetch('/api/rules');
    const payload = await res.json();
    renderRulesOptions(payload.presets || []);
  } catch (err) {
    rulesOptions.innerHTML =
      '<p class="error-inline">Could not load rules presets. Upload a custom rules file below.</p>';
    renderRulesOptions([]);
  }
}

function renderRulesOptions(presets) {
  const presetRadios = presets
    .map(
      (p, i) => `
        <label class="rules-option">
          <input type="radio" name="rulesChoice" value="preset:${escapeHtml(p.id)}"${i === 0 ? ' checked' : ''} />
          ${escapeHtml(p.name)}
        </label>`
    )
    .join('');
  rulesOptions.innerHTML =
    presetRadios +
    `<label class="rules-option">
       <input type="radio" name="rulesChoice" value="custom"${presets.length === 0 ? ' checked' : ''} />
       Upload custom rules…
     </label>`;
  rulesOptions
    .querySelectorAll('input[name="rulesChoice"]')
    .forEach((r) => r.addEventListener('change', onRulesChoiceChange));
  onRulesChoiceChange();
}

function selectedRulesChoice() {
  const el = rulesOptions.querySelector('input[name="rulesChoice"]:checked');
  return el ? el.value : '';
}

function onRulesChoiceChange() {
  const choice = selectedRulesChoice();
  if (choice === 'custom') {
    rulesFileInput.hidden = false;
    rulesFileInput.required = true;
    rulesHint.textContent = 'Upload a plain-text rules file (.txt).';
  } else {
    rulesFileInput.hidden = true;
    rulesFileInput.required = false;
    rulesFileInput.value = '';
    rulesHint.textContent = 'Using built-in rules for the selected event.';
  }
}

function currentMode() {
  for (const r of modeRadios) if (r.checked) return r.value;
  return 'folder';
}

function setMode(mode) {
  if (mode === 'folder') {
    folderInput.hidden = false;
    fileInput.hidden = true;
    fileInput.value = '';
    codeHint.textContent =
      "Pick the folder containing the team's project (.ino, .py, .cpp, etc.). Subfolders are included. Binaries and build artifacts are ignored.";
  } else {
    folderInput.hidden = true;
    fileInput.hidden = false;
    folderInput.value = '';
    codeHint.textContent = 'Pick a single source file (.ino, .py, .cpp, etc.).';
  }
  renderFilePreview();
}

modeRadios.forEach((r) => r.addEventListener('change', () => setMode(r.value)));

function activeCodeInput() {
  return currentMode() === 'folder' ? folderInput : fileInput;
}

function renderFilePreview() {
  const input = activeCodeInput();
  const files = input.files ? Array.from(input.files) : [];
  if (files.length === 0) {
    filePreview.classList.add('hidden');
    filePreview.innerHTML = '';
    return;
  }
  const paths = files.map((f) => f.webkitRelativePath || f.name).sort();
  const toShow = paths.slice(0, 15);
  const extra = paths.length - toShow.length;
  filePreview.innerHTML =
    `<li class="preview-header">${files.length} file(s) selected:</li>` +
    toShow.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join('') +
    (extra > 0 ? `<li class="preview-more">…and ${extra} more</li>` : '');
  filePreview.classList.remove('hidden');
}

folderInput.addEventListener('change', renderFilePreview);
fileInput.addEventListener('change', renderFilePreview);

function showStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = kind ? `status-${kind}` : '';
  statusEl.classList.toggle('hidden', !message);
}

function hideResult() {
  resultEl.classList.add('hidden');
  summaryBanner.className = '';
  summaryBanner.innerHTML = '';
  questionsEl.innerHTML = '';
  submittedFilesEl.classList.add('hidden');
  submittedFilesEl.innerHTML = '';
  rulesUsedEl.classList.add('hidden');
  rulesUsedEl.open = false;
  rulesUsedTextEl.textContent = '';
  codeSummaryEl.classList.add('hidden');
  codeSummaryBodyEl.textContent = '';
}

function renderRulesUsed(rulesText) {
  if (!rulesText) {
    rulesUsedEl.classList.add('hidden');
    return;
  }
  rulesUsedTextEl.textContent = rulesText;
  rulesUsedEl.classList.remove('hidden');
}

function renderCodeSummary(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    codeSummaryEl.classList.add('hidden');
    codeSummaryBodyEl.textContent = '';
    return;
  }
  codeSummaryBodyEl.textContent = trimmed;
  codeSummaryEl.classList.remove('hidden');
}

function renderQuestionCard(q, num) {
  const priorityLabel = q.priority === 'likely' ? 'Likely worth checking' : 'Worth a brief check';
  const priorityClass = q.priority === 'likely' ? 'priority-likely' : 'priority-brief';
  const refs =
    Array.isArray(q.ruleReferences) && q.ruleReferences.length > 0
      ? `<span class="rule-refs"> (rule${q.ruleReferences.length > 1 ? 's' : ''}: ${q.ruleReferences
          .map(escapeHtml)
          .join(', ')})</span>`
      : '';
  const snippetHtml =
    q.snippet && q.snippet.code
      ? `<div class="question-section">
           <div class="section-label">Relevant code${
             q.snippet.path ? ` <span class="snippet-path">— ${escapeHtml(q.snippet.path)}</span>` : ''
           }</div>
           <pre class="snippet"><code>${escapeHtml(q.snippet.code)}</code></pre>
         </div>`
      : '';
  return `
    <div class="question-card">
      <h3 class="question-title">Question ${num} — ${escapeHtml(q.title || '')}</h3>
      <div class="question-priority ${priorityClass}">${priorityLabel}</div>
      <div class="question-section">
        <div class="section-label">What the AI noticed</div>
        <div class="section-body">${escapeHtml(q.noticed || '')}</div>
      </div>
      <div class="question-section">
        <div class="section-label">Why this might matter${refs}</div>
        <div class="section-body">${escapeHtml(q.whyMightMatter || '')}</div>
      </div>
      ${snippetHtml}
      <div class="question-section">
        <div class="section-label">Suggested question for the team</div>
        <div class="section-body ask-team">${escapeHtml(q.askTeam || '')}</div>
      </div>
    </div>
  `;
}

function renderQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    questionsEl.innerHTML =
      '<div class="no-concerns">No concerns flagged. The code did not contain patterns that plausibly implicate the supplied rules.</div>';
    return;
  }
  questionsEl.innerHTML = questions.map((q, i) => renderQuestionCard(q, i + 1)).join('');
}

function renderSubmittedFiles(accepted, skipped, rulesSource) {
  if (!accepted || accepted.length === 0) return;
  let html = '<details><summary>';
  html += `Rules: <code>${escapeHtml(rulesSource || '—')}</code> · ${accepted.length} file(s) analyzed`;
  if (skipped && skipped.length > 0) html += `, ${skipped.length} skipped`;
  html += '</summary><ul>';
  html += accepted.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join('');
  html += '</ul>';
  if (skipped && skipped.length > 0) {
    html += '<p class="skipped-label">Skipped:</p><ul class="skipped-list">';
    html += skipped
      .map((s) => `<li><code>${escapeHtml(s.path)}</code> — ${escapeHtml(s.reason)}</li>`)
      .join('');
    html += '</ul>';
  }
  html += '</details>';
  submittedFilesEl.innerHTML = html;
  submittedFilesEl.classList.remove('hidden');
}

function renderResult({ codeSummary, questions, questionCount, acceptedFiles, skippedFiles, rulesSource, rulesText }) {
  resultEl.classList.remove('hidden');
  const count = typeof questionCount === 'number' ? questionCount : (questions || []).length;
  let title;
  if (count === 0) title = 'No questions raised.';
  else if (count === 1) title = '1 question to review with the team.';
  else title = `${count} questions to review with the team.`;
  summaryBanner.className = 'summary-banner';
  summaryBanner.innerHTML =
    `<div class="summary-title">${escapeHtml(title)}</div>` +
    `<div class="summary-sub">The Event Supervisor makes the final call.</div>`;
  renderSubmittedFiles(acceptedFiles, skippedFiles, rulesSource);
  renderRulesUsed(rulesText);
  renderCodeSummary(codeSummary);
  renderQuestions(questions || []);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideResult();

  const input = activeCodeInput();
  const files = input.files ? Array.from(input.files) : [];
  if (files.length === 0) {
    showStatus('Please choose a code file or folder.', 'error');
    return;
  }

  const choice = selectedRulesChoice();
  if (!choice) {
    showStatus('Please pick an event or upload a rules file.', 'error');
    return;
  }
  if (choice === 'custom' && !rulesFileInput.files[0]) {
    showStatus('Please choose a rules file to upload.', 'error');
    return;
  }

  showStatus('Analyzing… this usually takes 5–15 seconds.', 'pending');
  submitBtn.disabled = true;

  const data = new FormData();
  data.append('accessCode', document.getElementById('accessCode').value);
  if (choice === 'custom') {
    const rf = rulesFileInput.files[0];
    data.append('rules', rf, rf.name);
  } else {
    const presetId = choice.replace(/^preset:/, '');
    data.append('rulesPreset', presetId);
  }
  for (const f of files) {
    const relPath = f.webkitRelativePath || f.name;
    data.append('code', f, relPath);
  }

  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: data });
    const payload = await res.json().catch(() => ({}));

    if (res.status === 401) {
      showStatus('Invalid access code.', 'error');
      return;
    }
    if (res.status === 429) {
      showStatus(payload.error || 'Please wait 30 seconds between analyses.', 'error');
      return;
    }
    if (res.status === 413) {
      showStatus(payload.error || 'Upload too large.', 'error');
      return;
    }
    if (!res.ok) {
      showStatus(payload.error || `Request failed (HTTP ${res.status}).`, 'error');
      return;
    }

    showStatus('', '');
    renderResult(payload);
  } catch (err) {
    showStatus('Network error: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

loadRulesPresets();
