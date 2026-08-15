import { makeRng } from './rng.js';
import { simulateGame, teamUnitRatings } from './match.js';
import { RARITIES, RARITY_META, POSITIONS, createPlayer, staffMember } from './generate.js';
import { COLLEGES } from '../data/colleges.js';
import { FIRST_NAMES, LAST_NAMES } from '../data/names.js';

const TARGETS={Generational:3,Legend:12,Epic:20,Rare:50,Uncommon:80};
const rarityRank=r=>RARITIES.indexOf(r);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const sum=(arr,f=x=>x)=>arr.reduce((s,x)=>s+f(x),0);

function roster(universe,teamId){ return universe.players.filter(p=>!p.retired&&p.teamId===teamId); }
function teamById(universe,id){ return [...universe.teams.nfl,...universe.teams.ufl,...universe.teams.college].find(t=>t.id===id); }
function playerById(universe,id){ return universe.players.find(p=>p.id===id); }

function resetCompetition(universe, league){
  universe.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'].forEach(t=>{t.current={wins:0,losses:0,pf:0,pa:0,yards:0};});
  universe.players.filter(p=>p.league===league && !p.retired).forEach(p=>{p.currentSeason={games:0,passYards:0,passTD:0,interceptions:0,rushYards:0,rushTD:0,recYards:0,recTD:0,tackles:0,sacks:0,defInterceptions:0,forcedFumbles:0,defensiveTD:0};});
}

function applyGame(universe,game){
  const h=teamById(universe,game.homeId), a=teamById(universe,game.awayId);
  h.current.pf+=game.homeScore; h.current.pa+=game.awayScore; h.current.yards+=game.homeBox.passYards+game.homeBox.rushYards;
  a.current.pf+=game.awayScore; a.current.pa+=game.homeScore; a.current.yards+=game.awayBox.passYards+game.awayBox.rushYards;
  if(game.homeScore>game.awayScore){h.current.wins++;a.current.losses++;}else{a.current.wins++;h.current.losses++;}
  for(const [id,s] of Object.entries(game.playerStats)){
    const p=playerById(universe,id); if(!p) continue;
    if(!p.currentSeason) p.currentSeason={games:0,passYards:0,passTD:0,interceptions:0,rushYards:0,rushTD:0,recYards:0,recTD:0,tackles:0,sacks:0,defInterceptions:0,forcedFumbles:0,defensiveTD:0};
    p.currentSeason.games++;
    p.currentSeason.passYards+=(s.passYards||0); p.currentSeason.passTD+=(s.passTD||0); p.currentSeason.interceptions+=(s.interceptions||0);
    p.currentSeason.rushYards+=(s.rushYards||0); p.currentSeason.rushTD+=(s.rushTD||0); p.currentSeason.recYards+=(s.recYards||0); p.currentSeason.recTD+=(s.recTD||0);
    p.currentSeason.tackles+=(s.tackles||0); p.currentSeason.sacks+=(s.sacks||0); p.currentSeason.defInterceptions+=(s.interceptions && !s.passYards ? s.interceptions:0); p.currentSeason.forcedFumbles+=(s.forcedFumbles||0); p.currentSeason.defensiveTD+=(s.defensiveTD||0);
  }
}

function roundRobinRounds(teams){
  const arr=[...teams]; if(arr.length%2) arr.push(null);
  const fixed=arr[0], rest=arr.slice(1), rounds=[];
  for(let r=0;r<arr.length-1;r++){
    const line=[fixed,...rest], pairs=[];
    for(let i=0;i<line.length/2;i++){ const a=line[i],b=line[line.length-1-i]; if(a&&b) pairs.push([a,b]); }
    rounds.push(pairs); rest.unshift(rest.pop());
  }
  return rounds;
}


