import { RARITIES, RARITY_META } from './generate.js';

// ─────────────────────────────────────────────────────────────────────────────
// Drive-based game engine (v0.8).
//
// Every game is played snap by snap: down, distance, field position, clock and
// score are tracked, and the play call reacts to the game situation (trailing
// teams throw and hurry, leading teams run the clock, 4th-down decisions depend
// on score/time/coach). The box score is the SUM of real plays, so comebacks,
// defensive stands and late collapses can genuinely happen and every touchdown
// in the play log is the one that actually decided the score.
//
// Output keeps the legacy shape (homeScore/awayScore, homeBox/awayBox,
// playerStats) and adds:
//   drives  : compact drive log  {o,q,s,e,y0,y1,n,yds,py,ry,r,pts,h,a}
//   plays   : key plays          {t,o,k,p,p2,y,pts,h,a}
//   quarters: points by quarter  {home:[q1,q2,q3,q4,ot], away:[...]}
//   flags   : drama markers      {leadChanges,comeback,gameWinner,ot}
//   xm      : pre-game expected home margin (for win-probability curves)
// ─────────────────────────────────────────────────────────────────────────────

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

export function teamUnitRatings(team, roster){
  const qb=top(get(roster,'QB'))[0]; const wr=top(get(roster,'WR'),3); const hb=top(get(roster,'HB'),2); const te=top(get(roster,'TE'))[0];
  const ol=[...get(roster,'OT'),...get(roster,'OG'),...get(roster,'C')];
  const edge=get(roster,'EDGE'), dt=get(roster,'DT'), lb=get(roster,'LB'), cb=get(roster,'CB'), s=get(roster,'S');
  const k=top(get(roster,'K'))[0], pt=top(get(roster,'P'))[0];
  const passOff=((qb?.overall||45)*.54+avg(wr,p=>p.overall)*.18+(te?.overall||50)*.06+avg(ol,p=>p.overall)*.14)/.92+coachFactor(team,'offense')*.58;
  const rushOff=(avg(hb,p=>p.overall)*.45+avg(ol,p=>p.overall)*.30+(qb?.overall||48)*.04)/.79+coachFactor(team,'offense')*.62;
  const passDef=(avg(cb,p=>p.overall)*.29+avg(s,p=>p.overall)*.16+avg(edge,p=>p.overall)*.24+avg(lb,p=>p.overall)*.12)/.81+coachFactor(team,'defense')*.72;
  const rushDef=(avg(dt,p=>p.overall)*.25+avg(lb,p=>p.overall)*.27+avg(edge,p=>p.overall)*.15+avg(s,p=>p.overall)*.09)/.76+coachFactor(team,'defense')*.72;
  return {passOff,rushOff,passDef,rushDef,qb,wr,hb,te,ol,edge,dt,lb,cb,s,k,pt};
}

