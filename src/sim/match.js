import { RARITY_META } from './generate.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const avg=(arr,f=x=>x)=>arr.length?arr.reduce((s,x)=>s+f(x),0)/arr.length:55;
const top=(arr,n=1)=>[...arr].sort((a,b)=>b.overall-a.overall).slice(0,n);
const rarityBonus=r=>({Common:0,Uncommon:2,Rare:5,Epic:10,Legend:17,Generational:26})[r]||0;
const get=(roster,pos)=>roster.filter(p=>p.position===pos && !p.retired);

function coachFactor(team,side){
  const hc=team.hc?.overall||60, coord=(side==='offense'?team.oc?.overall:team.dc?.overall)||60;
  return (hc-60)*.22+(coord-60)*.38;
}

export function teamUnitRatings(team, roster){
  const qb=top(get(roster,'QB'))[0]; const wr=top(get(roster,'WR'),3); const hb=top(get(roster,'HB'),2); const te=top(get(roster,'TE'))[0];
  const ol=[...get(roster,'OT'),...get(roster,'OG'),...get(roster,'C')];
  const edge=get(roster,'EDGE'), dt=get(roster,'DT'), lb=get(roster,'LB'), cb=get(roster,'CB'), s=get(roster,'S');
  const passOff=((qb?.overall||48)*.42+avg(wr,p=>p.overall)*.24+(te?.overall||52)*.08+avg(ol,p=>p.overall)*.18)/.92+coachFactor(team,'offense')*.65;
  const rushOff=(avg(hb,p=>p.overall)*.34+avg(ol,p=>p.overall)*.31+(qb?.overall||50)*.06)/.71+coachFactor(team,'offense')*.7;
  const passDef=(avg(cb,p=>p.overall)*.29+avg(s,p=>p.overall)*.16+avg(edge,p=>p.overall)*.24+avg(lb,p=>p.overall)*.12)/.81+coachFactor(team,'defense')*.72;
  const rushDef=(avg(dt,p=>p.overall)*.25+avg(lb,p=>p.overall)*.27+avg(edge,p=>p.overall)*.15+avg(s,p=>p.overall)*.09)/.76+coachFactor(team,'defense')*.72;
  return {passOff,rushOff,passDef,rushDef,qb,wr,hb,te,ol,edge,dt,lb,cb,s};
}

function superstarPassingAdjustment(off,def){
  let adj=0;
  if(off.qb){
    const qbBonus=rarityBonus(off.qb.trueRarity);
    const support=(avg(off.wr,p=>p.overall)+(off.te?.overall||55)+avg(off.ol,p=>p.overall))/3;
    const supportScale=clamp((support-52)/35,.35,1.18);
    adj+=qbBonus*1.55*supportScale;
  }
  for(const wr of off.wr){
    let bonus=rarityBonus(wr.trueRarity)*1.05;
    const cover=top(def.cb)[0];
    if(cover){
      const suppression={Common:0,Uncommon:.08,Rare:.22,Epic:.42,Legend:.72,Generational:1.0}[cover.trueRarity]||0;
      bonus*=1-suppression;
      if(cover.trueRarity==='Generational') adj-=4;
    }
    adj+=bonus;
  }
  if(off.te) adj+=rarityBonus(off.te.trueRarity)*.45;
  for(const e of top(def.edge,2)) adj-=rarityBonus(e.trueRarity)*.48;
  return adj;
}

function superstarRushAdjustment(off,def){
  let adj=0;
  for(const back of off.hb) adj+=rarityBonus(back.trueRarity)*1.0;
  for(const lineman of off.ol) adj+=rarityBonus(lineman.trueRarity)*.18;
  for(const d of [...top(def.dt,2),...top(def.lb,2)]) adj-=rarityBonus(d.trueRarity)*.48;
  return adj;
}

function touchdownCount(rng,totalYards,turnovers,eliteBonus){
  const base=clamp((totalYards-50)/95,0.35,6.2);
  const eff=base-turnovers*.28+eliteBonus;
  const floor=Math.max(0,Math.floor(eff));
  return clamp(floor+(rng.bool(eff-floor)?1:0)+ (rng.bool(.06)?1:0),0,8);
}