function buildNFLWeeks(teams,rng){
  const byeWeeks=[5,6,7,8,9,10,11,12];
  const shuffled=rng.shuffle(teams); const byes=new Map();
  byeWeeks.forEach((w,i)=>shuffled.slice(i*4,i*4+4).forEach(t=>byes.set(t.id,w)));
  const used=new Map(teams.map(t=>[t.id,new Set()])); const weeks=[];
  for(let week=1;week<=18;week++){
    const active=teams.filter(t=>byes.get(t.id)!==week); let finalPairs=null;
    for(let attempt=0;attempt<600&&!finalPairs;attempt++){
      const pool=rng.shuffle(active); const pairs=[]; let failed=false;
      while(pool.length){
        const a=pool.pop(); const candidates=pool.filter(b=>!used.get(a.id).has(b.id));
        if(!candidates.length){failed=true;break;}
        const b=rng.weighted(candidates.map(x=>[x,x.division===a.division&&x.conference===a.conference?3.4:x.conference===a.conference?1.5:1]));
        pool.splice(pool.indexOf(b),1); pairs.push([a,b]);
      }
      if(!failed) finalPairs=pairs;
    }
    if(!finalPairs){
      // Extremely unlikely fallback: permit one repeat rather than break the season.
      const pool=rng.shuffle(active); finalPairs=[]; while(pool.length){finalPairs.push([pool.pop(),pool.pop()]);}
    }
    finalPairs.forEach(([a,b])=>{used.get(a.id).add(b.id);used.get(b.id).add(a.id)}); weeks.push(finalPairs);
  }
  return weeks;
}

function simulateSchedule(universe,rng,league,teams,rounds){
  const games=[];
  rounds.forEach((pairs,idx)=>pairs.forEach(([a,b],j)=>{
    const home=(idx+j)%2===0?a:b, away=home===a?b:a;
    const g=simulateGame(rng,home,away,roster(universe,home.id),roster(universe,away.id),{league,stage:'Regular Season',round:idx+1});
    applyGame(universe,g); games.push(g);
  }));
  return games;
}

function playoffGame(universe,rng,league,home,away,stage,round){
  const g=simulateGame(rng,home,away,roster(universe,home.id),roster(universe,away.id),{league,stage,round});
  applyGame(universe,g); return g;
}
const winner=(g,u)=>teamById(u,g.homeScore>g.awayScore?g.homeId:g.awayId);

function standings(teams){ return [...teams].sort((a,b)=>b.current.wins-a.current.wins || (b.current.pf-b.current.pa)-(a.current.pf-a.current.pa) || b.current.pf-a.current.pf); }

function simulateNFL(universe,rng){
  const teams=universe.teams.nfl; resetCompetition(universe,'NFL');
  const regular=simulateSchedule(universe,rng,'NFL',teams,buildNFLWeeks(teams,rng));
  const postseason=[];
  const confs=['AFC','NFC'].map(conf=>standings(teams.filter(t=>t.conference===conf)).slice(0,7));
  const confChamps=[];
  for(const seeds of confs){
    seeds.forEach(t=>t.history.playoffs++);
    const wc=[playoffGame(universe,rng,'NFL',seeds[1],seeds[6],'Wild Card',1),playoffGame(universe,rng,'NFL',seeds[2],seeds[5],'Wild Card',1),playoffGame(universe,rng,'NFL',seeds[3],seeds[4],'Wild Card',1)]; postseason.push(...wc);
    const survivors=[seeds[0],...wc.map(g=>winner(g,universe))].sort((a,b)=>seeds.indexOf(a)-seeds.indexOf(b));
    const div1=playoffGame(universe,rng,'NFL',survivors[0],survivors[3],'Divisional',2), div2=playoffGame(universe,rng,'NFL',survivors[1],survivors[2],'Divisional',2); postseason.push(div1,div2);
    const c1=winner(div1,universe),c2=winner(div2,universe); const cc=playoffGame(universe,rng,'NFL',c1,c2,'Conference Championship',3); postseason.push(cc); confChamps.push(winner(cc,universe));
  }
  const sb=playoffGame(universe,rng,'NFL',confChamps[0],confChamps[1],'Super Bowl',4); postseason.push(sb); const champion=winner(sb,universe); champion.history.championships++;
  return {regular,postseason,champion,standings:standings(teams)};
}

