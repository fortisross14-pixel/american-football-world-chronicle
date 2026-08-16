import { RARITIES, RARITY_META } from './generate.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const avg=(arr,f=x=>x)=>arr.length?arr.reduce((s,x)=>s+f(x),0)/arr.length:55;
const top=(arr,n=1)=>[...arr].sort((a,b)=>b.overall-a.overall).slice(0,n);
const rarityIndex=r=>Math.max(0,RARITIES.indexOf(r));
const rarityBonus=r=>({Common:0,Uncommon:2,Rare:5,Epic:10,Legend:17,Generational:26})[r]||0;
const get=(roster,pos)=>roster.filter(p=>p.position===pos && !p.retired);
const nominalOverall=r=>RARITY_META[r]?.score||58;

function coachFactor(team,side){
  const hc=team.hc?.overall||60, coord=(side==='offense'?team.oc?.overall:team.dc?.overall)||60;
  return (hc-60)*.22+(coord-60)*.38;
}

function coachProduction(team,side){
  const hc=team.hc?.overall||60, coord=(side==='offense'?team.oc?.overall:team.dc?.overall)||60;
  return (hc-60)*.20+(coord-60)*.34;
}

function playerTierFactor(p){
  if(!p)return .6;
  const tier=rarityIndex(p.trueRarity);
  return clamp(.72+tier*.10+(p.overall-nominalOverall(p.trueRarity))*.012,.62,1.34);
}

export function teamUnitRatings(team, roster){
  const qb=top(get(roster,'QB'))[0]; const wr=top(get(roster,'WR'),3); const hb=top(get(roster,'HB'),2); const te=top(get(roster,'TE'))[0];
  const ol=[...get(roster,'OT'),...get(roster,'OG'),...get(roster,'C')];
  const edge=get(roster,'EDGE'), dt=get(roster,'DT'), lb=get(roster,'LB'), cb=get(roster,'CB'), s=get(roster,'S');
  // Football is star-driven: QB/HB and the best matchup players carry more weight than the anonymous unit baseline.
  const passOff=((qb?.overall||45)*.54+avg(wr,p=>p.overall)*.18+(te?.overall||50)*.06+avg(ol,p=>p.overall)*.14)/.92+coachFactor(team,'offense')*.58;
  const rushOff=(avg(hb,p=>p.overall)*.45+avg(ol,p=>p.overall)*.30+(qb?.overall||48)*.04)/.79+coachFactor(team,'offense')*.62;
  const passDef=(avg(cb,p=>p.overall)*.29+avg(s,p=>p.overall)*.16+avg(edge,p=>p.overall)*.24+avg(lb,p=>p.overall)*.12)/.81+coachFactor(team,'defense')*.72;
  const rushDef=(avg(dt,p=>p.overall)*.25+avg(lb,p=>p.overall)*.27+avg(edge,p=>p.overall)*.15+avg(s,p=>p.overall)*.09)/.76+coachFactor(team,'defense')*.72;
  return {passOff,rushOff,passDef,rushDef,qb,wr,hb,te,ol,edge,dt,lb,cb,s};
}

function superstarPassingAdjustment(off,def){
  let adj=0;
  if(off.qb){
    const qbBonus=rarityBonus(off.qb.trueRarity);
    const support=(avg(off.wr,p=>p.overall)+(off.te?.overall||55)+avg(off.ol,p=>p.overall))/3;
    const supportScale=clamp((support-52)/35,.28,1.15);
    adj+=qbBonus*.72*supportScale;
  }
  for(const wr of off.wr){
    let bonus=rarityBonus(wr.trueRarity)*.52;
    const cover=top(def.cb)[0];
    if(cover){
      const suppression={Common:0,Uncommon:.08,Rare:.22,Epic:.42,Legend:.72,Generational:1.0}[cover.trueRarity]||0;
      bonus*=1-suppression;
      if(cover.trueRarity==='Generational') adj-=3;
    }
    adj+=bonus;
  }
  if(off.te) adj+=rarityBonus(off.te.trueRarity)*.22;
  for(const e of top(def.edge,2)) adj-=rarityBonus(e.trueRarity)*.30;
  return adj;
}

