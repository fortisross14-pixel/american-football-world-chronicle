import {createUniverse,rarityCounts,prospectPublicView} from './src/sim/generate.js';
import {simulateWeeks,simulateToSeasonEnd,beginOffseason,advanceOffseasonStage,startNextSeason,OFFSEASON_STAGES,getAllCoaches,ensureUniverse} from './src/sim/season.js';

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

// Development profiles exist internally, but true development remains hidden for college prospects.
for(const p of u.players){
  assert(Number.isFinite(p.ceilingOverall),'Player development ceiling missing');
  assert(Array.isArray(p.developmentCurve)&&p.developmentCurve.length===4+(p.careerYears||0),'Player development curve missing or wrong length');
  assert(p.developmentCurve.every(x=>x.overall<=99),'Development curve exceeded 99 OVR');
}
const hiddenProspect=u.players.find(p=>p.league==='COLLEGE'&&!p.revealed);
const publicProspect=prospectPublicView(hiddenProspect);
for(const forbidden of ['trueRarity','developmentPath','developmentCurve','ceilingOverall','careerYears','potential','overall'])assert(!(forbidden in publicProspect),`Pre-draft scouting leaked ${forbidden}`);

// Team IDs must be globally unique; pre-0.2.1 college/pro collisions caused players to appear in two leagues.
const ids=[...u.teams.nfl,...u.teams.ufl,...u.teams.college].map(t=>t.id);
assert(new Set(ids).size===ids.length,'Team ID collision detected');
assert(u.teams.college.every(t=>t.id.startsWith('CFB-')),'College IDs are not namespaced');

// Migration smoke test for an old save shape.
let legacy=createUniverse('legacy-id-smoke');
for(const t of legacy.teams.college){t.id=t.id.replace(/^CFB-/,'');for(const p of legacy.players.filter(p=>p.league==='COLLEGE'&&p.teamId===`CFB-${t.id}`))p.teamId=t.id;}
legacy.meta.collegeNamespaceMigrated=false;
legacy=ensureUniverse(legacy);
assert(legacy.teams.college.every(t=>t.id.startsWith('CFB-')),'Legacy college ID migration failed');

// Partial simulation must be deterministic regardless of batching.
let a=createUniverse('batch-determinism'),b=createUniverse('batch-determinism');
a=simulateWeeks(a,4);for(let i=0;i<4;i++)b=simulateWeeks(b,1);
assert(JSON.stringify(a.currentGames)===JSON.stringify(b.currentGames),'1-week vs 4-week batching changed game results');
assert(a.seasonState.week===4&&b.seasonState.week===4,'Week advancement failed');
console.log('Week batching deterministic:',a.currentGames.length,'games through Week 4');