function simulateCollege(universe,rng){
  const teams=universe.teams.college; resetCompetition(universe,'COLLEGE');
  const rounds=roundRobinRounds(rng.shuffle(teams)).slice(0,12);
  const regular=simulateSchedule(universe,rng,'COLLEGE',teams,rounds);
  const ranked=standings(teams).sort((a,b)=>{
    const score=t=>t.current.wins*10+(t.current.pf-t.current.pa)/35+t.prestige/18;
    return score(b)-score(a);
  }).slice(0,12); ranked.forEach(t=>t.history.playoffs++);
  const postseason=[];
  const r5=playoffGame(universe,rng,'COLLEGE',ranked[4],ranked[11],'CFP First Round',1), r6=playoffGame(universe,rng,'COLLEGE',ranked[5],ranked[10],'CFP First Round',1), r7=playoffGame(universe,rng,'COLLEGE',ranked[6],ranked[9],'CFP First Round',1), r8=playoffGame(universe,rng,'COLLEGE',ranked[7],ranked[8],'CFP First Round',1); postseason.push(r5,r6,r7,r8);
  const q1=playoffGame(universe,rng,'COLLEGE',ranked[0],winner(r8,universe),'CFP Quarterfinal',2),q2=playoffGame(universe,rng,'COLLEGE',ranked[1],winner(r7,universe),'CFP Quarterfinal',2),q3=playoffGame(universe,rng,'COLLEGE',ranked[2],winner(r6,universe),'CFP Quarterfinal',2),q4=playoffGame(universe,rng,'COLLEGE',ranked[3],winner(r5,universe),'CFP Quarterfinal',2); postseason.push(q1,q2,q3,q4);
  const s1=playoffGame(universe,rng,'COLLEGE',winner(q1,universe),winner(q4,universe),'CFP Semifinal',3),s2=playoffGame(universe,rng,'COLLEGE',winner(q2,universe),winner(q3,universe),'CFP Semifinal',3); postseason.push(s1,s2);
  const final=playoffGame(universe,rng,'COLLEGE',winner(s1,universe),winner(s2,universe),'National Championship',4); postseason.push(final); const champion=winner(final,universe); champion.history.championships++;
  return {regular,postseason,champion,ranked};
}

function simulateUFL(universe,rng){
  const teams=universe.teams.ufl; resetCompetition(universe,'UFL');
  const rr=roundRobinRounds(rng.shuffle(teams)); const rounds=[...rr,...rr.slice(0,3).map(round=>round.map(([a,b])=>[b,a]))];
  const regular=simulateSchedule(universe,rng,'UFL',teams,rounds);
  const rank=standings(teams); rank.slice(0,4).forEach(t=>t.history.playoffs++);
  const s1=playoffGame(universe,rng,'UFL',rank[0],rank[3],'UFL Semifinal',1),s2=playoffGame(universe,rng,'UFL',rank[1],rank[2],'UFL Semifinal',1); const final=playoffGame(universe,rng,'UFL',winner(s1,universe),winner(s2,universe),'UFL Championship',2); const champion=winner(final,universe); champion.history.championships++;
  return {regular,postseason:[s1,s2,final],champion,standings:rank};
}

function playerProduction(p){
  const s=p.currentSeason||{}; const pos=p.position;
  if(pos==='QB') return (s.passYards||0)/35+(s.passTD||0)*6-(s.interceptions||0)*3+(s.rushYards||0)/28+(s.rushTD||0)*5;
  if(['HB','FB'].includes(pos)) return (s.rushYards||0)/10+(s.rushTD||0)*7+(s.recYards||0)/18+(s.recTD||0)*6;
  if(['WR','TE'].includes(pos)) return (s.recYards||0)/10+(s.recTD||0)*8;
  if(['EDGE','DT','LB','CB','S'].includes(pos)) return (s.tackles||0)*.35+(s.sacks||0)*7+(s.defInterceptions||0)*8+(s.forcedFumbles||0)*6+(s.defensiveTD||0)*10;
  return 10;
}

function pickAward(universe,league,name){
  const candidates=universe.players.filter(p=>!p.retired&&p.league===league&&p.currentSeason);
  let best=null,bestScore=-1;
  for(const p of candidates){
    const t=teamById(universe,p.teamId); const winPct=t?(t.current.wins/Math.max(1,t.current.wins+t.current.losses)):.5;
    const positionWeight=p.position==='QB'?1.13:['WR','HB','EDGE','CB'].includes(p.position)?1.02:.92;
    const repeatFatigue=Math.pow(.80,p.mvpWins||0); // not a hard ban; extraordinary seasons can still win repeatedly.
    const score=playerProduction(p)*positionWeight*(.72+winPct*.5)*repeatFatigue;
    if(score>bestScore){bestScore=score;best=p;}
  }
  if(best){ best.awards.push({year:universe.year,name,league}); if(name.includes('MVP')||name==='Heisman Trophy') best.mvpWins=(best.mvpWins||0)+1; }
  return best;
}