function fieldGoals(rng,totalYards,tds,turnovers){
  const chances=clamp((totalYards/175)-tds*.25-turnovers*.1,0,3.4);
  const n=Math.floor(chances)+(rng.bool(chances%1)?1:0);
  return clamp(n,0,4);
}

function chooseScorer(rng, candidates, weightFn){
  const valid=candidates.filter(Boolean);
  if(!valid.length) return null;
  return rng.weighted(valid.map(p=>[p,Math.max(.1,weightFn(p))]));
}

function defensiveStats(rng,def, sacks, interceptions, fumbles){
  const defenders=[...def.edge,...def.dt,...def.lb,...def.cb,...def.s];
  const stats={}; defenders.forEach(p=>stats[p.id]={tackles:Math.max(1,Math.round(rng.normal(4.5,2))),sacks:0,interceptions:0,forcedFumbles:0,defensiveTD:0});
  for(let i=0;i<sacks;i++){ const p=chooseScorer(rng,[...def.edge,...def.dt,...def.lb],x=>x.overall+rarityBonus(x.trueRarity)*2); if(p) stats[p.id].sacks++; }
  for(let i=0;i<interceptions;i++){ const p=chooseScorer(rng,[...def.cb,...def.s,...def.lb],x=>x.overall+rarityBonus(x.trueRarity)*2); if(p) stats[p.id].interceptions++; }
  for(let i=0;i<fumbles;i++){ const p=chooseScorer(rng,[...def.edge,...def.lb,...def.dt],x=>x.overall); if(p) stats[p.id].forcedFumbles++; }
  return stats;
}

