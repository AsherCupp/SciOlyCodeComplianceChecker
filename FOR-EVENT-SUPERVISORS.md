# For Event Supervisors — What This Tool Is (and Isn't)

This is a one-page plain-language explainer for Science Olympiad staff and Event Supervisors who are deciding whether to use, adopt, or recommend this tool. For the technical setup guide, see [`README.md`](README.md).

## What it is

A web page. You give it:

1. The rules for the event (built-in choices for Robot Tour and Electric Vehicle; custom rules can be uploaded).
2. A folder containing the team's code.

It gives you back a short list of **questions to review with the team** — things in the code that the AI noticed might be worth asking about.

## What it is NOT

- **It is not a judge.** It does not say "pass" or "fail." It does not tell you to accept or disqualify anyone.
- **It is not automated enforcement.** Every question is phrased as "here's what the AI noticed; here's what you might want to ask the team." You decide what to do with that.
- **It is not a substitute for a build interview.** Code review alone can't tell you whether the team built the robot, whether the code on the chassis matches what was submitted, or whether a student can explain what they wrote.

The tool is deliberately designed this way. Event Supervisors are not necessarily programmers — if the AI confidently declared a team "non-compliant" and got it wrong, you'd have no way to catch the error. So the AI is restricted to pointing and asking; you remain the authority.

## What an ES actually sees on competition day

1. Open the web page.
2. Enter a shared access code (distributed by SciOly to authorized ESes).
3. Pick the event from a dropdown (Robot Tour, Electric Vehicle, or upload your own rules).
4. Plug in the teams impounded thumb drive of code. If printed, do a standard interview instead of using the app.
4. Click "upload folder" and point it at the team's code folder.
5. Wait 5–15 seconds.
6. Read the questions. Each one has:
    - A short title (what the AI noticed)
    - A priority tag ("Likely worth checking" or "Worth a brief check")
    - A plain-English explanation of why it *might* matter
    - **A suggested question to ask the team.** This is the part you actually use.
    - If relevant, a short quoted snippet of code showing what triggered the question.

At the bottom of every report is a standing reminder of what the tool can't check (robot construction, intent, chassis match) and a note that the ES's direct observation is the authoritative check.

## Example — what a question looks like

> **Question 2 — Imports a library named `RobotTourPlanner`**
> *Priority: Likely worth checking*
>
> **What the AI noticed.** The submitted code includes an `#include <RobotTourPlanner.h>` and then calls `planner.computeOptimalRoute()` after passing in the target time and gate positions.
>
> **Why this might matter (rule 2.b).** The Robot Tour rules prohibit libraries that plan navigation or sequence turns; libraries that accept the course parameters and produce a motion plan are specifically called out.
>
> **Suggested question for the team.** "Can you show me where you wrote the code that decides the order of turns? Is `RobotTourPlanner` something your team wrote, or is it an outside library?"

The ES asks the team, listens to the answer, and decides. The AI does not weigh in on whether the answer is satisfactory.

## Common questions

**Q: What if the AI misses something?**
You're no worse off than today — you review the code yourself exactly as you would without the tool. The tool is additive; it doesn't replace human review.

**Q: What if the AI raises a false concern?**
You ask the team the suggested question, they clarify, you move on. The tool is designed to make false flags cheap (one short conversation) so that real flags get caught more reliably.

**Q: Does the team's code get stored anywhere?**
No. Code is held in memory only during the ~10-second analysis and discarded. Only metadata — timestamp, IP, file sizes, number of questions raised, duration — is written to a rolling usage log for audit purposes.

**Q: Will this tell teams apart / share code between teams?**
No. Each request is independent. There is no database of submissions.

**Q: What if the internet or the AI service is down mid-competition?**
The tool fails gracefully (the ES sees an error message and falls back to manual review). The tool is not a gate — a team's run is not contingent on the tool being available.

**Q: How accurate is it?**
No published benchmark exists. On the included sample submissions, the AI correctly flags a project that uses a prohibited planning library and correctly raises concerns about obvious copy-pasted tutorial code. On a clean student-written project, it typically raises zero questions. But accuracy is beside the point: the ES decides, not the AI.

**Q: What does it cost SciOly?**
At current AI pricing (~$0.02–$0.20 per analysis depending on code size), hosting 15,000 analyses per year costs roughly $300–$3,000 in AI fees plus ~$60/year in hosting. Self-hosted via SciOly's Anthropic account; no per-ES or per-team cost. SciOly could also chose to have ES install locally running AI and connect the API calls to that instead.

**Q: Who can use it?**
Anyone with the shared access code. SciOly distributes the code to authorized ESes through normal channels.

**Q: Can teams challenge a question the AI raised?**
The AI doesn't render decisions, so there's nothing to challenge. If an ES disqualifies a team based on conversation that started with a question the AI raised, that disqualification is the ES's to justify, exactly as it would be today.
