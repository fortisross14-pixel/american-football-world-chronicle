---
name: game-design-audit
description: Audit this football chronicle game the way a game designer would — core loop, pacing, moments of payoff, friction and mobile play — and turn findings into small, testable edits. Use when asked to audit, review, improve, "add soul", or make the game more exciting.
---

# Game design audit

A chronicle sim has no controller in the player's hands. The player's verbs are
**advance, watch, read, follow, compare**. Excitement comes from anticipation and
payoff around those verbs, not from new mechanics. Audit against that.

## 1. Map the loop before judging it

Write down the loop as the player experiences it, with the clicks it takes:

```
Preseason → weeks (sim 1 / 4 / to finale) → Finale show → Awards →
Offseason stages (8 clicks) → Start next year
```

For each step note: what the player **expects** before clicking, what they
**learn** after, and whether anything on screen connects the two. A step with no
expectation is a spreadsheet; a step with no payoff is a chore.

## 2. Measure, don't guess

The sim is deterministic and headless. Before claiming "X never happens", run it:

```bash
node -e "import('./src/sim/generate.js').then(async g=>{const s=await import('./src/sim/season.js');
let u=g.createUniverse(7);for(let y=0;y<10;y++){u=s.simulateToSeasonEnd(s.simulateToPostseason(u));
u=s.beginOffseason(u);while(u.phase==='Offseason')u=s.advanceOffseasonStage(u);u=s.startNextSeason(u);}
const t={};u.news.forEach(n=>t[n.type]=(t[n.type]||0)+1);console.log(t)})"
```

Useful counts: headline types per season, star (Epic+) movement per offseason,
repeat champions, upsets, how often the favourite wins. `npm run qa` must still
pass after any balance change — it guards the stat bands.

## 3. Checklist

**Anticipation** — does the player know what to look forward to?
- Is there a question at the start of each season/stage (favourites, odds,
  "will he stay?") that the end answers?
- Are stakes shown *before* the result (contract year, chasing a record,
  defending champion, dynasty ceiling)?

**Payoff** — is the big moment big?
- Are the 5–10 most important events per year presented with ceremony
  (reveal, card, full-screen), while the rest stay in tables?
- Is a rare event (three-peat, Generational draftee, record) visibly rarer
  than a common one? Superlatives must be scarce.

**Memory** — does the world remember?
- Do headlines reference history (streaks, droughts, "first since")?
- Can the player find any team's or player's story in two taps?

**Friction** — on a phone, one-handed
- Primary action reachable without scrolling; tap targets ≥ 40px.
- No horizontal page scroll at 390px. Tables can scroll inside a panel.
- Long sims show progress; nothing blocks without feedback.
- Repeated chores (e.g. 8 offseason clicks) have a "do the rest" shortcut
  that still lands on the moments worth seeing.

**Consistency**
- Grammar for plural team names ("the Bengals acquire"), possessives,
  articles ("an A+", "a B").
- Every number has a unit and context (12.4% *title odds*, *+4* strength).

## 4. Turn findings into edits

Rank by (player impact) / (lines changed). Prefer:
1. Making the game *notice* something that already happens (headline, chip).
2. Re-presenting existing data with ceremony (reveal, card, banner).
3. Small balance tweaks behind a QA assertion.
4. New systems — last, and only if 1–3 can't get there.

Verify each edit in the running app at phone width (390×844) with Playwright,
and add a QA assertion for any rule the game must keep (caps, odds sum, grades).
