// ─────────────────────────────────────────────────────────────────────────────
// Chronicle layer (v0.9): the systems that make players and seasons memorable.
//   • traits        – 0-2 visible traits per player with real engine effects
//   • season form   – yearly swing on top of the scripted career curve
//   • injuries      – in-season injuries; backups actually play
//   • season grades – A+ … F per season row, so good and bad years read at a glance
//   • Pro Bowl      – conference all-star selections
//   • record book   – single-season & career records, in-season record chases, milestones
//   • rivalries     – team and QB head-to-head ledgers with a "heat" score
//   • draft picks   – real, tradeable pick assets
// ─────────────────────────────────────────────────────────────────────────────
import { RARITIES, developmentOverall, ensureDevelopmentProfile } from './generate.js';
import { hashSeed, makeRng } from './rng.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rank=r=>Math.max(0,RARITIES.indexOf(r));
const allTeams=u=>[...u.teams.nfl,...u.teams.ufl,...u.teams.college];
const teamOf=(u,id)=>allTeams(u).find(t=>t.id===id);
const DEF=new Set(['EDGE','DT','LB','CB','S']);

// ── Traits ──────────────────────────────────────────────────────────────────
export const TRAITS={
  'Clutch':          {desc:'Raises his level with the game on the line in the fourth quarter.',pos:['QB','WR','TE','K']},
  'Big-Game':        {desc:'Plays his best football in the playoffs.',pos:['QB','HB','WR','TE','EDGE','CB','S','LB','DT']},
  'Gunslinger':      {desc:'Throws into tight windows: more big plays, more interceptions.',pos:['QB']},
  'Field General':   {desc:'Surgical and accurate; moves the chains.',pos:['QB']},
  'Scrambler':       {desc:'Extends plays and runs for yards when the pocket breaks down.',pos:['QB']},
  'Workhorse':       {desc:'Handles a heavy share of the carries.',pos:['HB']},
  'Home-Run Hitter': {desc:'Any carry can go the distance.',pos:['HB']},
  'Sure Hands':      {desc:'Quarterbacks trust him: a bigger share of targets.',pos:['WR','TE','HB']},
  'Deep Threat':     {desc:'Stretches the field vertically.',pos:['WR','TE']},
  'Edge Terror':     {desc:'A relentless pass rusher who finishes sacks.',pos:['EDGE','DT','LB']},
  'Ball Hawk':       {desc:'Has a nose for the football: more interceptions.',pos:['CB','S','LB']},
  'Iron Man':        {desc:'Rarely misses a game.',pos:null},
  'Injury Prone':    {desc:'Spends too much time in the trainer\'s room.',pos:null}
};
export function ensureTraits(p){
  if(p.traitsVersion===1&&Array.isArray(p.traits))return p;
  const r=makeRng(hashSeed(`traits-${p.id}-${p.legacyName||p.name}`)),tier=rank(p.trueRarity);
  const count=tier>=3?2:tier===2?(r.bool(.6)?2:1):tier===1?(r.bool(.55)?1:0):(r.bool(.3)?1:0);
  const pool=Object.entries(TRAITS).filter(([k,v])=>(!v.pos||v.pos.includes(p.position))&&k!=='Iron Man'&&k!=='Injury Prone').map(([k])=>k);
  const traits=[];
  for(let i=0;i<count&&pool.length;i++){const k=pool.splice(Math.floor(r()*pool.length),1)[0];traits.push(k);}
  const dur=r();if(dur<.07)traits.push('Iron Man');else if(dur>.93)traits.push('Injury Prone');
  p.traits=traits;p.traitsVersion=1;return p;
}
export const hasTrait=(p,t)=>!!p?.traits?.includes(t);

