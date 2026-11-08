---
name: balance-check
description: "Find balance outliers, broken progressions and runaway outcomes in this football universe — rarity economy, contracts and free agency, title distribution, dynasties, awards, stat bands. Use for 'check game balance', after changing any tuning number in src/sim, or when something feels too common or too rare."
argument-hint: "[market|titles|rarity|awards|stats|all]"
---

# Balance check (football chronicle)

Adapted from the `balance-check` skill in
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT),
rewritten for this repo's headless simulation.

## Rule zero: no data, no verdict

Balance claims come from simulated seasons, never from reading constants. If you
did not run the sim for a domain, that domain is **NOT ASSESSED — NO DATA**.
A report with no "could not run" state produces false clean passes.

## 1. Pick the domain

| Domain | Tuning lives in | Targets |
|---|---|---|
| **Rarity economy** | `src/sim/generate.js` (`TARGETS`), `replenishFreshmen` in `season.js` | Exactly 3 Generational, 10–15 Legend active (QA-guarded) |
| **Market** | `reSignChance`, `freeAgentAsk`, `marqueeFreeAgency`, `tradeMarket`, `tradeDeadline` | 1–4 Epic+ free agents/yr, ≥8 marquee signings per 8 yrs, 16+ offseason trades, ≤3 trades per team |
| **Titles & dynasties** | `src/sim/legacy.js` (`DYNASTY_LIMITS`), match engine strength | ≤3 straight, ≤4 in 6, ≤5 in 10 (hard). Favourite wins ~15–25% of the time |
| **Awards** | `pickPlayerAward` (MVP repeat factor `.80^wins`) | Longest MVP streak ≤ 6 (QA), MVP mostly QBs but not only |
| **Stat bands** | `src/sim/match.js` | NFL points 18–27, pass 190–270, rush 85–150 per team-game (QA) |
| **Story volume** | `addNews` importance, `stories.js` | Each headline type appears at the rate its rarity deserves |

## 2. Measure

Run at least two seeds and 10+ seasons. Template:

```bash
node --input-type=module -e "
import {createUniverse} from './src/sim/generate.js';
import * as s from './src/sim/season.js';
for (const seed of [7, 21]) {
  let u = createUniverse(seed); const champs = [], fav = [];
  for (let y = 0; y < 12; y++) {
    u = s.simulateToSeasonEnd(s.simulateToPostseason(u));
    const h = u.seasonHistory[0]; champs.push(h.NFL.championId); fav.push(h.outlook?.NFL?.championRank);
    u = s.beginOffseason(u); while (u.phase === 'Offseason') u = s.advanceOffseasonStage(u);
    const fa = u.offseasonHistory[0].events.freeAgency.filter(e => e.type === 'Marquee Signing');
    console.log(seed, 'Y' + h.year, h.NFL.championId, 'champ preseason rank', fav.at(-1), 'marquee', fa.length);
    u = s.startNextSeason(u);
  }
}"
```

Then `npm run qa` — it is the contract for rarity, stat bands, market volume
and dynasty ceilings. A balance change that fails QA is not done.

## 3. Checks

- **Outliers**: any value outside its target row above.
- **Degenerate outcomes**: one team in every final; the preseason favourite
  winning far more than its odds imply; the same player in every headline.
- **Dead zones**: offseasons where nothing notable moves; seasons with no
  upsets or record chases.
- **Runaway loops**: winning → cap room → stars → winning with no brake
  (the brakes are cap churn, coach poaching, MVP fatigue and the hard
  dynasty ceiling).
- **Rarity of superlatives**: Generational events should feel rare in the
  news, not weekly.

## 4. Report

```
## Balance Check: [domain]
Seeds / seasons run: [...]
### Health: NOT ASSESSED / HEALTHY / CONCERNS / CRITICAL
### Outliers
| Value | Target | Measured | Issue |
### Degenerate outcomes
### Recommendations
| Priority | Change (file:function) | Expected effect | QA guard |
```

Worst finding wins: CRITICAL (degenerate outcome or broken ceiling) >
CONCERNS (tunable outliers) > NOT ASSESSED > HEALTHY.

## 5. Fix & verify

Change one knob at a time, re-run the same seeds, compare before/after in a
table, and add a QA assertion if the target is a rule the game must keep.