function superstarRushAdjustment(off,def){
  let adj=0;
  for(const back of off.hb) adj+=rarityBonus(back.trueRarity)*.55;
  for(const lineman of off.ol) adj+=rarityBonus(lineman.trueRarity)*.10;
  for(const d of [...top(def.dt,2),...top(def.lb,2)]) adj-=rarityBonus(d.trueRarity)*.30;
  return adj;
}

function qbPassingExpectation(team,off,def,league){
  const qb=off.qb;
  if(!qb)return 115;
  // Rarity/OVR establishes the player's production band. Supporting cast and coaching can help,
  // but they cannot turn a Common QB into a 5,000-yard passer.
  const tierBase={Common:175,Uncommon:200,Rare:222,Epic:247,Legend:270,Generational:292}[qb.trueRarity]||170;
  const skill=tierBase+(qb.overall-nominalOverall(qb.trueRarity))*1.8;
  const support=(avg(off.wr,p=>p.overall)-58)*.55+((off.te?.overall||55)-58)*.18+(avg(off.ol,p=>p.overall)-58)*.35;
  const coaching=coachProduction(team,'offense');
  const defense=(def.passDef-65)*1.00;
  const leagueAdj=league==='COLLEGE'?10:league==='UFL'?-5:0;
  return skill+support+coaching-defense+superstarPassingAdjustment(off,def)+leagueAdj;
}

function passingCeiling(qb,positiveSupport=0){
  const base={Common:315,Uncommon:360,Rare:420,Epic:490,Legend:555,Generational:610}[qb?.trueRarity]||280;
  return base+clamp(positiveSupport,0,32);
}

function rushingExpectation(team,off,def,league){
  const hb=off.hb[0];
  const runner=hb?.overall||52;
  const skill=92+(runner-58)*1.35;
  const support=(avg(off.ol,p=>p.overall)-58)*.55+((off.qb?.overall||55)-58)*.09;
  const coaching=coachProduction(team,'offense')*.65;
  const defense=(def.rushDef-65)*.86;
  const leagueAdj=league==='COLLEGE'?24:league==='UFL'?2:0;
  return skill+support+coaching-defense+superstarRushAdjustment(off,def)+leagueAdj;
}

function offensiveEfficiency(team,off){
  const skillPlayers=[off.qb,...off.hb.slice(0,1),...off.wr.slice(0,2),off.te].filter(Boolean);
  const skillAvg=avg(skillPlayers,p=>p.overall);
  const qbTier=off.qb?rarityIndex(off.qb.trueRarity):0;
  return clamp(.76+(skillAvg-58)*.006+qbTier*.025+coachProduction(team,'offense')*.006,.68,1.18);
}

function touchdownCount(rng,totalYards,turnovers,efficiency,eliteBonus){
  const base=clamp((totalYards-45)/94,0.20,6.2)*efficiency;
  const eff=base-turnovers*.30+eliteBonus;
  const floor=Math.max(0,Math.floor(eff));
  return clamp(floor+(rng.bool(eff-floor)?1:0)+(rng.bool(.035)?1:0),0,8);
}

function fieldGoals(rng,totalYards,tds,turnovers){
  const chances=clamp((totalYards/160)-tds*.18-turnovers*.07,.10,3.4);
  const n=Math.floor(chances)+(rng.bool(chances%1)?1:0);
  return clamp(n,0,4);
}

function chooseScorer(rng,candidates,weightFn){
  const valid=candidates.filter(Boolean);
  if(!valid.length)return null;
  return rng.weighted(valid.map(p=>[p,Math.max(.1,weightFn(p))]));
}

function impactWeight(p,kind='general'){
  const tier=rarityIndex(p.trueRarity);
  const core=Math.pow(Math.max(8,p.overall-42),1.72)*(1+tier*.24);
  if(kind==='sack')return core*(['EDGE','DT','LB'].includes(p.position)?1:.2);
  if(kind==='int')return core*(['CB','S'].includes(p.position)?1:p.position==='LB'?.42:.08);
  return core;
}

