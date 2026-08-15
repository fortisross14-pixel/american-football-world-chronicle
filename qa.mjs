import {createUniverse,rarityCounts} from './src/sim/generate.js';
import {simulateWeeks,simulateToSeasonEnd,beginOffseason,advanceOffseasonStage,startNextSeason,OFFSEASON_STAGES,getAllCoaches} from './src/sim/season.js';

const longest=a=>{let best=1,run=1;for(let i=1;i<a.length;i++){run=a[i]===a[i-1]?run+1:1;best=Math.max(best,run)}return best};
const avg=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const assert=(x,msg)=>{if(!x)throw new Error(msg)};

let u=createUniverse('QA-v02-42');
let c=rarityCounts(u.players);
console.log('Initial rarity',c);
assert(c.Generational===3,'Initial generational target failed');
const gens=u.players.filter(p=>!p.retired&&p.trueRarity==='Generational');
console.log('Initial generational distribution',gens.map(p=>({league:p.league,age:p.age,proYear:p.proYear,collegeYear:p.collegeYear})));
assert(gens.filter(p=>p.league==='NFL').length===2,'Initial universe should begin with two NFL generational players');
assert(gens.filter(p=>p.league==='COLLEGE').length===1,'Initial universe should begin with one hidden college generational player');
assert(gens.filter(p=>p.league==='NFL').every(p=>p.proYear>=3),'Initial NFL generational stars are too rookie-biased');

// Partial simulation must be deterministic regardless of batching.
let a=createUniverse('batch-determinism'),b=createUniverse('batch-determinism');
a=simulateWeeks(a,4);for(let i=0;i<4;i++)b=simulateWeeks(b,1);
assert(JSON.stringify(a.currentGames)===JSON.stringify(b.currentGames),'1-week vs 4-week batching changed game results');
assert(a.seasonState.week===4&&b.seasonState.week===4,'Week advancement failed');
console.log('Week batching deterministic:',a.currentGames.length,'games through Week 4');

const champs=[],mvps=[],coachMoves=[];let statSnapshot;
for(let y=0;y<12;y++){
  u=simulateToSeasonEnd(u);
  assert(u.phase==='Season Complete','Season did not stop at Season Complete');
  const hist=u.seasonHistory[0];champs.push(hist.NFL.championId);mvps.push(hist.NFL.awards.mvpId);
  assert(hist.NFL.runnerUpId&&hist.NFL.finalScore&&hist.NFL.bestRecordTeamId,'Rich NFL history fields missing');
  const nfl=u.currentGames.filter(g=>g.league==='NFL'&&g.stage==='Regular Season');
  const counts={};for(const g of nfl){counts[g.homeId]=(counts[g.homeId]||0)+1;counts[g.awayId]=(counts[g.awayId]||0)+1;}
  assert(new Set(Object.values(counts)).size===1&&Object.values(counts)[0]===17,'NFL schedule is not 17 games per team');
  assert(nfl.some(g=>g.round===18),'NFL schedule does not span 18 weeks');
  if(y===0){const pts=[],pass=[],rush=[];for(const g of nfl){pts.push(g.homeScore,g.awayScore);pass.push(g.homeBox.passYards,g.awayBox.passYards);rush.push(g.homeBox.rushYards,g.awayBox.rushYards)}statSnapshot={points:avg(pts),pass:avg(pass),rush:avg(rush)};}
  u=beginOffseason(u);assert(u.phase==='Offseason','Could not enter offseason');
  for(let i=0;i<OFFSEASON_STAGES.length;i++){u=advanceOffseasonStage(u);const stageCounts=rarityCounts(u.players);assert(stageCounts.Generational===3,`Generational count drifted during offseason stage ${i+1}`);assert(stageCounts.Legend>=10,`Legend floor drifted during offseason stage ${i+1}`);}
  assert(u.phase==='Ready for Next Season','Offseason did not complete');
  const off=u.offseasonHistory[0];assert(off&&off.events,'Offseason ledger missing');assert((off.events.draft||[]).length===96,'Draft did not produce 96 picks');const nflIds=new Set(u.teams.nfl.map(t=>t.id));const nflRoleChanges=new Set((off.events.coachMarket||[]).filter(e=>e.toId&&nflIds.has(e.toId)).map(e=>`${e.toId}-${e.role}`));coachMoves.push(nflRoleChanges.size);
  c=rarityCounts(u.players);const stranded=u.players.filter(p=>!p.retired&&['Uncommon','Rare','Epic','Legend','Generational'].includes(p.trueRarity)&&!p.teamId);
  console.log(`Y${hist.year}`,hist.NFL.championId,'MVP',hist.NFL.awards.mvpId,'coach moves',coachMoves.at(-1),'rarity',c,'stranded',stranded.length);
  assert(stranded.length===0,`Stranded Uncommon+ talent in Year ${hist.year}`);
  assert(c.Generational===3&&c.Legend>=10&&c.Legend<=15,'Rarity controller drift');
  const nflCoachChanges=coachMoves.at(-1);assert(nflCoachChanges<=9,'NFL coach market is excessively chaotic');
  u=startNextSeason(u);assert(u.year===hist.year+1&&u.phase==='Regular Season'&&u.seasonState.week===0,'Next season transition failed');
}
console.log('NFL calibration',Object.fromEntries(Object.entries(statSnapshot).map(([k,v])=>[k,v.toFixed(1)])));
console.log('Longest title streak',longest(champs),'Longest MVP streak',longest(mvps),'Avg major coach moves',avg(coachMoves).toFixed(1));
assert(statSnapshot.points>=18&&statSnapshot.points<=27,'NFL scoring out of range');
assert(statSnapshot.pass>=190&&statSnapshot.pass<=270,'NFL passing out of range');
assert(statSnapshot.rush>=85&&statSnapshot.rush<=150,'NFL rushing out of range');
assert(longest(champs)<=5,'Dynasty runaway');
assert(longest(mvps)<=6,'MVP runaway');
assert(avg(coachMoves)>=2&&avg(coachMoves)<=10,'Coach market movement is outside target range');
assert(getAllCoaches(u).filter(s=>!s.currentTeamId).length>=0,'Coach database unavailable');
console.log('QA PASS');
