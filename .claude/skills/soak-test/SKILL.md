---
name: soak-test
description: "Long-run soak test for this universe — simulate 25–50 seasons headless and watch for slow leaks: save-size growth, slowdowns, stranded players, rarity drift, broken caps, stale or repetitive storylines. Use before a release, after changing anything that accumulates over years (history, news, records, offseason archives), or when late-game saves feel slow."
argument-hint: "[seasons=30] [seed]"
---

# Soak test (football chronicle)

Adapted from the `soak-test` skill in
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT).
The original is a manual play-session protocol; here the "session" is a
headless multi-decade simulation, because players of a chronicle game keep one
save for years.

## What accumulates in this game

`u.seasonHistory` (unbounded), `u.news` (capped 600), `u.records`,
`u.statHistory`, `u.offseasonHistory` (capped 25, trimmed after 3),
`u.transactions`, `u.draftHistory`, retired players, rivalries, `storyFlags`.
Anything unbounded is a leak candidate.

## Protocol

Quick path: `npm run soak` (30 seasons) or `npm run soak -- 40 SEED`. It prints a
checkpoint every 5 seasons and fails on budget, rarity, stranded talent or a broken
dynasty ceiling. Use the steps below when you need a deeper breakdown.


1. Run N seasons (default 30) with one seed. At checkpoints (every 5 seasons)
   record:
   - save size `JSON.stringify(u).length / 1e6` (MB) — budget **16 MB through 15 seasons, then +0.5 MB per season** (the permanent record of champions, award winners and stars may grow slowly; everything else must be bounded)
   - wall time per season (ms)
   - array lengths of the stores above
   - active rarity counts (3 Generational, 10–15 Legend)
   - stranded Uncommon+ players (no team, not retired) — must be 0
   - dynasty ceilings across all of `seasonHistory` (≤3 straight, ≤4/6, ≤5/10)
   - headline type counts in the last 5 seasons
2. Compare checkpoint to checkpoint. Linear growth is fine when bounded by a
   budget; super-linear growth or growth in a "capped" store is a leak.

```bash
node --input-type=module -e "
import {createUniverse} from './src/sim/generate.js';
import * as s from './src/sim/season.js';
let u = createUniverse(process.argv[1] || 'SOAK'), t = Date.now();
for (let y = 1; y <= 30; y++) {
  u = s.simulateToSeasonEnd(s.simulateToPostseason(u));
  u = s.beginOffseason(u); while (u.phase === 'Offseason') u = s.advanceOffseasonStage(u);
  u = s.startNextSeason(u);
  if (y % 5 === 0) { const mb = JSON.stringify(u).length / 1e6;
    console.log('Y' + y, mb.toFixed(1) + 'MB', ((Date.now() - t) / 5 | 0) + 'ms/season',
      'players', u.players.length, 'tx', u.transactions.length, 'records', u.records.length); t = Date.now(); }
}" SOAK
```

3. **Fatigue check** (the design half): read the headlines of seasons 25–30.
   If they read like seasons 1–5 with names swapped, history is not feeding
   the stories. Look for droughts, dynasties, rematches and record chases.

## Verdict

- **FAIL** — save over budget before 30 seasons, a capped store growing,
  a broken dynasty ceiling, stranded talent, or a crash.
- **PASS WITH CONCERNS** — bounded growth heading for the budget, per-season
  time rising noticeably, repetitive late-game headlines.
- **PASS** — all checkpoints flat or bounded, ceilings and rarity hold.
- **NOT ASSESSED** — the run did not complete; say how far it got.

Report the checkpoint table, the verdict, and for each concern the store or
function responsible (`trimArchive`, `compactUniverse`, `addNews` cap…).