function defensiveStats(rng,def,sacks,interceptions,fumbles,defensiveTD=0){
  const defenders=[...def.edge,...def.dt,...def.lb,...def.cb,...def.s];
  const baseTackles={EDGE:3.2,DT:3.0,LB:5.8,CB:4.0,S:5.0};
  const stats={};
  defenders.forEach(p=>{
    const talent=clamp(.68+(p.overall-52)*.015+rarityIndex(p.trueRarity)*.035,.62,1.55);
    stats[p.id]={tackles:Math.max(1,Math.round(rng.normal((baseTackles[p.position]||3.8)*talent,1.55))),sacks:0,interceptions:0,forcedFumbles:0,defensiveTD:0};
  });
  const sackCandidates=[...def.edge,...def.dt,...def.lb],bestDef=Math.max(0,...sackCandidates.map(p=>p.overall)),trackedSackCoverage=clamp(.46+(bestDef-58)*.0065,.44,.78);
  for(let i=0;i<sacks;i++){
    if(!rng.bool(trackedSackCoverage))continue;
    const eligible=sackCandidates.filter(p=>stats[p.id].sacks<({Common:1,Uncommon:1,Rare:2,Epic:2,Legend:3,Generational:4}[p.trueRarity]||1));
    const p=chooseScorer(rng,eligible,x=>impactWeight(x,'sack'));if(p)stats[p.id].sacks++;
  }
  for(let i=0;i<interceptions;i++){const p=chooseScorer(rng,[...def.cb,...def.s,...def.lb],x=>impactWeight(x,'int'));if(p)stats[p.id].interceptions++;}
  for(let i=0;i<fumbles;i++){const p=chooseScorer(rng,[...def.edge,...def.lb,...def.dt],x=>impactWeight(x,'sack'));if(p)stats[p.id].forcedFumbles++;}
  for(let i=0;i<defensiveTD;i++){
    const turnoverMakers=defenders.filter(p=>(stats[p.id]?.interceptions||0)+(stats[p.id]?.forcedFumbles||0)>0);
    const p=chooseScorer(rng,turnoverMakers.length?turnoverMakers:defenders,x=>impactWeight(x,'general'));
    if(p)stats[p.id].defensiveTD++;
  }
  return stats;
}

function receiverTalentFactor(p){
  const tierBase={Common:.72,Uncommon:.86,Rare:1.03,Epic:1.22,Legend:1.42,Generational:1.60}[p.trueRarity]||.72;
  return clamp(tierBase+(p.overall-nominalOverall(p.trueRarity))*.015,.68,1.62);
}

function hbUsageShare(p,starter=true){
  if(!p)return 0;
  const base=starter?({Common:.47,Uncommon:.53,Rare:.59,Epic:.65,Legend:.71,Generational:.76}[p.trueRarity]||.45):({Common:.17,Uncommon:.18,Rare:.20,Epic:.22,Legend:.24,Generational:.25}[p.trueRarity]||.16);
  return clamp(base+(p.overall-nominalOverall(p.trueRarity))*.004,starter?.42:.12,starter?.80:.28);
}