function extractRecords(universe,games){
  const push=(category,value,playerId,game,teamId)=>{
    const rec={category,value,playerId,teamId,year:universe.year,league:game.league,stage:game.stage,round:game.round,gameId:game.id};
    const same=universe.records.filter(r=>r.category===category&&r.league===game.league); same.push(rec); same.sort((a,b)=>b.value-a.value);
    const keep=new Set(same.slice(0,10).map(r=>r===rec?'NEW':`${r.year}-${r.gameId}-${r.playerId||r.teamId}`));
    universe.records=universe.records.filter(r=>!(r.category===category&&r.league===game.league)); universe.records.push(...same.slice(0,10));
  };
  for(const g of games){
    push('Team Points',g.homeScore,null,g,g.homeId);push('Team Points',g.awayScore,null,g,g.awayId);
    push('Team Yards',g.homeBox.passYards+g.homeBox.rushYards,null,g,g.homeId);push('Team Yards',g.awayBox.passYards+g.awayBox.rushYards,null,g,g.awayId);
    for(const [pid,s] of Object.entries(g.playerStats)){
      const p=playerById(universe,pid); if(!p)continue;
      if((s.passYards||0)>0) push('Passing Yards',s.passYards,pid,g,p.teamId);
      if((s.rushYards||0)>0) push('Rushing Yards',s.rushYards,pid,g,p.teamId);
      if((s.recYards||0)>0) push('Receiving Yards',s.recYards,pid,g,p.teamId);
      if((s.sacks||0)>0) push('Sacks',s.sacks,pid,g,p.teamId);
    }
  }
}

function archiveSeasonStats(universe){
  universe.players.filter(p=>p.currentSeason).forEach(p=>{
    p.stats.seasons.push({year:universe.year,league:p.league,teamId:p.teamId,...p.currentSeason});
    p.stats.career.passYards=(p.stats.career.passYards||0)+(p.currentSeason.passYards||0); p.stats.career.passTD=(p.stats.career.passTD||0)+(p.currentSeason.passTD||0);
    p.stats.career.rushYards=(p.stats.career.rushYards||0)+(p.currentSeason.rushYards||0); p.stats.career.rushTD=(p.stats.career.rushTD||0)+(p.currentSeason.rushTD||0);
    p.stats.career.recYards=(p.stats.career.recYards||0)+(p.currentSeason.recYards||0); p.stats.career.recTD=(p.stats.career.recTD||0)+(p.currentSeason.recTD||0);
    p.stats.career.sacks=(p.stats.career.sacks||0)+(p.currentSeason.sacks||0); p.stats.career.tackles=(p.stats.career.tackles||0)+(p.currentSeason.tackles||0);
  });
  [...universe.teams.nfl,...universe.teams.ufl,...universe.teams.college].forEach(t=>t.history.seasons.push({year:universe.year,...t.current}));
}

function addNews(universe,type,importance,title,body,teamId=null,playerId=null){ universe.meta=universe.meta||{}; universe.meta.nextNewsId=universe.meta.nextNewsId||1; universe.news.unshift({id:`N${universe.meta.nextNewsId++}`,year:universe.year,type,importance,title,body,teamId,playerId}); universe.news=universe.news.slice(0,250); }

function processRetirements(universe,rng){
  const retired=[];
  for(const p of universe.players.filter(p=>!p.retired&&p.league!=='COLLEGE')){
    p.proYear=(p.proYear||0)+1; p.age++;
    const forced=p.proYear>=p.careerYears;
    const early=p.proYear>=7 && rng.bool(Math.max(0,(p.proYear-p.careerYears+2)*.06));
    if(forced||early){ p.retired=true;p.teamId=null;retired.push(p); if(rarityRank(p.trueRarity)>=3) addNews(universe,'RETIREMENT',75,`${p.name} retires`,`${p.trueRarity} ${p.position} closes a ${p.proYear}-season professional career.`,null,p.id); }
  }
  return retired;
}

function developPlayer(p,rng){
  const path=p.developmentPath;
  const cfg={
    'Early Meteor':[2,1.5,2.4],'Sustainable Prime':[5,1.0,.9],'Late Bloomer':[7,.65,.8],'Iron Career':[6,.7,.45],'Volatile Star':[4,1.0,1.2],'Short Fuse':[2,1.2,2.6],'Classic Arc':[5,.9,1.25],'Slow Burn':[7,.55,.7]
  }[path]||[5,.9,1.2];
  const year=p.league==='COLLEGE'?(p.collegeYear||1):(p.proYear||1);
  let delta=year<=cfg[0]?cfg[1]:-cfg[2]; if(path==='Volatile Star') delta+=rng.normal(0,2.2); else delta+=rng.normal(0,.7);
  const ceiling=p.potential||99; p.overall=Math.round(clamp(p.overall+delta,45,Math.max(p.overall,ceiling))); p.peakOverall=Math.max(p.peakOverall||p.overall,p.overall);
}