// ── Season form ─────────────────────────────────────────────────────────────
const FORM_SD={'Volatile Star':3.4,'Early Meteor':2.4,'Short Fuse':2.4,'Iron Career':1.3,'Sustainable Prime':1.7,'Late Bloomer':2.1,'Slow Burn':1.9,'Classic Arc':2.0};
export function applySeasonForm(u,rng){
  for(const p of u.players){
    if(p.retired)continue;
    ensureDevelopmentProfile(p);
    const college=p.league==='COLLEGE',base=college?developmentOverall(p,'COLLEGE',p.collegeYear||1):developmentOverall(p,'PRO',Math.min(p.careerYears||14,(p.proYear||0)+1));
    let delta=rng.normal(0,(FORM_SD[p.developmentPath]||2)*(college?.7:1)),tag=null;
    if(!college){
      const pro=(p.proYear||0)+1;
      if(pro<=3&&rng.bool(.07)){delta+=rng.range(3,6);tag='Breakout';}
      else if(pro>=4&&rng.bool(.045)){delta-=rng.range(3,6);tag='Slump';}
      if(p.contract?.years===1&&!tag){delta+=1;tag='Contract year';}
    }
    delta=Math.round(clamp(delta,-7,7));
    if(!tag)tag=delta>=4?'Hot':delta<=-4?'Cold':null;
    p.form={year:u.year,delta,tag,base};
    p.overall=clamp(base+delta,40,99);
    p.peakOverall=Math.max(p.peakOverall||p.overall,p.overall);
  }
}

// ── Injuries ────────────────────────────────────────────────────────────────
const INJ_TYPES=[[1,['Ankle sprain','Hamstring tightness','Shoulder stinger','Concussion protocol','Hip pointer']],[3,['High ankle sprain','Hamstring strain','Rib injury','Knee sprain','Groin strain']],[7,['Broken hand','MCL sprain','Shoulder separation','Turf toe']],[99,['Torn ACL','Torn Achilles','Broken leg','Lisfranc injury']]];
const POS_INJ={HB:1.45,FB:1.2,WR:1.1,TE:1.1,LB:1.1,QB:.75,K:.15,P:.1,CB:1.05,S:1.05,EDGE:1.05,DT:1.0,OT:.95,OG:.95,C:.9};
export const isInjured=p=>!!(p?.injury&&p.injury.weeks>0);
export function rollInjuries(u,rng,game,week,addNews){
  const base=game.league==='NFL'?.0085:.0075;
  for(const id of Object.keys(game.playerStats||{})){
    const p=u.players.find(x=>x.id===id);if(!p||p.retired||isInjured(p))continue;
    let pr=base*(POS_INJ[p.position]||1)*(p.age>=31?1.3:1);if(hasTrait(p,'Iron Man'))pr*=.35;if(hasTrait(p,'Injury Prone'))pr*=2.2;
    if(!rng.bool(pr))continue;
    const weeks=rng.weighted([[1,30],[2,22],[3,14],[4,10],[6,9],[8,7],[12,5],[99,3]]);
    const types=INJ_TYPES.find(([w])=>weeks<=w)[1],type=types[Math.floor(rng()*types.length)];
    p.injury={weeks,type,year:u.year,week,seasonEnding:weeks>=99};
    p.currentSeason=p.currentSeason||{};p.currentSeason.injuries=(p.currentSeason.injuries||0)+1;
    u.injuryLog=u.injuryLog||[];u.injuryLog.unshift({year:u.year,week,playerId:p.id,teamId:p.teamId,league:game.league,weeks,type});u.injuryLog=u.injuryLog.slice(0,400);
    const star=rank(p.trueRarity)>=3||(p.position==='QB'&&rank(p.trueRarity)>=2);
    if(game.league==='NFL'&&star&&weeks>=3&&addNews){const t=teamOf(u,p.teamId);addNews(u,'INJURY',weeks>=99?86:70,`${p.name} ${weeks>=99?'out for the season':`out ${weeks} weeks`}`,`${t?.name||'His team'} loses its ${p.trueRarity} ${p.position} to a ${type.toLowerCase()}${weeks>=99?'. His season is over.':'.'}`,p.teamId,p.id);}
  }
}
// Called after a week's games. Injuries suffered this week start counting next week.
export function tickInjuries(u,week){
  for(const p of u.players){if(!isInjured(p))continue;if(p.injury.week===week&&p.injury.year===u.year)continue;p.injury.weeks--;if(p.currentSeason)p.currentSeason.missed=(p.currentSeason.missed||0)+1;if(p.injury.weeks<=0)p.injury=null;}
}
export function clearInjuries(u){for(const p of u.players)if(p.injury)p.injury=null;}