export function simulateGame(rng,homeTeam,awayTeam,homeRoster,awayRoster,context={league:'NFL',stage:'Regular Season',round:1}){
  const H=teamUnitRatings(homeTeam,homeRoster),A=teamUnitRatings(awayTeam,awayRoster);

  function offense(team,off,def,home=false){
    const qb=off.qb;
    const positiveSupport=Math.max(0,(avg(off.wr,p=>p.overall)-58)*.55+((off.te?.overall||55)-58)*.18+(avg(off.ol,p=>p.overall)-58)*.35+coachProduction(team,'offense'));
    let pass=qbPassingExpectation(team,off,def,context.league)+rng.normal(0,31)+(home?4:0);
    const outlierChance={Common:.004,Uncommon:.007,Rare:.011,Epic:.016,Legend:.021,Generational:.026}[qb?.trueRarity]||.003;
    const passOutlier=rng.bool(outlierChance);
    if(passOutlier)pass+=rng.range(55,125);
    pass=Math.round(clamp(pass,context.league==='COLLEGE'?55:65,passingCeiling(qb,positiveSupport)));

    let rush=rushingExpectation(team,off,def,context.league)+rng.normal(0,23)+(home?2:0);
    const rushOutlier=rng.bool(.013+(off.hb[0]?rarityIndex(off.hb[0].trueRarity)*.002:0));
    if(rushOutlier)rush+=rng.range(35,90);
    rush=Math.round(clamp(rush,20,rushOutlier?330:255));

    const pressure=clamp((def.passDef-off.passOff)/24,-.4,1.2);
    const intBase={Common:1.18,Uncommon:.96,Rare:.76,Epic:.60,Legend:.45,Generational:.34}[qb?.trueRarity]||1.25;
    const ints=clamp(Math.round(Math.max(0,rng.normal(intBase+pressure*.42,.68))),0,4);
    const sacks=clamp(Math.round(Math.max(0,rng.normal(2.1+(def.passDef-off.passOff)/19,1.20))),0,8);
    const fumbles=clamp(Math.round(Math.max(0,rng.normal(.50+(def.rushDef-off.rushOff)/55,.52))),0,3);
    const turnovers=ints+fumbles;

    let eliteTD=0;
    if(qb?.trueRarity==='Generational'&&rng.bool(.35*clamp((avg(off.wr,p=>p.overall)-50)/35,.40,1.05)))eliteTD+=1;
    else if(qb?.trueRarity==='Legend'&&rng.bool(.18))eliteTD+=1;
    else if(qb?.trueRarity==='Epic'&&rng.bool(.07))eliteTD+=1;
    if(off.hb.some(p=>p.trueRarity==='Generational')&&rng.bool(.18))eliteTD+=1;

    const tds=touchdownCount(rng,pass+rush,turnovers,offensiveEfficiency(team,off),eliteTD);
    const fgs=fieldGoals(rng,pass+rush,tds,turnovers);
    const passingShare=clamp(pass/(pass+rush),.34,.84);
    const qbTDMult={Common:.72,Uncommon:.84,Rare:.96,Epic:1.05,Legend:1.12,Generational:1.18}[qb?.trueRarity]||.7;
    const passTDShare=clamp(passingShare*qbTDMult,.25,.82);
    let passTD=0,rushTD=0;
    for(let i=0;i<tds;i++)rng.bool(passTDShare)?passTD++:rushTD++;

    const defTDAgainst=Array.from({length:turnovers}).reduce(n=>n+(rng.bool(.052)?1:0),0);
    const safetyAgainst=(sacks>=5&&rng.bool(.045+(sacks-5)*.016))?1:0;
    const offensivePoints=tds*7+fgs*3;

    const playerStats={};
    if(qb)playerStats[qb.id]={passYards:pass,passTD,interceptions:ints,rushYards:0,rushTD:0,recYards:0,recTD:0};

    // Team rushing is not automatically credited to the starter. Common backs live in committees;
    // elite backs command a much larger share of the same team production.
    let qbRush=qb?Math.round(clamp(rng.normal(9+(qb.overall-58)*.18,7),0,rush*.16)):0;
    if(qb)playerStats[qb.id].rushYards=qbRush;
    let availableRush=Math.max(0,rush-qbRush);
    const hbShares=off.hb.map((p,i)=>hbUsageShare(p,i===0));
    const shareSum=hbShares.reduce((a,b)=>a+b,0);
    const shareScale=shareSum>.84?.84/shareSum:1;
    off.hb.forEach((p,i)=>{
      const y=Math.max(0,Math.min(availableRush,Math.round(rush*hbShares[i]*shareScale+rng.normal(0,5))));
      availableRush-=y;
      playerStats[p.id]={...(playerStats[p.id]||{}),rushYards:y,rushTD:0,recYards:0,recTD:0};
    });

    // Receiving production also leaves an anonymous share for the untracked depth chart instead of
    // dumping every leftover passing yard onto WR1.
    const receivers=[...off.wr,...(off.te?[off.te]:[]),...off.hb];
    const rawShares=[];
    off.wr.forEach((p,i)=>rawShares.push([p,[.25,.18,.12][i]||.09]));
    if(off.te)rawShares.push([off.te,.13]);
    off.hb.forEach((p,i)=>rawShares.push([p,i===0?.065:.025]));
    let weighted=rawShares.map(([p,b])=>[p,b*receiverTalentFactor(p)]);
    const totalShare=weighted.reduce((s,[,v])=>s+v,0),recScale=totalShare>.86?.86/totalShare:1;
    weighted.forEach(([p,share])=>{
      const y=Math.max(0,Math.round(pass*share*recScale+rng.normal(0,7)));
      playerStats[p.id]={...(playerStats[p.id]||{}),recYards:y,recTD:playerStats[p.id]?.recTD||0};
    });

    const trackedRec=receivers.reduce((s,p)=>s+(playerStats[p.id]?.recYards||0),0);
    const passCoverage=clamp(trackedRec/Math.max(1,pass)+.04,.48,.92);
    for(let i=0;i<passTD;i++){
      if(!rng.bool(passCoverage))continue;
      const p=chooseScorer(rng,receivers,x=>(playerStats[x.id]?.recYards||5)*(.8+playerTierFactor(x)*.35));
      if(p)playerStats[p.id].recTD=(playerStats[p.id].recTD||0)+1;
    }

    const rushers=[...off.hb,...(qb?[qb]:[])];
    const trackedRush=rushers.reduce((s,p)=>s+(playerStats[p.id]?.rushYards||0),0);
    const rushCoverage=clamp(trackedRush/Math.max(1,rush)+.04,.50,.94);
    for(let i=0;i<rushTD;i++){
      if(!rng.bool(rushCoverage))continue;
      const p=chooseScorer(rng,rushers,x=>(playerStats[x.id]?.rushYards||4)*(.78+playerTierFactor(x)*.42));
      if(p)playerStats[p.id].rushTD=(playerStats[p.id].rushTD||0)+1;
    }

    return {pass,rush,ints,sacks,fumbles,tds,passTD,rushTD,fgs,defTDAgainst,safetyAgainst,offensivePoints,playerStats};
  }

  const home=offense(homeTeam,H,A,true),away=offense(awayTeam,A,H,false);
  let homePoints=home.offensivePoints+away.defTDAgainst*7+away.safetyAgainst*2;
  let awayPoints=away.offensivePoints+home.defTDAgainst*7+home.safetyAgainst*2;
  // Eliminate ties without simulating overtime play-by-play.
  if(homePoints===awayPoints){
    const hEdge=(H.passOff+H.rushOff+H.passDef+H.rushDef)-(A.passOff+A.rushOff+A.passDef+A.rushDef)+rng.normal(0,18);
    hEdge>=0?homePoints+=3:awayPoints+=3;
  }

  const homeDef=defensiveStats(rng,H,away.sacks,away.ints,away.fumbles,away.defTDAgainst);
  const awayDef=defensiveStats(rng,A,home.sacks,home.ints,home.fumbles,home.defTDAgainst);
  Object.entries(homeDef).forEach(([id,s])=>home.playerStats[id]={...(home.playerStats[id]||{}),...s});
  Object.entries(awayDef).forEach(([id,s])=>away.playerStats[id]={...(away.playerStats[id]||{}),...s});

  return {
    id:`G-${context.league}-${context.round}-${homeTeam.id}-${awayTeam.id}-${Math.floor(rng()*1e6)}`,
    league:context.league,stage:context.stage,round:context.round,homeId:homeTeam.id,awayId:awayTeam.id,
    homeScore:homePoints,awayScore:awayPoints,
    homeBox:{passYards:home.pass,rushYards:home.rush,turnovers:home.ints+home.fumbles,sacksAllowed:home.sacks,passTD:home.passTD,rushTD:home.rushTD,fg:home.fgs},
    awayBox:{passYards:away.pass,rushYards:away.rush,turnovers:away.ints+away.fumbles,sacksAllowed:away.sacks,passTD:away.passTD,rushTD:away.rushTD,fg:away.fgs},
    playerStats:{...home.playerStats,...away.playerStats}
  };
}
