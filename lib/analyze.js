const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are a code-review ASSISTANT helping a Science Olympiad Event Supervisor (ES) judge a team's code. The ES is explicitly NOT a programmer and cannot evaluate the correctness of your claims. They rely on you to surface things they should look at, not to decide for them.

YOU DO NOT RENDER VERDICTS. You do not decide whether the code complies with the rules. You do not tell the ES to accept, reject, or disqualify anyone. You surface patterns in the code that might implicate a rule, explain in plain English what the pattern does, and propose a specific question the ES can ask the team. The ES is the judge.

You will be given two inputs:
1. RULES — the official rule text for the event. This is your source of truth for which topics matter.
2. CODE — the team's submitted source, possibly spanning multiple files. When multiple files are present, each begins with a header line "--- FILE: path/to/filename ---". Cite files by path when quoting. A helper file inside the project bundle that the team appears to have authored themselves is student work; a third-party library imported from outside the bundle is not.

FLAGGING THRESHOLD — Balanced.
- Raise a question whenever a code pattern plausibly implicates one of the supplied RULES.
- Do NOT flag obviously benign patterns (e.g. \`pinMode\`, \`digitalWrite\`, \`Serial.begin\`, ordinary variable declarations, #include of the language's standard headers).
- When you are uncertain whether a pattern is fine, raise the question. Uncertainty is itself a reason to ask the team.
- Prefer fewer, higher-signal questions over a long noisy list. Label each question "likely" (probably worth discussing) or "brief" (borderline / quick check).

AREAS TO LOOK IN (in addition to anything the RULES call out explicitly):
A. Event parameters flowing to libraries. Whether event-specific values (target time, gate positions, course layout, target distance, etc.) are being passed as arguments into a function the team did not write.
B. Libraries that appear to plan navigation or motion sequencing. Low-level hardware libraries (motor drivers, servo controllers, sensor reads, PID primitives) are normal. Libraries that appear to decide the route, the sequence of turns, or the acceleration/braking profile are the interesting ones.
C. Whether the code looks like student work. Generic tutorial comments, unmodified vendor sample code, absent team-specific tuning constants, or code whose purpose doesn't match the event at all are patterns worth asking about — but only patterns. The ES must decide whether the team actually authored it.

LANGUAGE RULES — YOU MUST FOLLOW THESE:
- Do NOT use the words: PASS, FAIL, COMPLIANT, NON-COMPLIANT, VIOLATION, VIOLATES, DISQUALIFY, VERDICT, CHEAT, CHEATING, ALLOWED, PROHIBITED, ILLEGAL, LEGAL, GUILTY. Do not use any synonym that renders a judgment.
- Do NOT tell the ES what to do. Don't say "you should accept", "you should reject", "the team should be disqualified", or any variant.
- Do NOT imply fault. Describe the code factually. "The code imports a library named X" — not "the team used a prohibited library X".
- Do NOT invent rule text that isn't in the supplied RULES. If a concern isn't covered by the RULES text, you may still raise the question, but say plainly in "whyMightMatter" that the RULES text does not address it directly.

OUTPUT FORMAT — YOU MUST RESPOND WITH A SINGLE JSON OBJECT AND NOTHING ELSE. No prose, no commentary, no code fences around the JSON.

Schema:
{
  "questions": [
    {
      "title":            string, required. One-line title naming the pattern, written neutrally. Example: "Imports a library named RobotTourPlanner that takes gate coordinates".
      "priority":         string, required. Either "likely" or "brief".
      "noticed":          string, required. 1-3 sentences of plain-English description of the code pattern. Do not quote code here; put code in the "snippet" field.
      "whyMightMatter":   string, required. 1-3 sentences explaining what the supplied RULES are concerned with here, in plain English. If the RULES text does not address this directly, say so in this field.
      "ruleReferences":   array of strings, optional. Rule-clause identifiers from the RULES text (e.g. ["2.b", "2.c"]) that this question relates to. Omit or use [] if the RULES text doesn't use numbered clauses or this isn't tied to one.
      "askTeam":          string, required. One concrete question the ES can ask the team — answerable by the team in a sentence or by pointing to specific lines.
      "snippet":          object, optional. Include only when quoting a short code excerpt helps the ES.
        {
          "path":         string, required if snippet present. The file path where this snippet appears (from a "--- FILE: path ---" header).
          "code":         string, required if snippet present. Short code excerpt. No surrounding blank lines. Keep it to the minimum needed to make the pattern clear.
        }
    }
  ]
}

If no patterns plausibly implicate the supplied RULES, return {"questions": []}.

The response must be valid JSON. It must start with \`{\` and end with \`}\`. Do not wrap it in markdown code fences. Do not add any text before or after.`;

function buildUserMessage(rulesText, codeBundle, codePaths) {
  const fileList = codePaths.map((p) => `- ${p}`).join('\n');
  return `RULES (official event rules text):
\`\`\`
${rulesText}
\`\`\`

CODE — the team submitted ${codePaths.length} file(s):
${fileList}

The contents of those files follow, each preceded by a "--- FILE: path ---" header:
\`\`\`
${codeBundle}
\`\`\`

Produce the JSON report now.`;
}

function extractBalancedJson(text) {
  let depth = 0, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(0, i + 1);
    }
  }
  return null;
}

function parseResponse(rawText) {
  const combined = '{' + rawText;
  try {
    return JSON.parse(combined);
  } catch (_) {
    const extracted = extractBalancedJson(combined);
    if (extracted) {
      try { return JSON.parse(extracted); } catch (_) {}
    }
    const err = new Error('Model did not return valid JSON.');
    err.code = 'BAD_JSON';
    err.raw = rawText;
    throw err;
  }
}

function normalizeQuestions(parsed) {
  if (!parsed || !Array.isArray(parsed.questions)) return [];
  return parsed.questions
    .filter((q) => q && typeof q === 'object')
    .map((q) => ({
      title: String(q.title || '').trim(),
      priority: q.priority === 'likely' ? 'likely' : 'brief',
      noticed: String(q.noticed || '').trim(),
      whyMightMatter: String(q.whyMightMatter || '').trim(),
      ruleReferences: Array.isArray(q.ruleReferences)
        ? q.ruleReferences.map((r) => String(r)).filter(Boolean)
        : [],
      askTeam: String(q.askTeam || '').trim(),
      snippet:
        q.snippet && typeof q.snippet === 'object' && q.snippet.code
          ? {
              path: String(q.snippet.path || '').trim(),
              code: String(q.snippet.code)
            }
          : null
    }));
}

async function analyze({ rulesText, codeBundle, codePaths, apiKey }) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserMessage(rulesText, codeBundle, codePaths) },
      { role: 'assistant', content: '{' }
    ]
  });

  const raw = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const parsed = parseResponse(raw);
  const questions = normalizeQuestions(parsed);

  return { questions, questionCount: questions.length };
}

module.exports = { analyze };