const champs=[],mvps=[],coachMoves=[];let statSnapshot;
for(let y=0;y<8;y++){
  u=simulateToSeasonEnd(u);
  assert(u.phase==='Season Complete','Season did not stop at Season Complete');
  const hist=u.seasonHistory[0];champs.push(hist.NFL.championId);mvps.push(hist.NFL.awards.mvpId);
  assert(hist.NFL.runnerUpId&&hist.NFL.finalScore&&hist.NFL.bestRecordTeamId,'Rich NFL history fields missing');
  const nfl=u.currentGames.filter(g=>g.league==='NFL'&&g.stage==='Regular Season');
  const counts={};for(const g of nfl){counts[g.homeId]=(counts[g.homeId]||0)+1;counts[g.awayId]=(counts[g.awayId]||0)+1;}
  assert(new Set(Object.values(counts)).size===1&&Object.values(counts)[0]===17,'NFL schedule is not 17 games per team');
  assert(nfl.some(g=>g.round===18),'NFL schedule does not span 18 weeks');
  if(y===0){
    const pts=[],pass=[],rush=[];for(const g of nfl){pts.push(g.homeScore,g.awayScore);pass.push(g.homeBox.passYards,g.awayBox.passYards);rush.push(g.homeBox.rushYards,g.awayBox.rushYards)}statSnapshot={points:avg(pts),pass:avg(pass),rush:avg(rush)};
    const nflPlayers=u.players.filter(p=>p.league==='NFL'&&!p.retired), maxStat=(list,key)=>Math.max(0,...list.map(p=>p.currentSeason?.[key]||0));
    assert(maxStat(nflPlayers,'games')===17,'NFL player logged games outside the NFL schedule');
    for(const g of u.currentGames.filter(g=>g.stage==='Regular Season'))for(const pid of Object.keys(g.playerStats||{})){const p=u.players.find(x=>x.id===pid);assert(!p||p.league===g.league,`Cross-league player stats detected in ${g.id}`);}
    const commonQB=nflPlayers.filter(p=>p.position==='QB'&&p.trueRarity==='Common');
    const commonHB=nflPlayers.filter(p=>p.position==='HB'&&p.trueRarity==='Common');
    const commonRec=nflPlayers.filter(p=>['WR','TE'].includes(p.position)&&p.trueRarity==='Common');
    const commonRush=nflPlayers.filter(p=>['EDGE','DT','LB'].includes(p.position)&&p.trueRarity==='Common');
    assert(maxStat(commonQB,'passYards')<=4100,'Common QB production ceiling failed');
    assert(maxStat(commonQB,'passTD')<=25,'Common QB touchdown ceiling failed');
    assert(maxStat(commonHB,'rushYards')<=1250,'Common HB rushing ceiling failed');
    assert(maxStat(commonRec,'recYards')<=1250,'Common receiver production ceiling failed');
    assert(maxStat(commonRush,'sacks')<=12,'Common pass-rusher sack ceiling failed');
    const passLeaders=[...nflPlayers.filter(p=>p.position==='QB')].sort((a,b)=>(b.currentSeason?.passYards||0)-(a.currentSeason?.passYards||0)).slice(0,8);
    assert(passLeaders.filter(p=>['Rare','Epic','Legend','Generational'].includes(p.trueRarity)).length>=6,'Passing leaderboard is not sufficiently talent-driven');
    console.log('Talent ceilings',{commonQB:maxStat(commonQB,'passYards'),commonQBTD:maxStat(commonQB,'passTD'),commonHB:maxStat(commonHB,'rushYards'),commonRec:maxStat(commonRec,'recYards'),commonSacks:maxStat(commonRush,'sacks')});
    const yhist=(u.statHistory||[]).find(x=>x.year===u.year&&x.league==='NFL');
    assert(yhist?.categories?.['Passing Yards']?.leader,'Year-by-year passing leader missing');
    assert(yhist?.categories?.['Passing Yards']?.runnerUp,'Year-by-year passing runner-up missing');
  }
  u=beginOffseason(u);assert(u.phase==='Offseason','Could not enter offseason');
  for(let i=0;i<OFFSEASON_STAGES.length;i++){u=advanceOffseasonStage(u);const stageCounts=rarityCounts(u.players);assert(stageCounts.Generational===3,`Generational count drifted during offseason stage ${i+1}`);assert(stageCounts.Legend>=10,`Legend floor drifted during offseason stage ${i+1}`);}
  assert(u.phase==='Ready for Next Season','Offseason did not complete');
  const off=u.offseasonHistory[0];assert(off&&off.events,'Offseason ledger missing');assert((off.events.draft||[]).length===96,'Draft did not produce 96 picks');
  assert(off.events.draft.every(r=>r.actualRarity&&r.developmentPath&&r.careerYears&&r.ceilingOverall),'Draft God View reveal is incomplete');
  const drafted=u.players.find(p=>p.id===off.events.draft[0].playerId);assert(drafted?.revealed&&drafted.developmentCurve?.length,'Drafted player did not retain revealed development curve');
  const activeNFL=u.players.filter(p=>!p.retired&&p.league==='NFL'&&p.teamId);assert(activeNFL.every(p=>Number.isFinite(p.contract?.annual)&&Number.isFinite(p.contract?.years)),'Active NFL contract salary/duration missing');
  const nflIds=new Set(u.teams.nfl.map(t=>t.id));const nflRoleChanges=new Set((off.events.coachMarket||[]).filter(e=>e.toId&&nflIds.has(e.toId)).map(e=>`${e.toId}-${e.role}`));coachMoves.push(nflRoleChanges.size);
  c=rarityCounts(u.players);const stranded=u.players.filter(p=>!p.retired&&['Uncommon','Rare','Epic','Legend','Generational'].includes(p.trueRarity)&&!p.teamId);
  console.log(`Y${hist.year}`,hist.NFL.championId,'MVP',hist.NFL.awards.mvpId,'coach moves',coachMoves[coachMoves.length-1],'rarity',c,'stranded',stranded.length);
  assert(stranded.length===0,`Stranded Uncommon+ talent in Year ${hist.year}`);
  assert(c.Generational===3&&c.Legend>=10&&c.Legend<=15,'Rarity controller drift');
  const nflCoachChanges=coachMoves[coachMoves.length-1];assert(nflCoachChanges<=9,'NFL coach market is excessively chaotic');
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