// ── Season grades ───────────────────────────────────────────────────────────
const GRADE_LABEL={'A+':'Elite season','A':'Pro Bowl level','B':'Strong starter','C':'Solid','D':'Below par','F':'Down year','INJ':'Injury-shortened'};
export const gradeLabel=g=>GRADE_LABEL[g]||'—';
export function gradeSeasonRows(u,year,productionFromStats){
  const fullSeason={NFL:17,UFL:10,COLLEGE:12};
  for(const league of ['NFL','UFL','COLLEGE']){
    const byPos={};
    for(const p of u.players){const row=(p.stats?.seasons||[]).find(s=>s.year===year&&s.league===league);if(!row)continue;(byPos[p.position]=byPos[p.position]||[]).push({p,row});}
    for(const [pos,list] of Object.entries(byPos)){
      const scored=list.map(x=>({...x,score:['OT','OG','C','K','P','FB'].includes(pos)?(x.row.overall||x.p.overall||0)*(Math.min(1,(x.row.games||0)/(fullSeason[league]*.6))):productionFromStats(pos,x.row)+(x.row.overall||0)*.25})).sort((a,b)=>b.score-a.score);
      const pool=scored.filter(x=>(x.row.games||0)>0),n=Math.max(1,pool.length);
      scored.forEach(x=>{
        const i=pool.indexOf(x),pct=i<0?0:1-i/n;
        if(!(x.row.games>0)){x.row.grade=null;x.row.gradePct=null;return;}
        x.row.gradePct=Math.round(pct*100);
        const missed=(x.row.missed||0),short=(x.row.games||0)<fullSeason[league]*.55&&missed>=3;
        x.row.grade=short?'INJ':i===0||pct>=.96?'A+':pct>=.88?'A':pct>=.70?'B':pct>=.45?'C':pct>=.22?'D':'F';
      });
    }
  }
}

// ── Pro Bowl ────────────────────────────────────────────────────────────────
const PRO_BOWL_SLOTS={QB:3,HB:2,WR:4,TE:2,OT:2,OG:2,C:1,EDGE:3,DT:2,LB:3,CB:3,S:2,K:1,P:1};
export function pickProBowl(u,scoreFn){
  const out=[];
  for(const conf of ['AFC','NFC']){
    const ids=new Set(u.teams.nfl.filter(t=>t.conference===conf).map(t=>t.id));
    for(const [pos,n] of Object.entries(PRO_BOWL_SLOTS)){
      const rows=u.players.filter(p=>!p.retired&&p.league==='NFL'&&p.position===pos&&ids.has(p.teamId)&&p.currentSeason?.games).sort((a,b)=>scoreFn(b)-scoreFn(a)).slice(0,n);
      for(const p of rows){p.awards.push({year:u.year,name:'Pro Bowl',league:'NFL',type:'PROBOWL',position:pos,conference:conf});out.push(p.id);}
    }
  }
  return out;
}
export const PRO_BOWL_TOTAL=Object.values(PRO_BOWL_SLOTS).reduce((a,b)=>a+b,0)*2;