function contractAndFreeAgency(universe,rng){
  universe.freeAgents=[];
  for(const p of universe.players.filter(p=>!p.retired&&['NFL','UFL'].includes(p.league)&&p.contract)){
    if(p.draftYear===universe.year) continue;
    p.contract.years--;
    if(p.contract.years<=0){
      const t=teamById(universe,p.teamId); const room=t?t.capLimit-t.capUsed:0; const keepChance={Generational:.78,Legend:.70,Epic:.58,Rare:.48,Uncommon:.40,Common:.30}[p.trueRarity];
      const desired=Math.max(.4,p.contract.annual*(1+rng.range(-.08,.22)));
      if(t&&rng.bool(keepChance)&&room+Math.max(0,p.contract.annual)>=desired){ p.contract={years:rng.int(2,5),annual:Math.round(desired*10)/10}; addNews(universe,'RENEWAL',rarityRank(p.trueRarity)>=3?55:25,`${t.name} renews ${p.name}`,`${p.position} signs a ${p.contract.years}-year extension.`,t.id,p.id); }
      else { if(t)t.capUsed=Math.max(0,t.capUsed-p.contract.annual); p.teamId=null;p.contract=null;universe.freeAgents.push(p.id); }
    }
  }
  // Recompute cap after renewals.
  universe.teams.nfl.forEach(t=>t.capUsed=Math.round(sum(roster(universe,t.id),p=>p.contract?.annual||0)*10)/10);
  const fa=universe.players.filter(p=>universe.freeAgents.includes(p.id)).sort((a,b)=>rarityRank(b.trueRarity)-rarityRank(a.trueRarity)||b.overall-a.overall);
  for(const p of fa){
    const candidates=universe.teams.nfl.map(t=>({t,room:t.capLimit-t.capUsed,need:positionNeed(universe,t,p.position)})).filter(x=>x.room>1).sort((a,b)=>(b.room+b.need*5+b.t.gm.overall*.12)-(a.room+a.need*5+a.t.gm.overall*.12));
    let choices=candidates.slice(0,Math.max(3,Math.min(10,candidates.length)));
    if(!choices.length && rarityRank(p.trueRarity)>=3){
      // Anti-stranding: contenders will cut a low-value Common player to create a real market for elite talent.
      for(const t of universe.teams.nfl.sort((a,b)=>b.prestige-a.prestige)){
        const cut=roster(universe,t.id).filter(x=>x.trueRarity==='Common'&&x.position!==p.position).sort((a,b)=>a.overall-b.overall)[0];
        if(cut){t.capUsed-=cut.contract?.annual||0;cut.teamId=null;cut.retired=true;choices=[{t,room:t.capLimit-t.capUsed,need:positionNeed(universe,t,p.position)}];break;}
      }
    }
    if(choices.length){
      const bid=choices[0]; const base={Generational:38,Legend:28,Epic:18,Rare:10,Uncommon:5,Common:2}[p.trueRarity]; const annual=Math.min(bid.room,Math.round(base*({QB:1.45,WR:1.15,EDGE:1.12,CB:1.08,HB:.78}[p.position]||1)*10)/10);
      if(annual>=.8){ p.teamId=bid.t.id;p.league='NFL';p.contract={years:rng.int(2,5),annual};bid.t.capUsed+=annual;universe.freeAgents=universe.freeAgents.filter(id=>id!==p.id); addNews(universe,'FREE AGENCY',rarityRank(p.trueRarity)>=3?82:rarityRank(p.trueRarity)>=2?55:25,`${bid.t.name} signs ${p.name}`,`${p.trueRarity} ${p.position} joins on a ${p.contract.years}-year deal.`,bid.t.id,p.id); }
    }
    if(!p.teamId && rarityRank(p.trueRarity)>=1){
      const u=universe.teams.ufl.sort((a,b)=>roster(universe,a.id).length-roster(universe,b.id).length)[0]; p.teamId=u.id;p.league='UFL';p.contract={years:rng.int(1,2),annual:rng.range(.4,1.8)};universe.freeAgents=universe.freeAgents.filter(id=>id!==p.id); addNews(universe,'UFL',rarityRank(p.trueRarity)>=3?70:35,`${p.name} lands in the UFL`,`${p.trueRarity} ${p.position} signs with ${u.name}.`,u.id,p.id);
    }
  }
}

