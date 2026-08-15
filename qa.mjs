import {createUniverse,rarityCounts} from './src/sim/generate.js';
import {simulateYear} from './src/sim/season.js';

const longest=(arr)=>{let best=1,run=1;for(let i=1;i<arr.length;i++){run=arr[i]===arr[i-1]?run+1:1;best=Math.max(best,run)}return best};
const avg=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);

let u=createUniverse('QA-chronicle-42');
const initial=rarityCounts(u.players);
console.log('Initial active players',u.players.filter(p=>!p.retired).length,initial);
if(initial.Generational!==3) throw new Error('Initial generational target failed');
if(initial.Legend<10||initial.Legend>15) throw new Error('Initial legend target failed');

// Better programs must have a materially higher elite-talent spawn rate over multiple seeds.
let topElite=0,topN=0,otherElite=0,otherN=0;
for(let s=0;s<12;s++){
  const x=createUniverse(`prestige-QA-${s}`); const programs=[...x.teams.college].sort((a,b)=>b.prestige-a.prestige); const top=new Set(programs.slice(0,20).map(t=>t.id));
  for(const p of x.players.filter(p=>p.league==='COLLEGE')){const elite=['Rare','Epic','Legend','Generational'].includes(p.trueRarity);if(top.has(p.teamId)){topN++;if(elite)topElite++}else{otherN++;if(elite)otherElite++}}
}
console.log('Prestige elite spawn ratio',(topElite/topN/(otherElite/otherN)).toFixed(2));
if(topElite/topN < (otherElite/otherN)*1.45) throw new Error('College prestige is not influencing elite spawn odds enough');

const champs=[],mvps=[]; let maxStranded=0; let statSnapshot=null;
for(let i=0;i<12;i++){
  u=simulateYear(u);
  const y=u.seasonHistory[0]; champs.push(y.nflChampionId);mvps.push(y.nflMvpId);
  const counts=rarityCounts(u.players);
  const stranded=u.players.filter(p=>!p.retired&&['Uncommon','Rare','Epic','Legend','Generational'].includes(p.trueRarity)&&!p.teamId);
  maxStranded=Math.max(maxStranded,stranded.length);
  const nfl=u.currentGames.filter(g=>g.league==='NFL'&&g.stage==='Regular Season');
  const teamGames={}; for(const g of nfl){teamGames[g.homeId]=(teamGames[g.homeId]||0)+1;teamGames[g.awayId]=(teamGames[g.awayId]||0)+1;}
  if(new Set(Object.values(teamGames)).size!==1 || Object.values(teamGames)[0]!==17) throw new Error('NFL schedule is not 17 games per team');
  if(!nfl.some(g=>g.round===18)) throw new Error('NFL schedule is not using an 18-week calendar');
  if(i===0){const pts=[],pass=[],rush=[];for(const g of nfl){pts.push(g.homeScore,g.awayScore);pass.push(g.homeBox.passYards,g.awayBox.passYards);rush.push(g.homeBox.rushYards,g.awayBox.rushYards)}statSnapshot={points:avg(pts),pass:avg(pass),rush:avg(rush)};}
  console.log(`Year ${y.year}`,'champ',y.nflChampionId,'MVP',y.nflMvpId,'rarities',counts,'stranded+',stranded.length);
  if(stranded.length) throw new Error(`Stranded Uncommon+ talent in Year ${y.year}`);
  if(counts.Generational!==3||counts.Legend<10||counts.Legend>15) throw new Error(`Rarity controller drift in Year ${y.year}`);
}
console.log('NFL stat calibration',Object.fromEntries(Object.entries(statSnapshot).map(([k,v])=>[k,v.toFixed(1)])));
if(statSnapshot.points<18||statSnapshot.points>27) throw new Error('NFL scoring calibration out of range');
if(statSnapshot.pass<190||statSnapshot.pass>260) throw new Error('NFL passing calibration out of range');
if(statSnapshot.rush<85||statSnapshot.rush>145) throw new Error('NFL rushing calibration out of range');
console.log('Longest champion streak',longest(champs));
console.log('Longest MVP streak',longest(mvps));
console.log('Blockbuster trades retained',u.transactions.filter(t=>t.type==='Trade').length);
if(longest(champs)>5) throw new Error('Dynasty runaway: >5 straight titles');
if(longest(mvps)>6) throw new Error('MVP runaway: >6 straight MVPs');
if(u.transactions.filter(t=>t.type==='Trade').length<8) throw new Error('Blockbuster market too quiet across 12 years');
console.log('QA PASS');