// ── Record book & milestones ────────────────────────────────────────────────
export const RECORD_CATS=[
  {key:'passYards',label:'Passing yards',pos:['QB']},{key:'passTD',label:'Passing TD',pos:['QB']},
  {key:'rushYards',label:'Rushing yards'},{key:'rushTD',label:'Rushing TD'},
  {key:'recYards',label:'Receiving yards'},{key:'recTD',label:'Receiving TD'},
  {key:'sacks',label:'Sacks'},{key:'defInterceptions',label:'Interceptions (def)'}
];
const MILESTONES={passYards:[20000,30000,40000,50000,60000,70000],passTD:[150,250,350,450,550],rushYards:[5000,8000,10000,12000,15000],rushTD:[50,75,100,125],recYards:[5000,8000,10000,12000,15000],recTD:[50,75,100,125],sacks:[50,75,100,125,150],defInterceptions:[25,40,50,60]};
export function seasonRecords(u,league='NFL',key,limit=10,beforeYear=Infinity){
  const rows=[];for(const p of u.players)for(const s of p.stats?.seasons||[])if(s.league===league&&s.year<beforeYear&&(s[key]||0)>0)rows.push({playerId:p.id,teamId:s.teamId,year:s.year,value:s[key]});
  return rows.sort((a,b)=>b.value-a.value||a.year-b.year).slice(0,limit);
}
export function careerTotal(p,league,key,upToYear=Infinity){return (p.stats?.seasons||[]).filter(s=>s.league===league&&s.year<=upToYear).reduce((t,s)=>t+(s[key]||0),0);}
export function careerRecords(u,league='NFL',key,limit=10){
  return u.players.map(p=>({playerId:p.id,value:careerTotal(p,league,key),retired:!!p.retired,teamId:p.teamId})).filter(r=>r.value>0).sort((a,b)=>b.value-a.value).slice(0,limit);
}
// In-season: who is on pace for a single-season record?
export function recordChases(u,league='NFL'){
  const week=u.seasonState?.week||0;if(u.phase!=='Regular Season'||week<6)return [];
  const out=[];
  for(const c of RECORD_CATS){
    const rec=seasonRecords(u,league,c.key,1)[0];if(!rec)continue;
    for(const p of u.players){if(p.retired||p.league!==league)continue;const v=p.currentSeason?.[c.key]||0;if(!v)continue;const pace=Math.round(v/week*18);if(pace>=rec.value*.97)out.push({playerId:p.id,cat:c.label,key:c.key,value:v,pace,record:rec.value,holderId:rec.playerId,holderYear:rec.year});}
  }
  return out.sort((a,b)=>b.pace/b.record-a.pace/a.record).slice(0,6);
}
// Called right after a season is archived.
export function seasonRecordAndMilestoneNews(u,year,addNews,findName){
  for(const league of ['NFL']){
    for(const c of RECORD_CATS){
      const prev=seasonRecords(u,league,c.key,1,year)[0],now=seasonRecords(u,league,c.key,1)[0];
      if(prev&&now&&now.year===year&&now.value>prev.value){const p=u.players.find(x=>x.id===now.playerId);addNews(u,'RECORD',97,`${p?.name} sets the single-season ${c.label.toLowerCase()} record`,`${now.value.toLocaleString()} breaks ${findName(prev.playerId)}'s mark of ${prev.value.toLocaleString()} from Year ${prev.year}.`,now.teamId,now.playerId);(p.legacyMoments=p.legacyMoments||[]).push({year,type:'Record',text:`Single-season ${c.label.toLowerCase()} record (${now.value.toLocaleString()})`});}
    }
    for(const p of u.players){
      if(!(p.stats?.seasons||[]).some(s=>s.year===year&&s.league===league))continue;
      for(const [key,marks] of Object.entries(MILESTONES)){
        const before=careerTotal(p,league,key,year-1),after=careerTotal(p,league,key,year);
        const crossed=marks.filter(m=>before<m&&after>=m).pop();if(!crossed)continue;
        const label=RECORD_CATS.find(c=>c.key===key)?.label||key;
        (p.legacyMoments=p.legacyMoments||[]).push({year,type:'Milestone',text:`${crossed.toLocaleString()} career ${label.toLowerCase()}`});
        if(crossed<marks[2])continue; // only landmark numbers make the news wire
        addNews(u,'MILESTONE',crossed>=marks[3]?84:72,`${p.name} reaches ${crossed.toLocaleString()} career ${label.toLowerCase()}`,`${p.position} now has ${after.toLocaleString()} for his NFL career.`,p.teamId,p.id);
      }
    }
    // All-time career leader changes hands
    for(const c of RECORD_CATS){
      const leaderNow=careerRecords(u,league,c.key,1)[0];if(!leaderNow)continue;
      const prevLeader=u.players.map(p=>({p,v:careerTotal(p,league,c.key,year-1)})).sort((a,b)=>b.v-a.v)[0];
      if(prevLeader&&prevLeader.v>0&&prevLeader.p.id!==leaderNow.playerId){const p=u.players.find(x=>x.id===leaderNow.playerId);addNews(u,'RECORD',94,`${p?.name} becomes the all-time ${c.label.toLowerCase()} leader`,`He passes ${prevLeader.p.name} (${prevLeader.v.toLocaleString()}) and now owns the career record at ${leaderNow.value.toLocaleString()}.`,p?.teamId,p?.id);}
    }
  }
}