export function simulateGame(rng, homeTeam, awayTeam, homeRoster, awayRoster, context={league:'NFL',stage:'Regular Season',round:1}){
  const H=teamUnitRatings(homeTeam,homeRoster), A=teamUnitRatings(awayTeam,awayRoster);
  const basePass=context.league==='COLLEGE'?238:context.league==='UFL'?215:235;
  const baseRush=context.league==='COLLEGE'?138:context.league==='UFL'?118:116;

  function offense(team,off,def,home=false){
    const teamQuality=(off.passOff+off.rushOff)/2;
    const opponent=(def.passDef+def.rushDef)/2;
    const qualityScale=clamp(.72+(teamQuality-52)/70,.68,1.18);
    let pass=basePass+(off.passOff-def.passDef)*2.15+superstarPassingAdjustment(off,def)+rng.normal(0,43)+(home?5:0);
    let rush=baseRush+(off.rushOff-def.rushDef)*1.72+superstarRushAdjustment(off,def)+rng.normal(0,31)+(home?2:0);
    pass*=qualityScale; rush*=clamp(.82+(teamQuality-54)/100,.72,1.12);
    const outlier=rng.bool(.018); if(outlier){pass+=rng.range(70,150);rush+=rng.range(20,75);}
    pass=Math.round(clamp(pass,context.league==='COLLEGE'?55:70,outlier?590:520));
    rush=Math.round(clamp(rush,20,outlier?390:330));
    const pressure=clamp((def.passDef-off.passOff)/25,0,1);
    const qb=off.qb; const qbRare=qb?RARITY_META[qb.trueRarity].score:55;
    const ints=clamp(Math.round(Math.max(0,rng.normal(1.0+(60-qbRare)/45+pressure*.6,.78))),0,4);
    const sacks=clamp(Math.round(Math.max(0,rng.normal(2.2+(def.passDef-off.passOff)/18,1.35))),0,8);
    const fumbles=clamp(Math.round(Math.max(0,rng.normal(.55+(def.rushDef-off.rushOff)/50,.58))),0,3);
    const turnovers=ints+fumbles;
    let eliteTD=0;
    if(qb?.trueRarity==='Generational' && rng.bool(.47*clamp((avg(off.wr,p=>p.overall)-50)/35,.45,1.1))) eliteTD+=1;
    else if(qb?.trueRarity==='Legend' && rng.bool(.27)) eliteTD+=1;
    else if(qb?.trueRarity==='Epic' && rng.bool(.11)) eliteTD+=1;
    if(off.hb.some(p=>p.trueRarity==='Generational') && rng.bool(.28)) eliteTD+=1;
    const tds=touchdownCount(rng,pass+rush,turnovers,eliteTD);
    const fgs=fieldGoals(rng,pass+rush,tds,turnovers);
    const passingShare=clamp(pass/(pass+rush),.35,.84);
    let passTD=0,rushTD=0;
    for(let i=0;i<tds;i++) rng.bool(passingShare)?passTD++:rushTD++;
    let defTD=0; for(let i=0;i<turnovers;i++) if(rng.bool(.055)) defTD++;
    const safety=(sacks>=5 && rng.bool(.055+(sacks-5)*.018))?1:0;
    const points=tds*7+fgs*3+defTD*7+safety*2;
    const playerStats={};
    if(qb) playerStats[qb.id]={passYards:pass,passTD,interceptions:ints,rushYards:Math.max(0,Math.round(rng.normal(qb.position==='QB'?18:0,14))),rushTD:0};
    const backs=off.hb.length?off.hb:[]; let rushRemaining=rush;
    backs.forEach((p,idx)=>{ const share=idx===0?.67:.25; const y=Math.max(0,Math.round(rush*share+rng.normal(0,8))); rushRemaining-=y; playerStats[p.id]={...(playerStats[p.id]||{}),rushYards:y,rushTD:0,recYards:Math.max(0,Math.round(rng.normal(18,13))),recTD:0}; });
    const receivers=[...off.wr,...(off.te?[off.te]:[])]; let passRemaining=pass;
    receivers.forEach((p,idx)=>{ const baseShare=idx===0?.29:idx===1?.22:idx===2?.16:.14; const rare=1+rarityBonus(p.trueRarity)/85; const y=Math.max(0,Math.round(pass*baseShare*rare+rng.normal(0,13))); passRemaining-=y; playerStats[p.id]={...(playerStats[p.id]||{}),recYards:y,recTD:0}; });
    if(receivers.length && passRemaining>0) playerStats[receivers[0].id].recYards+=passRemaining;
    if(backs.length && rushRemaining>0) playerStats[backs[0].id].rushYards+=rushRemaining;
    for(let i=0;i<passTD;i++){ const p=chooseScorer(rng,receivers,x=>(playerStats[x.id]?.recYards||10)+rarityBonus(x.trueRarity)*8); if(p) playerStats[p.id].recTD=(playerStats[p.id].recTD||0)+1; }
    for(let i=0;i<rushTD;i++){ const p=chooseScorer(rng,backs,x=>(playerStats[x.id]?.rushYards||10)+rarityBonus(x.trueRarity)*8); if(p) playerStats[p.id].rushTD=(playerStats[p.id].rushTD||0)+1; }
    return {pass,rush,ints,sacks,fumbles,tds,passTD,rushTD,fgs,defTD,safety,points,playerStats};
  }

  let home=offense(homeTeam,H,A,true), away=offense(awayTeam,A,H,false);
  // Eliminate ties without simulating overtime play-by-play.
  if(home.points===away.points){
    const hEdge=(H.passOff+H.rushOff+H.passDef+H.rushDef)-(A.passOff+A.rushOff+A.passDef+A.rushDef)+rng.normal(0,18);
    hEdge>=0?home.points+=3:away.points+=3;
  }
  const homeDef=defensiveStats(rng,H,away.sacks,away.ints,away.fumbles);
  const awayDef=defensiveStats(rng,A,home.sacks,home.ints,home.fumbles);
  Object.entries(homeDef).forEach(([id,s])=>home.playerStats[id]={...(home.playerStats[id]||{}),...s});
  Object.entries(awayDef).forEach(([id,s])=>away.playerStats[id]={...(away.playerStats[id]||{}),...s});
  return {
    id:`G-${context.league}-${context.round}-${homeTeam.id}-${awayTeam.id}-${Math.floor(rng()*1e6)}`,
    league:context.league, stage:context.stage, round:context.round, homeId:homeTeam.id, awayId:awayTeam.id,
    homeScore:home.points, awayScore:away.points,
    homeBox:{passYards:home.pass,rushYards:home.rush,turnovers:home.ints+home.fumbles,sacksAllowed:home.sacks,passTD:home.passTD,rushTD:home.rushTD,fg:home.fgs},
    awayBox:{passYards:away.pass,rushYards:away.rush,turnovers:away.ints+away.fumbles,sacksAllowed:away.sacks,passTD:away.passTD,rushTD:away.rushTD,fg:away.fgs},
    playerStats:{...home.playerStats,...away.playerStats}
  };
}
