# Design Notes

This document records the non-obvious design decisions behind the SciOly Code Review Assistant, in FAQ form. It is aimed at anyone deciding whether to adopt the tool, maintain it, or change it — and should answer "why is it like this?" without having to read the code.

## Why advisory, not pass/fail?

The target user is an Event Supervisor who is deliberately not required to be a programmer. If the AI confidently reported `VERDICT: FAIL` based on a misread of the code — for example, mistaking a student-written helper library for a third-party one — a non-technical ES would have no way to notice the error. A disqualified team loses their chance to compete; the cost of a false negative from the AI is enormous.

The inverse risk (the AI missing a real violation) is small, because the ES's own review happens regardless.

Advisory mode keeps the authority where it belongs. The AI surfaces patterns; the ES decides. The tool's system prompt explicitly forbids the words PASS, FAIL, VIOLATION, COMPLIANT, and related synonyms, and the response schema has no verdict field to render.

## Why per-IP rate limit and no daily cap?

It prevents ES from being restricted from the tool if the competition they are volunteering for has many competitors.

- Access-code gate (prevents strangers from discovering the URL and draining credits)
- Per-IP throttle of 1 request / 30 seconds (prevents a single user from looping a script)
- Bundle size cap of 500 KB (prevents a user from ballooning per-call cost)
- Usage log (retroactive audit if anything looks wrong)

If cost becomes a real concern, a sensible response is to tighten the per-IP throttle or lower the bundle cap — not to add a ceiling that could leave an ES stranded in the middle of judging.

## Why an access code instead of per-user accounts?

Event Supervisors rotate between events and seasons. Per-user accounts would create significant administrative overhead (account provisioning, password resets, offboarding) for an extremely low-value authentication model — ESes aren't particularly sensitive targets.

The access code is a single shared secret that SciOly distributes through existing channels. It's easy to rotate (change one env var), easy to revoke (change it and don't redistribute), and effectively blocks random internet traffic from burning org credits.

For a future iteration, replacing this with per-tournament codes would add minor auditability at modest cost.


## Why claude-sonnet-4-20250514 and not a cheaper model?

The judgment calls this tool makes (is this library a route planner or a motor driver? is this code plausibly student-written?) benefit from stronger reasoning. Haiku 4.5 would cut costs by ~3–5× and would likely still catch the obvious cases, but could underperform on the subtler "stock vs. student code" check. This is something whoever is implementing should test and see which model gives best performance for cost.

Note: `MAX_TOKENS` is 2048. That's enough headroom for ~8–10 questions of typical length. Longer reports would get truncated; if that becomes common, bump it to 4096 in `lib/analyze.js`.


## Why filter files server-side instead of trusting the upload?

Teams accidentally include `build/`, `node_modules/`, `__pycache__/`, `.git/`, compiled binaries, and images. Sending all of that to the AI would:

- Cost tokens
- Dilute the signal (the AI spends attention reading garbage)
- Risk hitting the context window on a submission that isn't actually that big

The server (`lib/bundle.js`) applies an extension allowlist and a directory blocklist, binary-sniffs, and reports skipped files back to the UI so the ES can see what wasn't analyzed. This also makes the tool more predictable — the same submission produces the same bundle regardless of what junk files are sitting next to the code.

## Why Railway as the primary deploy target?

Vercel requires wrapping Express in serverless-function adapters and cannot write to a persistent log file. Railway runs `npm start` directly, keeps the Express server alive, and lets the log file work normally. For a small tool with a handful of concurrent users, Railway is simpler, cheaper, and matches the code exactly as written.

Vercel support is still in the repo (`vercel.json` + a `process.env.VERCEL` branch in the logger) for anyone who prefers it — logs go to stdout there, which Vercel captures.


## Decisions deliberately NOT made

- **No per-team accounts or login.** Too much overhead for the problem.
- **No database.** The tool is stateless. Usage log is append-only text. This also prevents concerns of teams' propietary code being leaked.
- **No automated retrieval of official rules.** Rules text is stored as static files in `rules/` because the official rules can change mid-season and the authoritative source is SciOly itself, not a web scrape. Additionally, the rules.txt isn't just a text version of the rules. It needs a bit of wrapper and interpretation around it to make the AI give good results.

## What would I change?

- **Per-tournament access codes** — for slightly better audit granularity and security, since codes could be revoked once a tournament is concluded.
- **A second opinion pass** — call the model twice and only surface questions both runs raised. Cuts false flags roughly in half; doubles cost. Worth testing if ES feedback says flags are too noisy.
- **Structured rule citations** — right now the AI cites rule clauses by name (e.g. "2.b"). If the rules files had a stable clause ID scheme, the UI could deep-link from each question to the exact clause in the "Rules the AI was given" expandable.
- **The rules themselves** — the current rules aren't perfect, and could use refinement. They've given okay results, but should be improved before any real deployment. Also, they currently reflect a proposed change to the rules regarding libraries that is not official