// ── Rivalries ───────────────────────────────────────────────────────────────
const pairKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const STAGE_HEAT={'Regular Season':0,'Wild Card':5,'Divisional':6,'Conference Championship':9,'Super Bowl':13};
export function startingQB(u,game,teamId){
  let best=null,yds=-1;for(const [id,s] of Object.entries(game.playerStats||{})){if(!(s.passYards>0))continue;const p=u.players.find(x=>x.id===id);if(p&&p.position==='QB'&&p.teamId===teamId&&s.passYards>yds){best=p;yds=s.passYards;}}
  return best;
}
export function updateRivalries(u,game,year){
  if(game.league!=='NFL')return;
  u.rivalries=u.rivalries||{teams:{},qbs:{}};
  const hw=game.homeScore>game.awayScore,winnerId=hw?game.homeId:game.awayId,margin=Math.abs(game.homeScore-game.awayScore),stageHeat=STAGE_HEAT[game.stage]||0,close=margin<=7;
  const meeting={year,stage:game.stage,round:game.round,winnerId,homeId:game.homeId,awayId:game.awayId,score:`${game.homeScore}-${game.awayScore}`,gameId:game.id};
  const h=teamOf(u,game.homeId),a=teamOf(u,game.awayId),division=h&&a&&h.conference===a.conference&&h.division===a.division;
  // Team ledger
  const tk=pairKey(game.homeId,game.awayId),T=u.rivalries.teams[tk]||(u.rivalries.teams[tk]={a:tk.split('|')[0],b:tk.split('|')[1],games:0,wins:{},playoff:0,close:0,heat:0,meetings:[]});
  T.games++;T.wins[winnerId]=(T.wins[winnerId]||0)+1;if(close)T.close++;if(stageHeat)T.playoff++;
  T.heat+=(division?.8:.3)+(close?1:0)+stageHeat+(game.flags?.ot?1:0);
  T.meetings.push(meeting);T.meetings=T.meetings.filter((m,i,arr)=>m.stage!=='Regular Season'||i>=arr.length-8);T.last=meeting;
  // QB duel ledger
  const qh=startingQB(u,game,game.homeId),qa=startingQB(u,game,game.awayId);
  if(qh&&qa){
    const qk=pairKey(qh.id,qa.id),winQ=hw?qh.id:qa.id,Q=u.rivalries.qbs[qk]||(u.rivalries.qbs[qk]={a:qk.split('|')[0],b:qk.split('|')[1],games:0,wins:{},playoff:0,titleGames:0,heat:0,meetings:[]});
    const star=(rank(qh.trueRarity)+rank(qa.trueRarity))/4;
    Q.games++;Q.wins[winQ]=(Q.wins[winQ]||0)+1;if(stageHeat)Q.playoff++;if(['Conference Championship','Super Bowl'].includes(game.stage))Q.titleGames++;
    Q.heat+=(.4+(close?.8:0)+stageHeat)*(.6+star);
    Q.meetings.push({...meeting,winnerQB:winQ,qbHome:qh.id,qbAway:qa.id});Q.meetings=Q.meetings.filter((m,i,arr)=>m.stage!=='Regular Season'||i>=arr.length-8);Q.last=Q.meetings[Q.meetings.length-1];
  }
}
export function decayRivalries(u,year){
  const R=u.rivalries;if(!R)return;
  for(const T of Object.values(R.teams))T.heat=Math.round(T.heat*.82*10)/10;
  for(const [k,Q] of Object.entries(R.qbs)){Q.heat=Math.round(Q.heat*.85*10)/10;if(!Q.playoff&&Q.games<=2&&(Q.last?.year||0)<year-2)delete R.qbs[k];}
}
export function teamRivalry(u,a,b){return u.rivalries?.teams?.[pairKey(a,b)]||null;}
export function qbDuel(u,a,b){return a&&b?u.rivalries?.qbs?.[pairKey(a,b)]||null:null;}
export function hottestRivalries(u,limit=10){return Object.values(u.rivalries?.teams||{}).sort((x,y)=>y.heat-x.heat).slice(0,limit);}
export function greatestQbDuels(u,limit=10){return Object.values(u.rivalries?.qbs||{}).filter(q=>q.games>=2||q.playoff).sort((x,y)=>(y.playoff*10+y.heat)-(x.playoff*10+x.heat)).slice(0,limit);}
export function qbDuelsFor(u,playerId){return Object.values(u.rivalries?.qbs||{}).filter(q=>q.a===playerId||q.b===playerId).sort((x,y)=>(y.playoff*10+y.games)-(x.playoff*10+x.games));}
// One-line rivalry summary for previews ("Meyer leads Parker 3–1 · met in 2 Super Bowls").
// excludeGameId: when previewing a game that has already been simulated, leave its own result out (no spoilers).
function withoutGame(L,gameId,winnerKey){
  if(!L||!gameId)return L;const m=L.meetings.find(x=>x.gameId===gameId);if(!m)return L;
  const wins={...L.wins},w=m[winnerKey];wins[w]=Math.max(0,(wins[w]||0)-1);
  return {...L,wins,games:L.games-1,playoff:L.playoff-(m.stage!=='Regular Season'?1:0),meetings:L.meetings.filter(x=>x!==m)};
}
export function rivalryHeadline(u,homeId,awayId,homeQB,awayQB,nameOf,excludeGameId=null){
  const lines=[];
  const Q=withoutGame(qbDuel(u,homeQB?.id,awayQB?.id),excludeGameId,'winnerQB');
  if(Q&&Q.games){const wa=Q.wins[homeQB.id]||0,wb=Q.wins[awayQB.id]||0,sb=Q.meetings.filter(m=>m.stage==='Super Bowl').length,cc=Q.meetings.filter(m=>m.stage==='Conference Championship').length;
    lines.push(`${homeQB.name} vs ${awayQB.name}: ${wa===wb?`tied ${wa}–${wb}`:`${wa>wb?homeQB.name:awayQB.name} leads ${Math.max(wa,wb)}–${Math.min(wa,wb)}`}${sb?` · ${sb} Super Bowl${sb>1?'s':''}`:''}${cc?` · ${cc} conference title game${cc>1?'s':''}`:''}`);}
  const T=withoutGame(teamRivalry(u,homeId,awayId),excludeGameId,'winnerId');
  if(T&&T.games){const wa=T.wins[homeId]||0,wb=T.wins[awayId]||0;lines.push(`Series ${wa===wb?`tied ${wa}–${wb}`:`${nameOf(wa>wb?homeId:awayId)} lead ${Math.max(wa,wb)}–${Math.min(wa,wb)}`}${T.playoff?` · ${T.playoff} playoff meeting${T.playoff>1?'s':''}`:''}`);}
  return {lines,heat:(T?.heat||0)+(Q?.heat||0)};
}