function positionNeed(universe,team,pos){
  const same=roster(universe,team.id).filter(p=>p.position===pos); if(!same.length)return 1;
  const best=Math.max(...same.map(p=>p.overall)); return clamp((78-best)/25,0,1);
}

function draftDeclarations(universe,rng){
  const declared=[];
  for(const p of universe.players.filter(p=>!p.retired&&p.league==='COLLEGE')){
    if(p.collegeYear>=4 || (p.collegeYear===3&&['Legend','Generational'].includes(p.trueRarity)&&rng.bool(.58))){p.declared=true;declared.push(p);}
  }
  return declared;
}

function publicDraftValue(p){ const prestige=COLLEGES.find(c=>c.id===p.teamId)?.prestige||70; return (p.scouting?.expectedTier||0)*24+(p.currentSeason?playerProduction(p)*.05:0)+prestige*.08; }
function draft(universe,rng,declared){
  const order=[...universe.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins || (a.current.pf-a.current.pa)-(b.current.pf-b.current.pa));
  const available=[...declared], reveals=[]; let overallPick=1;
  for(let round=1;round<=3;round++){
    for(const team of order){
      if(!available.length)break;
      let bestIdx=0,bestScore=-Infinity;
      available.forEach((p,i)=>{
        const need=positionNeed(universe,team,p.position); const scoutNoise=(team.gm?.ratings?.scouting||team.gm?.overall||60)/100*rng.normal(0,3.2); // AI never sees true rarity here.
        const value=publicDraftValue(p)+need*11+scoutNoise+(['QB','EDGE','WR','CB'].includes(p.position)?3:0);
        if(value>bestScore){bestScore=value;bestIdx=i;}
      });
      const p=available.splice(bestIdx,1)[0];
      const priorTeam=p.teamId, scouting={...p.scouting,probs:{...p.scouting.probs}};
      p.revealed=true;p.drafted=true;p.draftYear=universe.year;p.draftRound=round;p.draftPick=overallPick;p.league='NFL';p.teamId=team.id;p.collegeYear=null;p.proYear=0;p.age=Math.max(20,p.age);p.contract={years:4,annual:round===1?8.5:round===2?4.2:2.2}; team.capUsed+=p.contract.annual;
      const reveal={year:universe.year,pick:overallPick,round,teamId:team.id,collegeId:priorTeam,playerId:p.id,scouting,actualRarity:p.trueRarity,developmentPath:p.developmentPath,careerYears:p.careerYears}; reveals.push(reveal);
      if(rarityRank(p.trueRarity)>=4 || Math.abs((p.scouting?.expectedTier||0)-rarityRank(p.trueRarity))>=1.7) addNews(universe,'DRAFT',88,`${team.name} takes ${p.name} at No. ${overallPick}`,`God View reveals ${p.trueRarity} talent with a ${p.developmentPath} career arc.`,team.id,p.id);
      overallPick++;
    }
  }
  universe.lastDraftReveal=reveals;universe.draftHistory.unshift({year:universe.year,reveals});
  // Remaining declarants: useful talent gets a UFL/NFL pathway; most Common prospects leave the tracked universe.
  for(const p of available){
    if(rarityRank(p.trueRarity)>=1){ const u=[...universe.teams.ufl].sort((a,b)=>roster(universe,a.id).length-roster(universe,b.id).length)[0];p.revealed=true;p.league='UFL';p.teamId=u.id;p.collegeYear=null;p.proYear=0;p.contract={years:1,annual:.7+rarityRank(p.trueRarity)*.22}; }
    else {p.retired=true;p.teamId=null;}
  }
  return reveals;
}