// ── Talent → per-game production expectations (kept from v0.7 so the stat
//    bands that QA guards stay anchored to rarity) ───────────────────────────
function superstarPassingAdjustment(off,def){
  let adj=0;
  if(off.qb){
    const support=(avg(off.wr,p=>p.overall)+(off.te?.overall||55)+avg(off.ol,p=>p.overall))/3;
    adj+=rarityBonus(off.qb.trueRarity)*.72*clamp((support-52)/35,.28,1.15);
  }
  const cover=top(def.cb)[0];
  for(const wr of off.wr){
    let bonus=rarityBonus(wr.trueRarity)*.52;
    if(cover){bonus*=1-({Common:0,Uncommon:.08,Rare:.22,Epic:.42,Legend:.72,Generational:1.0}[cover.trueRarity]||0);if(cover.trueRarity==='Generational')adj-=3;}
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
  const qb=off.qb;if(!qb)return 115;
  const tierBase={Common:168,Uncommon:200,Rare:222,Epic:247,Legend:270,Generational:292}[qb.trueRarity]||170;
  const skill=tierBase+(qb.overall-nominalOverall(qb.trueRarity))*1.8;
  const support=(avg(off.wr,p=>p.overall)-58)*.55+((off.te?.overall||55)-58)*.18+(avg(off.ol,p=>p.overall)-58)*.35;
  const leagueAdj=league==='COLLEGE'?10:league==='UFL'?-5:0;
  return skill+support+coachProduction(team,'offense')-(def.passDef-65)+superstarPassingAdjustment(off,def)+leagueAdj;
}
function rushingExpectation(team,off,def,league){
  const runner=off.hb[0]?.overall||52;
  const skill=92+(runner-58)*1.35;
  const support=(avg(off.ol,p=>p.overall)-58)*.55+((off.qb?.overall||55)-58)*.09;
  const leagueAdj=league==='COLLEGE'?24:league==='UFL'?2:0;
  return skill+support+coachProduction(team,'offense')*.65-(def.rushDef-65)*.86+superstarRushAdjustment(off,def)+leagueAdj;
}
function receiverTalentFactor(p){
  const tierBase={Common:.72,Uncommon:.86,Rare:1.03,Epic:1.22,Legend:1.42,Generational:1.60}[p.trueRarity]||.72;
  return clamp(tierBase+(p.overall-nominalOverall(p.trueRarity))*.015,.68,1.62);
}
function hbUsageShare(p,starter=true){
  if(!p)return 0;
  const base=starter?({Common:.44,Uncommon:.53,Rare:.59,Epic:.65,Legend:.71,Generational:.76}[p.trueRarity]||.45):({Common:.17,Uncommon:.18,Rare:.20,Epic:.22,Legend:.24,Generational:.25}[p.trueRarity]||.16);
  return clamp(base+(p.overall-nominalOverall(p.trueRarity))*.004,starter?.42:.12,starter?.80:.28);
}
const T=(p,t)=>!!p?.traits?.includes(t);
function impactWeight(p,kind='general'){
  const core=Math.pow(Math.max(8,p.overall-42),1.72)*(1+rarityIndex(p.trueRarity)*.24);
  if(kind==='sack')return core*(['EDGE','DT','LB'].includes(p.position)?1:.2)*(T(p,'Edge Terror')?1.45:1);
  if(kind==='int')return core*(['CB','S'].includes(p.position)?1:p.position==='LB'?.42:.08)*(T(p,'Ball Hawk')?1.55:1);
  return core;
}

// ── Coach identity ───────────────────────────────────────────────────────────
const OC_STYLE={
  'Air Raid':   {pass:+.09,comp:-.005,ypc:+.03,big:1.10},
  'Vertical':   {pass:+.04,comp:-.035,ypc:+.14,big:1.35},
  'West Coast': {pass:+.03,comp:+.040,ypc:-.08,big:.85},
  'Spread':     {pass:+.04,comp:+.010,ypc:+.02,big:1.05,ypr:+.04},
  'Power Run':  {pass:-.09,comp:+.005,ypc:-.02,big:.90,ypr:+.08},
  'Balanced':   {}
};
const DC_STYLE={
  'Blitz Heavy':      {sack:1.40,comp:-.010,big:1.25,int:1.05},
  'Man Coverage':     {comp:-.030,int:1.12,big:1.08},
  'Zone':             {comp:+.020,big:.78,int:1.04},
  'Run Stop':         {ypr:-.12,comp:+.010},
  'Turnover Hunting': {int:1.30,fum:1.35,ypc:+.04},
  'Balanced':         {}
};
const HC_AGGRESSION={'Offensive Guru':1.45,'Tactical':1.2,'Development Specialist':1,'Players Coach':1,'Defensive Mastermind':.75};

// Pre-game parameters for one offense against one defense.
function offenseProfile(rng,team,oppTeam,off,def,ctx,home,edge=0){
  const league=ctx.league,qb=off.qb,qbTier=qb?rarityIndex(qb.trueRarity):0;
  const ocs=OC_STYLE[team.oc?.style]||{},dcs=DC_STYLE[oppTeam.dc?.style]||{};
  // Game-day form: some days a team just has it, some days it doesn't.
  // Any given Sunday: a clear underdog plays with more urgency, a heavy favourite is more prone to a flat day.
  const lift=clamp((-edge-1.5)*.16,0,1.5),flatRisk=clamp((edge-1.5)*.026,0,.2);
  // Big-Game players raise their level in the playoffs.
  const bigGame=ctx.stage&&ctx.stage!=='Regular Season'?[qb,...off.wr,off.hb[0],off.te].filter(p=>T(p,'Big-Game')).length*.22:0;
  const form=rng.normal(lift+bigGame,1),badDay=rng.bool(.08+flatRisk),defDay=rng.normal(lift*.5,1);
  let passTarget=qbPassingExpectation(team,off,def,league)+form*34+defDay*16+(home?5:0)-(badDay?60:0);
  // Compress talent gaps toward the league baseline: stars still lead the stat sheet,
  // but any-given-Sunday variance keeps 15-win juggernauts rare.
  const passBase=league==='COLLEGE'?215:league==='UFL'?205:228,rushBase=league==='COLLEGE'?150:112;
  passTarget=passBase+(passTarget-passBase)*.66;
  const tierCap={Common:196,Uncommon:228,Rare:258,Epic:272,Legend:282,Generational:290}[qb?.trueRarity]||240;
  passTarget=clamp(passTarget,league==='COLLEGE'?70:85,tierCap);
  let rushTarget=rushingExpectation(team,off,def,league)+rng.normal(0,24)+defDay*10+(home?3:0)-(badDay?20:0);
  rushTarget=clamp(rushBase+(rushTarget-rushBase)*.82,40,({Common:128,Uncommon:142,Rare:158,Epic:172,Legend:186,Generational:200}[off.hb[0]?.trueRarity]||125)+((off.hb[0]?.overall||60)-60)*.3);
  const attempts=46;
  const comp=clamp(.615+qbTier*.010+(qb?.overall-75||0)*.002+(off.passOff-def.passDef)/420+(ocs.comp||0)+(dcs.comp||0)+(T(qb,'Field General')?.015:0)-(T(qb,'Gunslinger')?.01:0),.47,.76);
  const ypa=passTarget/attempts;
  const ypc=clamp(ypa/comp*1.24*(1+(ocs.ypc||0)+(dcs.ypc||0)),5.5,19);
  const ypr=clamp(rushTarget/21.7*(1+(ocs.ypr||0)+(dcs.ypr||0)),2.6,7.2);
  const edgeHeat=top(def.edge,2).reduce((s,e)=>s+rarityBonus(e.trueRarity),0)/100;
  const sackRate=clamp((.060+(def.passDef-off.passOff)/330+edgeHeat*.10)*(dcs.sack||1),.025,.14);
  const intRaw=({Common:1.18,Uncommon:.96,Rare:.76,Epic:.60,Legend:.45,Generational:.34}[qb?.trueRarity]||1.25);
  const intBase=.82+(intRaw-.82)*.65+(badDay?.55:0);
  const intRate=clamp(intBase/attempts*.80*(1+clamp((def.passDef-off.passOff)/40,-.3,.6))*(dcs.int||1)*(T(qb,'Gunslinger')?1.18:1)*(T(qb,'Field General')?.9:1),.006,.06);
  const fumRate=clamp((.34+(def.rushDef-off.rushOff)/60+(badDay?.25:0))/27*.55*(dcs.fum||1),.003,.03);
  const passShare=clamp(passTarget/(passTarget+rushTarget*.95),.42,.70);
  const passRate=clamp(passShare+(ocs.pass||0),.38,.74);
  const qbTDMult={Common:.72,Uncommon:.84,Rare:.96,Epic:1.05,Legend:1.12,Generational:1.18}[qb?.trueRarity]||.7;
  const big=(ocs.big||1)*(dcs.big||1)*(T(qb,'Gunslinger')?1.15:1)*([...off.wr,off.te].some(p=>T(p,'Deep Threat'))?1.08:1);
  const rushBig=T(off.hb[0],'Home-Run Hitter')?1.35:1;
  // Receivers & rushers (leftover shares go to untracked depth players).
  const sure=p=>T(p,'Sure Hands')?1.12:1;const rec=[];off.wr.forEach((p,i)=>rec.push([p,([.25,.18,.12][i]||.09)*receiverTalentFactor(p)*sure(p)]));if(off.te)rec.push([off.te,.13*receiverTalentFactor(off.te)*sure(off.te)]);off.hb.forEach((p,i)=>rec.push([p,(i===0?.065:.025)*receiverTalentFactor(p)*sure(p)]));
  const recTotal=rec.reduce((s,[,w])=>s+w,0),recScale=recTotal>.86?.86/recTotal:1;rec.forEach(r=>r[1]*=recScale);rec.push([null,Math.max(.06,1-rec.reduce((s,[,w])=>s+w,0))]);
  const hbShares=off.hb.map((p,i)=>hbUsageShare(p,i===0)*(T(p,'Workhorse')?1.12:1)),hbSum=hbShares.reduce((a,b)=>a+b,0),hbScale=hbSum>.84?.84/hbSum:1;
  const qbRunShare=qb?clamp(.07+(qb.overall-60)*.0012+(T(qb,'Scrambler')?.05:0),.04,.17):0;
  const rush=off.hb.map((p,i)=>[p,hbShares[i]*hbScale]);if(qb)rush.push([qb,qbRunShare]);rush.push([null,Math.max(.05,1-rush.reduce((s,[,w])=>s+w,0))]);
  const sackers=[...def.edge,...def.dt,...def.lb],bestDef=Math.max(0,...sackers.map(p=>p.overall));
  return {passCap:tierCap,gamePass:0,team,off,def,comp,ypc,ypr,sackRate,intRate,fumRate,passRate,qbTDMult,big,rushBig,qbTier,clutchQB:T(qb,'Clutch'),rec,rush,
    aggression:HC_AGGRESSION[team.hc?.style]||1,kicker:off.k,kickPower:(off.k?.overall||62),
    sackCoverage:clamp(.46+(bestDef-58)*.0065,.44,.78)};
}

const SACK_CAP={Common:1,Uncommon:1,Rare:2,Epic:2,Legend:3,Generational:4};

export function simulateGame(rng,homeTeam,awayTeam,homeRoster,awayRoster,context={league:'NFL',stage:'Regular Season',round:1}){
  const H=teamUnitRatings(homeTeam,homeRoster),A=teamUnitRatings(awayTeam,awayRoster);
  const isPlayoff=context.stage&&context.stage!=='Regular Season';
  const strength=U=>U.passOff+U.rushOff+U.passDef+U.rushDef+(U.qb?rarityBonus(U.qb.trueRarity)*.45:0);
  const rawEdge=(strength(H)-strength(A))/4.6;
  const xm=Math.round((rawEdge+2.2)*10)/10;
  const prof=[offenseProfile(rng,homeTeam,awayTeam,H,A,context,true,rawEdge),offenseProfile(rng,awayTeam,homeTeam,A,H,context,false,-rawEdge)];

  const score=[0,0],quarters=[[0,0,0,0,0],[0,0,0,0,0]];
  const box=[0,1].map(()=>({passYards:0,rushYards:0,interceptions:0,fumbles:0,sacksAllowed:0,passTD:0,rushTD:0,fg:0,defensiveTD:0,safeties:0,otPoints:0,firstDowns:0,plays:0,top:0,thirdConv:0,thirdAtt:0}));
  const ps={};const stat=(p,k,v=1)=>{if(!p)return;const s=ps[p.id]||(ps[p.id]={});s[k]=(s[k]||0)+v;};
  const drives=[],plays=[];
  const sackCount={};
  let t=0,possession=rng.bool(.5)?0:1;const firstReceiver=possession;
  let yard=25,down=1,togo=10,driveStart=null,overtime=false,otPossessions=0,gameOver=false,halfDone=false;
  const GAME=3600,OT_LEN=isPlayoff?900:600;
  let otEnd=GAME;
  // lead tracking
  let leader=0,leadChanges=0;const maxDeficit=[0,0];
  const quarterOf=sec=>sec>=GAME?4:Math.min(3,Math.floor(sec/900));
  const timeLeftHalf=()=>t<1800?1800-t:(overtime?otEnd-t:GAME-t);
  const timeLeftGame=()=>overtime?otEnd-t:GAME-t;

  const addPoints=(side,pts,kind,extra={})=>{
    score[side]+=pts;quarters[side][quarterOf(t)]+=pts;if(overtime)box[side].otPoints+=pts;
    const diff=score[0]-score[1],nl=diff>0?1:diff<0?-1:0;if(nl!==0&&leader!==0&&nl!==leader)leadChanges++;if(nl!==0)leader=nl;
    maxDeficit[0]=Math.max(maxDeficit[0],score[1]-score[0]);maxDeficit[1]=Math.max(maxDeficit[1],score[0]-score[1]);
    plays.push({t:Math.min(t,otEnd),o:side,k:kind,pts,h:score[0],a:score[1],...extra});
  };
  const startDrive=(side,y)=>{possession=side;yard=clamp(Math.round(y),1,99);down=1;togo=Math.min(10,100-yard);driveStart={o:side,q:quarterOf(t)+1,s:t,y0:yard,n:0,py:0,ry:0,sc:score[side]};};
  const endDrive=(result)=>{if(!driveStart)return;const d=driveStart,pts=score[d.o]-d.sc;if(d.n===0&&(result==='END'||result==='HALF')){driveStart=null;return;}drives.push({o:d.o,q:d.q,s:d.s,e:Math.max(d.s,Math.min(t,overtime?otEnd:GAME)),y0:d.y0,y1:clamp(yard,0,100),n:d.n,yds:clamp(yard,0,100)-d.y0,py:d.py,ry:d.ry,r:result,pts,h:score[0],a:score[1]});box[d.o].top+=Math.min(t,overtime?otEnd:GAME)-d.s;driveStart=null;};
  // Dynamic-kickoff era: touchbacks come out to the 30 and returns average a little better.
  const kickoff=(receiver)=>{let y=30;if(!rng.bool(.45)){y=clamp(Math.round(rng.normal(30,7)),10,48);if(rng.bool(.015))y=rng.int(50,75);}t+=rng.int(4,7);startDrive(receiver,y);};
  const opp=s=>1-s;
  const pick=(pairs)=>rng.weighted(pairs.map(([p,w])=>[p,Math.max(.0001,w)]));
  const defenderFor=(side,kind)=>{const D=prof[side].def;const list=kind==='int'?[...D.cb,...D.s,...D.lb]:[...D.edge,...D.dt,...D.lb];if(!list.length)return null;return pick(list.map(p=>[p,impactWeight(p,kind)]));};

  const tryAfterTD=(side)=>{
    const diff=score[side]-score[opp(side)];const late=t>=2700||overtime;
    if(late&&(diff===-2||diff===1||diff===-10||diff===5)&&rng.bool(.85)){const ok=rng.bool(.47);if(ok)addPoints(side,2,'XP2');return;}
    if(rng.bool(clamp(.945+(prof[side].kickPower-70)*.002,.88,.985)))addPoints(side,1,'XP');else plays.push({t,o:side,k:'XPMISS',pts:0,h:score[0],a:score[1]});
  };
  const touchdown=(side,kind,extra)=>{addPoints(side,6,kind,extra);tryAfterTD(side);};

  kickoff(possession);
  let guard=0;
  while(!gameOver&&guard++<400){
    // ── period boundaries ─────────────────────────────────────────────
    if(!overtime&&!halfDone&&t>=1800){if(driveStart)endDrive('HALF');t=1800;halfDone=true;kickoff(opp(firstReceiver));continue;}
    if(!overtime&&t>=GAME){
      if(driveStart)endDrive('END');t=GAME;
      if(score[0]!==score[1])break;
      overtime=true;otEnd=GAME+OT_LEN;otPossessions=0;const r=rng.bool(.5)?0:1;kickoff(r);continue;
    }
    if(overtime&&t>=otEnd){
      if(score[0]!==score[1]){if(driveStart)endDrive('END');break;}
      // No ties in the Chronicle: keep playing sudden death.
      otEnd=t+OT_LEN;
    }
    if(!driveStart)startDrive(possession,25);
    const P=prof[possession],D=prof[opp(possession)],side=possession,diff=score[side]-score[opp(side)];
    const q4=t>=2700||overtime,tlg=timeLeftGame(),tlh=timeLeftHalf();
    const twoMinute=(tlh<=120)||(q4&&diff<0&&tlg<=300);
    const clutch=q4&&Math.abs(diff)<=8;
    // Prevent defense: a defense protecting a two-score lead late concedes underneath yards but rarely the big play.
    const prevent=q4&&!overtime&&diff<=-9&&tlg<900;
    // Victory formation
    if(!overtime&&t>=2700&&diff>0&&tlg<=(4-down)*40+2&&driveStart){driveStart.n+=1;t=GAME;endDrive('END');continue;}
    if(!halfDone&&tlh<=6&&yard<55){driveStart.n++;t=1800;continue;}

    // ── 4th down decisions ─────────────────────────────────────────────
    // Last snap of a half / regulation: kick it if a field goal helps (half-ending FG, tying or walk-off kick).
    const fgDistNow=100-yard+17;
    const lastSnap=(!halfDone&&tlh<=7)||(!overtime&&t>=2700&&tlg<=7&&diff<=0&&diff>=-3);
    const forceFG=lastSnap&&fgDistNow<=(P.kickPower>=80?60:57);
    if(down===4||forceFG){
      const fgDist=fgDistNow;
      const needTD=q4&&diff<-3&&tlg<300,mustGo=!forceFG&&q4&&tlg<150&&(diff<-3||(diff<0&&fgDist>57));
      let go=false;
      if(forceFG)go=false;
      else if(mustGo||(needTD&&yard>=40))go=true;
      else if(togo<=2&&yard>=94)go=rng.bool(clamp(.48*P.aggression+(q4&&diff<0?.25:0),0,.95));
      else if(togo<=1&&yard>=40&&yard<=97)go=rng.bool(clamp(.32*P.aggression+(q4&&diff<0?.25:0),0,.9));
      else if(togo<=4&&yard>=52&&yard<=72&&fgDist>52)go=rng.bool(clamp((togo<=2?.45:.28)*P.aggression*(fgDist>56?1.25:.6),0,.8));
      if(forceFG||(!go&&fgDist<=(P.kickPower>=80?58:56)&&!(needTD&&yard<95))){
        const p=clamp(.995-Math.max(0,fgDist-25)*.0045-Math.max(0,fgDist-40)*.010+(P.kickPower-70)*.002,.3,.995);
        t+=5;driveStart.n++;
        if(forceFG)t=Math.max(t,!halfDone?1799:GAME-1);
        if(rng.bool(p)){box[side].fg++;addPoints(side,3,'FG',{p:P.kicker?.id,y:fgDist,walkoff:forceFG&&halfDone?1:0});endDrive('FG');
          if(overtime){otPossessions++;}
          if(forceFG)t+=1;else kickoff(opp(side));}
        else{plays.push({t,o:side,k:'FGMISS',p:P.kicker?.id,y:fgDist,pts:0,h:score[0],a:score[1]});endDrive('MISS');if(overtime)otPossessions++;if(forceFG)t+=1;else startDrive(opp(side),Math.max(20,100-(yard-7)));}
        if(overtime&&checkOT())break;
        continue;
      }
      if(!go){
        const net=Math.round(rng.normal(41,6));t+=8;driveStart.n++;endDrive('PUNT');if(overtime)otPossessions++;
        const land=yard+net;startDrive(opp(side),land>=100?20:Math.max(3,100-land));
        if(overtime&&checkOT())break;
        continue;
      }
    }

    // ── play call ──────────────────────────────────────────────────────
    let passP=P.passRate;
    if(down===3&&togo>=7)passP=.88;else if(down===3&&togo>=4)passP=Math.max(passP,.72);else if(togo<=2)passP=Math.min(passP,.36);
    if(q4&&diff<0)passP+=Math.min(.24,(-diff)/36+(tlg<600?.10:0));
    if(q4&&diff>0&&!overtime)passP-=Math.min(.32,diff/35+(tlg<480?.16:0));
    else if(t>=1800&&diff>=17)passP-=.15; // comfortable second-half lead: lean on the run
    if(twoMinute&&diff<=0)passP=Math.max(passP,.86);
    if(yard>=80)passP*=clamp(.55+P.qbTDMult*.45,.75,1.12);
    passP=clamp(passP,.12,.95);
    const isPass=rng.bool(passP);
    const hurry=twoMinute||(q4&&diff<0&&tlg<480);
    const killClock=q4&&diff>0&&!overtime;
    driveStart.n++;box[side].plays++;
    const prevDown=down;
    let gained=0,clockUsed=0,turnover=null;

    if(isPass){
      const aggressive=(q4&&diff<0)||twoMinute;
      const tierShift=clutch?(P.qbTier-2)*.012+(P.clutchQB?.02:0):0;
      if(rng.bool(P.sackRate*(aggressive?1.12:1)*(prevent?.55:1))){
        let loss=rng.int(3,10);if(yard-loss<=0&&rng.bool(.75))loss=Math.max(0,yard-1);gained=-loss;box[side].sacksAllowed++;
        let sacker=null;if(rng.bool(P.sackCoverage||.6)){const cand=[...D.def.edge,...D.def.dt,...D.def.lb].filter(p=>(sackCount[p.id]||0)<(SACK_CAP[p.trueRarity]||1));if(cand.length){sacker=pick(cand.map(p=>[p,impactWeight(p,'sack')]));sackCount[sacker.id]=(sackCount[sacker.id]||0)+1;stat(sacker,'sacks');}}
        plays.push({t,o:opp(side),k:'SACK',p:sacker?.id,p2:P.off.qb?.id,y:loss,pts:0,h:score[0],a:score[1]});
        clockUsed=hurry?12:rng.int(28,38);
        if(rng.bool(.07)){turnover='FUM';stat(sacker,'forcedFumbles');}
      }else if(rng.bool(P.intRate*(aggressive?1.22+(3-P.qbTier)*.11:1)*(1-tierShift*4))){
        turnover='INT';const depth=rng.int(6,24);gained=Math.min(99-yard,depth);
        const picker=defenderFor(opp(side),'int');stat(picker,'interceptions');stat(P.off.qb,'interceptions');box[side].interceptions++;
        plays.push({t,o:opp(side),k:'INT',p:picker?.id,p2:P.off.qb?.id,y:0,pts:0,h:score[0],a:score[1]});
        clockUsed=rng.int(6,12);
      }else if(rng.bool(clamp(P.comp+tierShift-(aggressive?.03:0)+(prevent?.07:0)+(togo<=4&&down>=2?.06:0)-(togo>=12?.05:0),.35,.86))){
        const expo=-Math.log(Math.max(1e-6,rng()));
        let y=Math.round(P.ypc*(prevent?.92:1)*(.42+expo*.56*(rng.bool(.11*P.big*(prevent?.4:1))?1.9:1)));
        if(aggressive&&tlg<180)y=Math.round(y*1.1);
        // Defences adjust to a passer who is already carving them up: diminishing returns past his band.
        if(P.gamePass>P.passCap*.92)y=Math.round(y*clamp(1-(P.gamePass-P.passCap*.92)/300,.4,1));
        gained=Math.min(100-yard,Math.max(-2,y));
        const target=pick(P.rec);
        stat(P.off.qb,'passYards',gained);stat(target,'recYards',gained);box[side].passYards+=gained;P.gamePass+=gained;driveStart.py+=gained;
        if(gained>=25)plays.push({t,o:side,k:'BIG',p:P.off.qb?.id,p2:target?.id,y:gained,pass:1,pts:0,h:score[0],a:score[1]});
        if(yard+gained>=100){box[side].passTD++;stat(P.off.qb,'passTD');stat(target,'recTD');yard=100;t+=rng.int(5,12);touchdown(side,'TD',{p:P.off.qb?.id,p2:target?.id,y:gained,pass:1});endDrive('TD');if(overtime){otPossessions++;}kickoff(opp(side));if(overtime&&checkOT())break;continue;}
        if(rng.bool(.006)){turnover='FUM';}
        clockUsed=hurry?rng.int(9,16):killClock?rng.int(38,45):rng.int(30,41);
      }else{gained=0;clockUsed=rng.int(5,8);}
    }else{
      const runner=pick(P.rush);
      let y=Math.round(rng.normal(P.ypr*.86,2.6));
      if(rng.bool(.05*P.big*P.rushBig))y+=Math.round(-Math.log(Math.max(1e-6,rng()))*18);
      if(togo<=1&&rng.bool(.18))y=Math.max(y,1);
      if(yard>=94&&rng.bool(.22))y=Math.max(y,100-yard); // goal-line push
      gained=Math.min(100-yard,Math.max(-5,y));
      stat(runner,'rushYards',gained);box[side].rushYards+=gained;driveStart.ry+=gained;
      if(gained>=20)plays.push({t,o:side,k:'BIG',p:runner?.id,y:gained,pass:0,pts:0,h:score[0],a:score[1]});
      if(yard+gained>=100){box[side].rushTD++;stat(runner,'rushTD');yard=100;t+=rng.int(5,10);touchdown(side,'TD',{p:runner?.id,y:gained,pass:0});endDrive('TD');if(overtime)otPossessions++;kickoff(opp(side));if(overtime&&checkOT())break;continue;}
      if(rng.bool(P.fumRate)){turnover='FUM';const ff=defenderFor(opp(side),'sack');stat(ff,'forcedFumbles');}
      clockUsed=hurry?rng.int(14,24):killClock?rng.int(40,45):rng.int(33,42);
    }

    yard+=gained;t+=clockUsed;
    // Safety
    if(yard<=0){
      const sd=opp(side);box[sd].safeties++;addPoints(sd,2,'SAFETY',{p:defenderFor(sd,'sack')?.id});yard=0;endDrive('SAFETY');
      if(overtime){break;}
      t+=5;startDrive(sd,rng.int(30,45));continue;
    }
    if(turnover){
      if(turnover==='FUM')box[side].fumbles++;
      if(turnover==='FUM')plays.push({t,o:opp(side),k:'FUMBLE',p:null,p2:null,y:0,pts:0,h:score[0],a:score[1]});
      endDrive(turnover);if(overtime)otPossessions++;
      const sd=opp(side);
      const returnTD=rng.bool(turnover==='INT'?.055:.045);
      if(returnTD){
        const lastEv=[...plays].reverse().find(x=>x.k===turnover||x.k==='FUMBLE');
        const scorer=turnover==='INT'?(lastEv?.p?prof[sd].def.cb.concat(prof[sd].def.s,prof[sd].def.lb).find(x=>x.id===lastEv.p):null):defenderFor(sd,'sack');
        stat(scorer,'defensiveTD');box[sd].defensiveTD++;t+=rng.int(6,12);
        touchdown(sd,'DTD',{p:scorer?.id,y:rng.int(12,85),ret:turnover});
        if(overtime)break;
        kickoff(side);continue;
      }
      // Interceptions at/inside the 5 are mostly downed in the end zone for a touchback.
      if(turnover==='INT'&&yard>=95)startDrive(sd,rng.bool(.8)?20:Math.max(1,100-yard+rng.int(0,25)));
      else startDrive(sd,Math.max(1,100-yard-(turnover==='INT'?rng.int(0,18):rng.int(0,4))));
      if(overtime&&checkOT())break;
      continue;
    }
    // Down & distance
    if(gained>=togo){down=1;togo=Math.min(10,100-yard);box[side].firstDowns++;}
    else{down++;togo-=gained;}
    if(prevDown===3){box[side].thirdAtt++;if(down===1)box[side].thirdConv++;}
    if(down>4){endDrive('DOWNS');if(overtime)otPossessions++;startDrive(opp(side),100-yard);if(overtime&&checkOT())break;continue;}
  }

  // Overtime termination rules (modified sudden death: a first-possession FG
  // gives the other team a chance; any TD, or any score after both have had the ball, wins).
  function checkOT(){
    if(score[0]===score[1])return false;
    const lastScore=[...plays].reverse().find(x=>x.pts>0&&x.t>=GAME);
    if(!lastScore)return false;
    if(lastScore.k==='TD'||lastScore.k==='DTD'||lastScore.k==='XP'||lastScore.k==='XP2'||lastScore.k==='SAFETY'){gameOver=true;return true;}
    if(otPossessions>=2){gameOver=true;return true;}
    return false;
  }
  if(driveStart)endDrive('END');
  if(score[0]===score[1]){ // safety net — should be unreachable
    const side=rng.bool(.5)?0:1;box[side].fg++;addPoints(side,3,'FG',{p:prof[side].kicker?.id,y:rng.int(28,46)});
  }
  const finalT=Math.max(GAME,t);

  // ── Defensive tackles (not play-tracked; a believable distribution) ──
  for(const [D] of [[H],[A]]){
    const baseTackles={EDGE:3.2,DT:3.0,LB:5.8,CB:4.0,S:5.0};
    for(const p of [...D.edge,...D.dt,...D.lb,...D.cb,...D.s]){
      const talent=clamp(.68+(p.overall-52)*.015+rarityIndex(p.trueRarity)*.035,.62,1.55);
      const s=ps[p.id]||(ps[p.id]={});s.tackles=Math.max(1,Math.round(rng.normal((baseTackles[p.position]||3.8)*talent,1.55)));s.sacks=s.sacks||0;s.interceptions=s.interceptions||0;s.forcedFumbles=s.forcedFumbles||0;s.defensiveTD=s.defensiveTD||0;
    }
  }
  // Linemen and specialists log games too (grades, Pro Bowl and All-Pro need appearances).
  for(const U of [H,A])for(const p of [...U.ol,U.k,U.pt].filter(Boolean))ps[p.id]=ps[p.id]||{};
  // Offensive skill players appear in the box even with a quiet day.
  for(const U of [H,A]){for(const p of [U.qb,...U.hb,...U.wr,U.te].filter(Boolean)){const s=ps[p.id]||(ps[p.id]={});for(const k of ['passYards','passTD','interceptions','rushYards','rushTD','recYards','recTD'])if(p===U.qb||!['passYards','passTD','interceptions'].includes(k))s[k]=s[k]||0;}}

  const winnerSide=score[0]>score[1]?0:1;
  const lastLeadChange=(()=>{let lead=0,when=null,by=null;for(const pl of plays){if(!pl.pts)continue;const d=pl.h-pl.a,nl=d>0?1:d<0?-1:0;if(nl!==0&&nl!==lead){when=pl.t;by=nl>0?0:1;}if(nl!==0)lead=nl;}return {when,by};})();
  const flags={leadChanges,comeback:maxDeficit[winnerSide],gameWinner:lastLeadChange.by===winnerSide&&lastLeadChange.when!=null&&lastLeadChange.when>=GAME-120,ot:finalT>GAME||box[0].otPoints+box[1].otPoints>0};
  const B=(s)=>({passYards:box[s].passYards,rushYards:box[s].rushYards,turnovers:box[s].interceptions+box[s].fumbles,interceptions:box[s].interceptions,fumbles:box[s].fumbles,sacksAllowed:box[s].sacksAllowed,sacks:box[opp(s)].sacksAllowed,passTD:box[s].passTD,rushTD:box[s].rushTD,fg:box[s].fg,defensiveTD:box[s].defensiveTD,safeties:box[s].safeties,otPoints:box[s].otPoints,firstDowns:box[s].firstDowns,plays:box[s].plays,top:box[s].top,thirdConv:box[s].thirdConv,thirdAtt:box[s].thirdAtt});

  return {
    id:`G-${context.league}-${context.round}-${homeTeam.id}-${awayTeam.id}-${Math.floor(rng()*1e6)}`,
    league:context.league,stage:context.stage,round:context.round,homeId:homeTeam.id,awayId:awayTeam.id,
    homeScore:score[0],awayScore:score[1],
    homeBox:B(0),awayBox:B(1),
    playerStats:ps,
    drives,plays,quarters:{home:quarters[0],away:quarters[1]},flags,xm,length:finalT,
    engine:2
  };
}