// ── Draft pick assets ───────────────────────────────────────────────────────
export function ensureDraftPicks(u){
  u.draftPicks=u.draftPicks||[];
  const firstYear=u.phase==='Offseason'&&(u.offseasonState?.events?.draft||[]).length?u.year+1:u.year;
  for(let year=firstYear;year<=firstYear+1;year++)for(const t of u.teams.nfl)for(let round=1;round<=3;round++){
    const id=`PK-${year}-${round}-${t.id}`;if(!u.draftPicks.some(p=>p.id===id))u.draftPicks.push({id,year,round,originalTeamId:t.id,ownerId:t.id});
  }
  u.draftPicks=u.draftPicks.filter(p=>p.year>=u.year&&!p.used);
}
export const picksOwnedBy=(u,teamId)=>(u.draftPicks||[]).filter(p=>p.ownerId===teamId&&!p.used).sort((a,b)=>a.year-b.year||a.round-b.round);
export const pickLabel=(u,p)=>`Y${p.year} R${p.round}${p.originalTeamId!==p.ownerId?` (via ${teamOf(u,p.originalTeamId)?.shortId||p.originalTeamId})`:''}`;
// Move picks matching a player's value from buyer to seller. Returns the picks moved.
export function payWithPicks(u,buyerId,sellerId,rarityRank,minYear){
  const wants=rarityRank>=4?[1,2]:rarityRank===3?[1]:rarityRank===2?[2]:[3];
  const owned=picksOwnedBy(u,buyerId).filter(p=>p.year>=minYear),moved=[];
  for(const round of wants){let pk=owned.find(p=>p.round===round&&!moved.includes(p))||owned.find(p=>p.round>round&&!moved.includes(p));if(pk){pk.ownerId=sellerId;moved.push(pk);}}
  return moved;
}