function blockbusterTrade(universe,rng){
  const rankedTeams=[...universe.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins);
  const lowerHalf=new Set(rankedTeams.slice(0,16).map(t=>t.id));
  let stars=universe.players.filter(p=>!p.retired&&p.league==='NFL'&&rarityRank(p.trueRarity)>=3&&lowerHalf.has(p.teamId)&&p.draftYear!==universe.year);
  if(!stars.length) stars=universe.players.filter(p=>!p.retired&&p.league==='NFL'&&rarityRank(p.trueRarity)>=3&&p.draftYear!==universe.year);
  if(!stars.length)return null;
  // Prefer stars nearing a contract decision, but guarantee one headline-level market event when possible.
  stars.sort((a,b)=>(a.contract?.years||9)-(b.contract?.years||9)||rarityRank(b.trueRarity)-rarityRank(a.trueRarity));
  const p=rng.pick(stars.slice(0,Math.min(8,stars.length))); const from=teamById(universe,p.teamId);
  const contenders=[...universe.teams.nfl].filter(t=>t.id!==from.id&&t.current.wins>=8).sort((a,b)=>(positionNeed(universe,b,p.position)*10+(b.capLimit-b.capUsed)+b.gm.overall*.08)-(positionNeed(universe,a,p.position)*10+(a.capLimit-a.capUsed)+a.gm.overall*.08));
  let to=contenders[0]; if(!to) to=universe.teams.nfl.find(t=>t.id!==from.id); if(!to)return null;
  const salary=p.contract?.annual||5;
  // Blockbuster buyers are allowed to go temporarily over the tracked cap; roster trimming/cuts resolve it immediately afterward.
  p.teamId=to.id; from.capUsed=Math.max(0,from.capUsed-salary);to.capUsed+=salary;
  const tx={year:universe.year,type:'Trade',playerId:p.id,fromId:from.id,toId:to.id,detail:'Blockbuster: future draft capital'};universe.transactions.unshift(tx);addNews(universe,'BLOCKBUSTER',94,`${to.name} acquires ${p.name}`,`${p.trueRarity} ${p.position} moves from ${from.name} in the offseason's blockbuster.`,to.id,p.id); return tx;
}

function trimNFLRosters(universe){
  universe.teams.nfl.forEach(t=>{
    const cutOne=()=>{
      const candidates=roster(universe,t.id).filter(p=>p.trueRarity!=='Generational').sort((a,b)=>rarityRank(a.trueRarity)-rarityRank(b.trueRarity)||a.overall-b.overall);
      const p=candidates[0]; if(!p)return false;
      t.capUsed=Math.max(0,t.capUsed-(p.contract?.annual||0)); p.teamId=null;
      if(rarityRank(p.trueRarity)>=1) universe.freeAgents.push(p.id); else p.retired=true;
      return true;
    };
    while(roster(universe,t.id).length>27) if(!cutOne()) break;
    while(t.capUsed>t.capLimit) if(!cutOne()) break;
    t.capUsed=Math.round(sum(roster(universe,t.id),p=>p.contract?.annual||0)*10)/10;
  });
}

function staffCarousel(universe,rng){
  const used=new Set();
  for(const t of universe.teams.nfl){
    const bad=t.current.wins<=5, dynasty=t.history.championships>0&&t.current.wins>=11;
    if(bad&&rng.bool(.34)){
      const old=t.hc;t.hc=staffMember(rng,used,'HC',t.id);addNews(universe,'COACHING',60,`${t.name} changes head coach`,`${old.name} is out after a ${t.current.wins}-${t.current.losses} season. ${t.hc.name} takes over.`,t.id,null);
    }
    if(dynasty&&rng.bool(.28)){
      const role=rng.bool(.5)?'oc':'dc', old=t[role];t[role]=staffMember(rng,used,role.toUpperCase(),t.id);addNews(universe,'COACHING',55,`${t.name} loses a coordinator`,`${old.name} departs after success; ${t[role].name} joins the staff.`,t.id,null);
    }
  }
}

function replenishFreshmen(universe,rng,count){
  const active=universe.players.filter(p=>!p.retired); const counts={};RARITIES.forEach(r=>counts[r]=active.filter(p=>p.trueRarity===r).length);
  const needs={};Object.entries(TARGETS).forEach(([r,n])=>needs[r]=Math.max(0,n-(counts[r]||0)));
  const used=new Set(universe.players.map(p=>p.name)); const slots=[];
  const programs=universe.teams.college;
  for(let i=0;i<count;i++){
    const program=rng.weighted(programs.map(p=>[p,Math.pow(p.prestige/100,2.7)*3+.35]));
    const pos=rng.weighted([['QB',12],['WR',16],['HB',10],['TE',5],['OT',8],['OG',5],['C',3],['EDGE',9],['DT',6],['LB',8],['CB',10],['S',6],['K',1],['P',1]]);
    slots.push({league:'COLLEGE',teamId:program.id,position:pos,collegeYear:1,programPrestige:program.prestige});
  }
  // Place missing elite tiers preferentially at high-prestige programs/impact positions, then fill Common.
  const assigned=Array(count).fill('Common'), available=new Set(slots.map((_,i)=>i));
  for(const rarity of ['Generational','Legend','Epic','Rare','Uncommon']){
    for(let n=0;n<Math.min(needs[rarity]||0,available.size);n++){
      const weights=[...available].map(i=>{const s=slots[i];let w=Math.pow(s.programPrestige/100,4)*2+.1;if(rarityRank(rarity)>=3&&['QB','WR','HB','CB','EDGE'].includes(s.position))w*=2.5;return [i,w];});
      const pick=rng.weighted(weights);assigned[pick]=rarity;available.delete(pick);
    }
  }
  slots.forEach((s,i)=>universe.players.push(createPlayer(s,assigned[i],rng,used,universe.meta.nextPlayerId++)));
}

