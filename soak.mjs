// Long-run soak test (see .claude/skills/soak-test). Simulates many seasons headless and
// checks that saves stay inside the 16MB budget, rarity holds, talent is never stranded and
// the dynasty ceilings hold for the whole history. Slow (a few minutes): not part of CI.
//   npm run soak            # 30 seasons
//   npm run soak -- 40 SEED # custom length / seed
import { createUniverse, rarityCounts } from './src/sim/generate.js';
import { simulateToSeasonEnd, simulateToPostseason, beginOffseason, advanceOffseasonStage, startNextSeason } from './src/sim/season.js';

const seasons = Number(process.argv[2] || 30), seed = process.argv[3] || 'SOAK';
const BUDGET_MB = 16;
const assert = (x, msg) => { if (!x) { console.error('SOAK FAIL:', msg); process.exit(1); } };

let u = createUniverse(seed), t = Date.now();
for (let y = 1; y <= seasons; y++) {
  u = simulateToSeasonEnd(simulateToPostseason(u));
  u = beginOffseason(u); while (u.phase === 'Offseason') u = advanceOffseasonStage(u);
  u = startNextSeason(u);
  if (y % 5 === 0 || y === seasons) {
    const mb = JSON.stringify(u).length / 1e6, c = rarityCounts(u.players);
    const stranded = u.players.filter(p => !p.retired && p.trueRarity !== 'Common' && !p.teamId).length;
    console.log(`Y${y}`, `${mb.toFixed(1)}MB`, `${Math.round((Date.now() - t) / 5)}ms/season`,
      'players', u.players.length, 'retired', u.players.filter(p => p.retired).length, 'archived', u.meta.prunedPlayers || 0,
      'gen', c.Generational, 'leg', c.Legend, 'stranded', stranded);
    t = Date.now();
    assert(mb < BUDGET_MB, `save is ${mb.toFixed(1)}MB after ${y} seasons (budget ${BUDGET_MB}MB)`);
    assert(c.Generational === 3 && c.Legend >= 10 && c.Legend <= 15, 'rarity drift');
    assert(stranded === 0, 'stranded talent');
  }
}
for (const league of ['NFL', 'COLLEGE', 'UFL']) {
  const ys = [...u.seasonHistory].sort((a, b) => a.year - b.year).map(s => s[league]?.championId);
  ys.forEach((id, i) => { const w = n => ys.slice(Math.max(0, i - n + 1), i + 1).filter(x => x === id).length; assert(w(4) <= 3 && w(6) <= 4 && w(10) <= 5, `${league} dynasty ceiling broken`); });
}
console.log('SOAK PASS');