function advanceCollege(universe,rng){
  let departures=0;
  for(const p of universe.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&!p.declared)){
    developPlayer(p,rng);p.collegeYear++;p.age++;
    if(p.collegeYear>4){p.declared=true;departures++;}
  }
  return departures;
}

function offseason(universe,rng,awards){
  processRetirements(universe,rng);
  universe.players.filter(p=>!p.retired&&p.league!=='COLLEGE').forEach(p=>developPlayer(p,rng));
  staffCarousel(universe,rng);
  contractAndFreeAgency(universe,rng);
  const declared=draftDeclarations(universe,rng); const declareCount=declared.length;
  const reveals=draft(universe,rng,declared);
  blockbusterTrade(universe,rng);trimNFLRosters(universe);
  // Move returning college players forward one class. Declared players already left college.
  universe.players.filter(p=>!p.retired&&p.league==='COLLEGE').forEach(p=>{developPlayer(p,rng);p.collegeYear=Math.min(4,(p.collegeYear||1)+1);p.age++;});
  replenishFreshmen(universe,rng,Math.max(130,Math.min(160,declareCount||140)));
  return reveals;
}

function summarizeSeason(universe,nfl,college,ufl,awards){
  const summary={year:universe.year,nflChampionId:nfl.champion.id,collegeChampionId:college.champion.id,uflChampionId:ufl.champion.id,nflMvpId:awards.nfl?.id,heismanId:awards.college?.id,uflMvpId:awards.ufl?.id};
  universe.seasonHistory.unshift(summary);
  addNews(universe,'CHAMPIONSHIP',100,`${nfl.champion.name} wins the Super Bowl`,`The ${nfl.champion.name} are Year ${universe.year} NFL champions.`,nfl.champion.id,null);
  addNews(universe,'COLLEGE',90,`${college.champion.name} wins the national championship`,`A new college champion is crowned in Year ${universe.year}.`,college.champion.id,null);
  addNews(universe,'UFL',70,`${ufl.champion.name} wins the UFL Championship`,`The spring league title belongs to ${ufl.champion.name}.`,ufl.champion.id,null);
  return summary;
}

export function simulateYear(universe){
  const u=structuredClone(universe); const rng=makeRng(u.rngState||u.seed);
  u.phase='Simulating';u.currentGames=[];
  const ufl=simulateUFL(u,rng), college=simulateCollege(u,rng), nfl=simulateNFL(u,rng);
  const awards={nfl:pickAward(u,'NFL','NFL MVP'),college:pickAward(u,'COLLEGE','Heisman Trophy'),ufl:pickAward(u,'UFL','UFL MVP')};
  [awards.nfl,awards.college,awards.ufl].filter(Boolean).forEach((p,i)=>addNews(u,'AWARD',i===0?88:75,`${p.name} wins ${i===0?'NFL MVP':i===1?'the Heisman Trophy':'UFL MVP'}`,`${p.position} ${p.name} caps a standout Year ${u.year}.`,p.teamId,p.id));
  u.currentGames=[...ufl.regular,...ufl.postseason,...college.regular,...college.postseason,...nfl.regular,...nfl.postseason];
  extractRecords(u,u.currentGames);archiveSeasonStats(u);summarizeSeason(u,nfl,college,ufl,awards);
  offseason(u,rng,awards);
  u.phase='Offseason Complete';u.rngState=rng.state();u.year++;
  return u;
}

export function getStandings(universe,league){ const list=universe.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college']; return standings(list); }
export function getTeamStrength(universe,teamId){ const t=teamById(universe,teamId); if(!t)return null; const r=roster(universe,teamId); const units=teamUnitRatings(t,r); return Math.round((units.passOff+units.rushOff+units.passDef+units.rushDef)/4); }
export function getRoster(universe,teamId){ return roster(universe,teamId); }
export function findTeam(universe,id){ return teamById(universe,id); }
export function findPlayer(universe,id){ return playerById(universe,id); }
