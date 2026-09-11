import { makeRng } from './rng.js';
import { simulateGame, teamUnitRatings } from './match.js';
import { RARITIES, RARITY_META, NFL_ROSTER, createPlayer, staffMember, ensureDevelopmentProfile, developmentOverall, ELITE_QB_FLOOR, TOP_QB_FLOOR, rebalanceEliteQuarterbacks } from './generate.js';
import { COLLEGES } from '../data/colleges.js';
import { ensurePlayerIdentity, assignUniverseFaceAssets } from '../data/identity.js';

const TARGETS={Generational:3,Legend:12,Epic:20,Rare:50,Uncommon:80};
const LEGACY_OFFSEASON_STAGES=['Coach Market','College Transfers','Retirements & Declarations','Hall of Fame & Legacy','Free Agency','Draft','Trades & UFL','Development & New Class'];
export const OFFSEASON_STAGES=['Coach Market','College Transfers','Retirements & Declarations','Hall of Fame & Legacy','Draft','Trades & UFL','Development & New Class','Roster Cuts & Free Agency'];
const OFFENSE=new Set(['QB','HB','FB','WR','TE','OT','OG','C','K','P']);
const DEFENSE=new Set(['EDGE','DT','LB','CB','S']);
const rarityRank=r=>RARITIES.indexOf(r);
const NFL_POSITION_TARGETS=NFL_ROSTER.reduce((m,pos)=>(m[pos]=(m[pos]||0)+1,m),{});
const COMPATIBLE_POSITIONS={QB:[],HB:['FB'],FB:['HB','TE'],WR:['TE'],TE:['WR','FB'],OT:['OG','C'],OG:['C','OT'],C:['OG'],EDGE:['LB','DT'],DT:['EDGE'],LB:['EDGE','S'],CB:['S'],S:['CB','LB'],K:['P'],P:['K']};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const sum=(arr,f=x=>x)=>arr.reduce((s,x)=>s+f(x),0);
const allTeams=u=>[...u.teams.nfl,...u.teams.ufl,...u.teams.college];
function roster(u,teamId,league=null){return u.players.filter(p=>!p.retired&&p.teamId===teamId&&(!league||p.league===league))}
function teamById(u,id,league=null){const pool=league==='NFL'?u.teams.nfl:league==='UFL'?u.teams.ufl:league==='COLLEGE'?u.teams.college:allTeams(u);return pool.find(t=>t.id===id)}
function playerById(u,id){return u.players.find(p=>p.id===id)}
function staffKey(role){return role==='OWNER'?'owner':role==='GM'?'gm':role.toLowerCase()}
function staffSalary(role,rarity,overall){const b={HC:5.5,OC:2.2,DC:2.2,GM:3.5,OWNER:0}[role]||1.5;return Math.round(b*(.65+Math.max(0,rarityRank(rarity))*.18)*(overall/75)*10)/10}
function normalizeStaff(s,teamId,role){if(!s)return null;s.teamId=teamId;s.role=role;s.history=s.history||[{year:1,teamId,role,event:'Initial role'}];s.contractYears=s.contractYears??3;s.salary=s.salary??staffSalary(role,s.rarity,s.overall);s.freeAgent=!!s.freeAgent;s.yearsCareer=s.yearsCareer||1;s.careerLength=s.careerLength||18;if(s.careerLength<=s.yearsCareer)s.careerLength=s.yearsCareer+Math.max(3,Math.min(8,25-s.yearsCareer));return s}

const emptySeasonStats=()=>({games:0,passYards:0,passTD:0,interceptions:0,rushYards:0,rushTD:0,recYards:0,recTD:0,tackles:0,sacks:0,defInterceptions:0,forcedFumbles:0,defensiveTD:0});
const statKeys=['games','passYards','passTD','interceptions','rushYards','rushTD','recYards','recTD','tackles','sacks','defInterceptions','forcedFumbles','defensiveTD'];

function migrateCollegeNamespace(u){
  if(u.meta?.collegeNamespaceMigrated)return false;
  const idMap=new Map();
  for(const t of u.teams?.college||[]){
    if(String(t.id).startsWith('CFB-'))continue;
    const old=t.id,next=`CFB-${old}`;idMap.set(old,next);t.id=next;t.shortId=t.shortId||old;
    for(const key of ['owner','gm','hc','oc','dc']){const st=t[key];if(!st)continue;if(st.teamId===old)st.teamId=next;(st.history||[]).forEach(h=>{if(h.teamId===old)h.teamId=next;});}
    (t.history?.seasons||[]).forEach(h=>{if(h.teamId===old)h.teamId=next;});
  }
  if(!idMap.size){u.meta=u.meta||{};u.meta.collegeNamespaceMigrated=true;return false;}
  const mapId=id=>idMap.get(id)||id;
  for(const p of u.players||[]){
    if(p.league==='COLLEGE')p.teamId=mapId(p.teamId);
    p.collegeId=mapId(p.collegeId);
    (p.collegeHistory||[]).forEach(h=>{h.fromId=mapId(h.fromId);h.toId=mapId(h.toId);});
    for(const ss of p.stats?.seasons||[])if(ss.league==='COLLEGE')ss.teamId=mapId(ss.teamId);
  }
  for(const d of u.seasonState?.schedule||[])if(d.league==='COLLEGE'){d.homeId=mapId(d.homeId);d.awayId=mapId(d.awayId);}
  for(const g of u.currentGames||[])if(g.league==='COLLEGE'){g.homeId=mapId(g.homeId);g.awayId=mapId(g.awayId);}
  for(const h of u.seasonHistory||[]){const c=h.COLLEGE;if(c){c.championId=mapId(c.championId);c.runnerUpId=mapId(c.runnerUpId);c.bestRecordTeamId=mapId(c.bestRecordTeamId);}}
  for(const d of u.draftHistory||[])if(d.collegeId)d.collegeId=mapId(d.collegeId);
  for(const x of u.transactions||[])if(x.type==='College Transfer'){x.fromId=mapId(x.fromId);x.toId=mapId(x.toId);}
  for(const off of u.offseasonHistory||[])for(const x of off.events?.transfers||[]){x.fromId=mapId(x.fromId);x.toId=mapId(x.toId);}
  for(const n of u.news||[])if(n.type==='TRANSFER')n.teamId=mapId(n.teamId);
  // Best-effort repair for saves created before 0.2.1: remove cross-league player stats caused by ID collisions.
  // Fully completed historical playoff seeding cannot be reconstructed perfectly, so a fresh universe remains the cleanest benchmark.
  if((u.currentGames||[]).length){
    const rebuilt=new Map();
    for(const p of u.players||[])rebuilt.set(p.id,emptySeasonStats());
    const teamRows=new Map(allTeams(u).map(t=>[t.id,{wins:0,losses:0,pf:0,pa:0,yards:0}]));
    for(const g of u.currentGames.filter(x=>x.stage==='Regular Season')){
      const h=teamRows.get(g.homeId),a=teamRows.get(g.awayId);
      if(h&&a){h.pf+=g.homeScore;h.pa+=g.awayScore;h.yards+=g.homeBox.passYards+g.homeBox.rushYards;a.pf+=g.awayScore;a.pa+=g.homeScore;a.yards+=g.awayBox.passYards+g.awayBox.rushYards;if(g.homeScore>g.awayScore){h.wins++;a.losses++;}else{a.wins++;h.losses++;}}
      for(const [id,gs] of Object.entries(g.playerStats||{})){
        const p=(u.players||[]).find(x=>x.id===id);if(!p)continue;
        const archived=(p.stats?.seasons||[]).find(x=>x.year===u.year);const seasonLeague=archived?.league||p.league;
        if(seasonLeague!==g.league)continue;
        const st=rebuilt.get(id);st.games++;st.passYards+=gs.passYards||0;st.passTD+=gs.passTD||0;st.interceptions+=gs.interceptions||0;st.rushYards+=gs.rushYards||0;st.rushTD+=gs.rushTD||0;st.recYards+=gs.recYards||0;st.recTD+=gs.recTD||0;st.tackles+=gs.tackles||0;st.sacks+=gs.sacks||0;st.defInterceptions+=(gs.interceptions&&!gs.passYards?gs.interceptions:0);st.forcedFumbles+=gs.forcedFumbles||0;st.defensiveTD+=gs.defensiveTD||0;
      }
    }
    for(const t of allTeams(u)){const row=teamRows.get(t.id);if(row)t.current=row;}
    for(const p of u.players||[]){const fresh=rebuilt.get(p.id),archived=(p.stats?.seasons||[]).find(x=>x.year===u.year);if(archived){for(const k of statKeys)p.stats.career[k]=(p.stats.career[k]||0)-(archived[k]||0)+(fresh[k]||0);Object.assign(archived,fresh);}p.currentSeason=fresh;}
    u.meta=u.meta||{};u.meta.repairedPre021CollisionStats=true;
  }
  u.meta=u.meta||{};u.meta.collegeNamespaceMigrated=true;
  return true;
}


function rebalanceLegacyEliteQbs(u){
  u.meta=u.meta||{};if(u.meta.eliteQbBalanceVersion>=1)return;
  const elite=r=>['Epic','Legend','Generational'].includes(r),top=r=>['Legend','Generational'].includes(r),active=()=>u.players.filter(p=>!p.retired),count=pred=>active().filter(p=>p.position==='QB'&&pred(p.trueRarity)).length;
  const hiddenQbs=()=>active().filter(p=>p.league==='COLLEGE'&&!p.revealed&&p.position==='QB').sort((a,b)=>(a.collegeYear||1)-(b.collegeYear||1)||(b.scouting?.expectedTier||0)-(a.scouting?.expectedTier||0)||String(a.id).localeCompare(String(b.id)));
  const hiddenDonors=pred=>active().filter(p=>p.league==='COLLEGE'&&!p.revealed&&p.position!=='QB'&&pred(p.trueRarity)).sort((a,b)=>(a.collegeYear||1)-(b.collegeYear||1)||String(a.id).localeCompare(String(b.id)));
  const fields=['trueRarity','developmentPath','developmentCurve','ceilingOverall','careerYears','potential','overall','peakOverall'];
  const swapTalent=(a,b)=>{for(const k of fields){const v=a[k];a[k]=b[k];b[k]=v;}};
  let guard=0;while(count(top)<TOP_QB_FLOOR&&guard++<12){const q=hiddenQbs().find(p=>!top(p.trueRarity)),d=hiddenDonors(top)[0];if(!q||!d)break;swapTalent(q,d);}
  guard=0;while(count(elite)<ELITE_QB_FLOOR&&guard++<12){const q=hiddenQbs().find(p=>!elite(p.trueRarity)),d=hiddenDonors(r=>r==='Epic')[0]||hiddenDonors(elite)[0];if(!q||!d)break;swapTalent(q,d);}
  u.meta.eliteQbBalanceVersion=1;
}

function cloneUniverse(value){
  // structuredClone is absent on older iOS/Safari and some in-app browsers.
  if(typeof globalThis!=='undefined' && typeof globalThis.structuredClone==='function'){
    try{return globalThis.structuredClone(value)}catch(e){console.warn('structuredClone failed; using JSON clone',e)}
  }
  return JSON.parse(JSON.stringify(value));
}
function jerseyNumber(p){
  const ranges={QB:[1,19],HB:[20,49],FB:[20,49],WR:[1,19],TE:[80,89],OT:[60,79],OG:[50,79],C:[50,69],EDGE:[40,59],DT:[90,99],LB:[40,59],CB:[20,39],S:[20,39],K:[1,19],P:[1,19]};
  const [lo,hi]=ranges[p?.position]||[1,99],raw=String(p?.id||p?.name||'1');let h=0;for(let i=0;i<raw.length;i++)h=(h*31+raw.charCodeAt(i))>>>0;return lo+(h%(hi-lo+1));
}
export function ensureUniverse(universe){
  const u=universe;
  u.meta=u.meta||{};migrateCollegeNamespace(u);rebalanceLegacyEliteQbs(u);
  for(const p of u.players||[])ensurePlayerIdentity(p);
  assignUniverseFaceAssets(u.players||[]);
  u.version='0.7.4';u.currentGames=u.currentGames||[];u.transactions=u.transactions||[];u.news=u.news||[];u.records=u.records||[];u.statHistory=u.statHistory||[];u.seasonHistory=u.seasonHistory||[];u.draftHistory=u.draftHistory||[];u.freeAgents=u.freeAgents||[];u.coachFreeAgents=u.coachFreeAgents||[];u.offseasonHistory=u.offseasonHistory||[];u.hallOfFame=u.hallOfFame||{NFL:[],COLLEGE:[]};u.hallOfFame.NFL=u.hallOfFame.NFL||[];u.hallOfFame.COLLEGE=u.hallOfFame.COLLEGE||[];u.retiredJerseys=u.retiredJerseys||[];u.watchlist=u.watchlist||[];u.meta=u.meta||{};u.meta.nextPlayerId=u.meta.nextPlayerId||u.players.length+1;u.meta.nextNewsId=u.meta.nextNewsId||1;u.meta.nextStaffId=u.meta.nextStaffId||1;
  allTeams(u).forEach(t=>{t.history=t.history||{championships:0,playoffs:0,seasons:[]};t.history.seasons=t.history.seasons||[];t.history.honors=t.history.honors||[];t.retiredJerseys=t.retiredJerseys||[];t.current=t.current||{wins:0,losses:0,pf:0,pa:0,yards:0};[['OWNER','owner'],['GM','gm'],['HC','hc'],['OC','oc'],['DC','dc']].forEach(([role,key])=>{if(t[key])normalizeStaff(t[key],t.id,role)});});
  u.players.forEach(p=>{p.stats=p.stats||{career:{},seasons:[]};p.stats.career=p.stats.career||{};p.stats.seasons=p.stats.seasons||[];p.awards=p.awards||[];p.championships=p.championships||0;p.teamTitles=p.teamTitles||[];p.collegeHistory=p.collegeHistory||[];p.hallOfFame=p.hallOfFame||{};if(p.retired&&!p.retirementYear){const proYears=p.stats.seasons.filter(x=>x.league==='NFL'||x.league==='UFL').map(x=>x.year);p.retirementYear=proYears.length?Math.max(...proYears)+1:Math.max(1,(u.year||1)-5);}if(!p.jerseyNumber)p.jerseyNumber=jerseyNumber(p);ensureDevelopmentProfile(p);});
  backfillTeamHistoryContext(u);
  if(u.offseasonState){u.offseasonState.events=u.offseasonState.events||{};u.offseasonState.stageNames=u.offseasonState.stageNames||LEGACY_OFFSEASON_STAGES;u.offseasonState.strengthAfter=u.offseasonState.strengthAfter||{};for(const k of ['coachMarket','transfers','retirements','declarations','hallOfFame','retiredJerseys','freeAgency','draft','trades','spawned'])u.offseasonState.events[k]=u.offseasonState.events[k]||[];}
  for(const off of u.offseasonHistory||[]){off.events=off.events||{};off.stageNames=off.stageNames||LEGACY_OFFSEASON_STAGES;off.strengthAfter=off.strengthAfter||{};for(const k of ['coachMarket','transfers','retirements','declarations','hallOfFame','retiredJerseys','freeAgency','draft','trades','spawned'])off.events[k]=off.events[k]||[];}
  rebuildStatHistory(u);
  if(u.phase==='Offseason Complete'){u.phase='Preseason';}
  return u;
}

function resetCompetition(u,league){
  u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'].forEach(t=>{t.current={wins:0,losses:0,pf:0,pa:0,yards:0};});
  u.players.filter(p=>p.league===league&&!p.retired).forEach(p=>{p.currentSeason={games:0,passYards:0,passTD:0,interceptions:0,rushYards:0,rushTD:0,recYards:0,recTD:0,tackles:0,sacks:0,defInterceptions:0,forcedFumbles:0,defensiveTD:0};});
}
function applyGame(u,g,countStandings=true,countPlayerStats=true){
  const h=teamById(u,g.homeId,g.league),a=teamById(u,g.awayId,g.league);
  if(countStandings){h.current.pf+=g.homeScore;h.current.pa+=g.awayScore;h.current.yards+=g.homeBox.passYards+g.homeBox.rushYards;a.current.pf+=g.awayScore;a.current.pa+=g.homeScore;a.current.yards+=g.awayBox.passYards+g.awayBox.rushYards;if(g.homeScore>g.awayScore){h.current.wins++;a.current.losses++;}else{a.current.wins++;h.current.losses++;}}
  if(!countPlayerStats)return;
  for(const [id,s] of Object.entries(g.playerStats)){const p=playerById(u,id);if(!p||p.league!==g.league)continue;if(!p.currentSeason)p.currentSeason={games:0,passYards:0,passTD:0,interceptions:0,rushYards:0,rushTD:0,recYards:0,recTD:0,tackles:0,sacks:0,defInterceptions:0,forcedFumbles:0,defensiveTD:0};p.currentSeason.games++;p.currentSeason.passYards+=(s.passYards||0);p.currentSeason.passTD+=(s.passTD||0);p.currentSeason.interceptions+=(s.interceptions||0);p.currentSeason.rushYards+=(s.rushYards||0);p.currentSeason.rushTD+=(s.rushTD||0);p.currentSeason.recYards+=(s.recYards||0);p.currentSeason.recTD+=(s.recTD||0);p.currentSeason.tackles+=(s.tackles||0);p.currentSeason.sacks+=(s.sacks||0);p.currentSeason.defInterceptions+=(s.interceptions&&!s.passYards?s.interceptions:0);p.currentSeason.forcedFumbles+=(s.forcedFumbles||0);p.currentSeason.defensiveTD+=(s.defensiveTD||0);}
}
function roundRobinRounds(teams){const arr=[...teams];if(arr.length%2)arr.push(null);const fixed=arr[0],rest=arr.slice(1),rounds=[];for(let r=0;r<arr.length-1;r++){const line=[fixed,...rest],pairs=[];for(let i=0;i<line.length/2;i++){const a=line[i],b=line[line.length-1-i];if(a&&b)pairs.push([a,b]);}rounds.push(pairs);rest.unshift(rest.pop());}return rounds}
function buildNFLWeeks(teams,rng){
  const byeWeeks=[5,6,7,8,9,10,11,12],shuffled=rng.shuffle(teams),byes=new Map();byeWeeks.forEach((w,i)=>shuffled.slice(i*4,i*4+4).forEach(t=>byes.set(t.id,w)));const used=new Map(teams.map(t=>[t.id,new Set()])),weeks=[];
  for(let week=1;week<=18;week++){const active=teams.filter(t=>byes.get(t.id)!==week);let finalPairs=null;for(let attempt=0;attempt<700&&!finalPairs;attempt++){const pool=rng.shuffle(active),pairs=[];let failed=false;while(pool.length){const a=pool.pop(),candidates=pool.filter(b=>!used.get(a.id).has(b.id));if(!candidates.length){failed=true;break;}const b=rng.weighted(candidates.map(x=>[x,x.division===a.division&&x.conference===a.conference?3.5:x.conference===a.conference?1.5:1]));pool.splice(pool.indexOf(b),1);pairs.push([a,b]);}if(!failed)finalPairs=pairs;}if(!finalPairs){const pool=rng.shuffle(active);finalPairs=[];while(pool.length)finalPairs.push([pool.pop(),pool.pop()]);}finalPairs.forEach(([a,b])=>{used.get(a.id).add(b.id);used.get(b.id).add(a.id)});weeks.push(finalPairs);}
  return weeks;
}
function buildCollegeWeeks(teams,rng){
  const used=new Map(teams.map(t=>[t.id,new Set()])),weeks=[];
  for(let week=1;week<=12;week++){let finalPairs=null;for(let attempt=0;attempt<500&&!finalPairs;attempt++){const pool=rng.shuffle(teams),pairs=[];let failed=false;while(pool.length){const a=pool.pop(),candidates=pool.filter(b=>!used.get(a.id).has(b.id));if(!candidates.length){failed=true;break;}const b=rng.weighted(candidates.map(x=>[x,x.conference===a.conference?5:1]));pool.splice(pool.indexOf(b),1);pairs.push([a,b]);}if(!failed)finalPairs=pairs;}if(!finalPairs){const pool=rng.shuffle(teams);finalPairs=[];while(pool.length)finalPairs.push([pool.pop(),pool.pop()]);}finalPairs.forEach(([a,b])=>{used.get(a.id).add(b.id);used.get(b.id).add(a.id)});weeks.push(finalPairs);}return weeks;
}
function standings(teams){return [...teams].sort((a,b)=>b.current.wins-a.current.wins||(b.current.pf-b.current.pa)-(a.current.pf-a.current.pa)||b.current.pf-a.current.pf)}
function collegeRankScore(t){return t.current.wins*10+(t.current.pf-t.current.pa)/35+t.prestige/18}
function collegeRanking(teams){return [...teams].sort((a,b)=>collegeRankScore(b)-collegeRankScore(a)||b.current.wins-a.current.wins)}
function nflConferenceSeeds(teams,conference){
  const conf=teams.filter(t=>t.conference===conference),divisions=[...new Set(conf.map(t=>t.division))];
  const divisionWinners=divisions.map(d=>standings(conf.filter(t=>t.division===d))[0]).filter(Boolean);
  const seededDivisionWinners=standings(divisionWinners),winnerIds=new Set(seededDivisionWinners.map(t=>t.id));
  const wildcards=standings(conf.filter(t=>!winnerIds.has(t.id))).slice(0,3);
  return [...seededDivisionWinners,...wildcards].slice(0,7);
}
export function getProjectedSeeds(u,league){
  if(league==='NFL')return ['AFC','NFC'].flatMap(conference=>nflConferenceSeeds(u.teams.nfl,conference).map((team,i)=>({teamId:team.id,seed:i+1,conference})));
  if(league==='COLLEGE')return collegeRanking(u.teams.college).slice(0,12).map((team,i)=>({teamId:team.id,seed:i+1,conference:team.conference}));
  return standings(u.teams.ufl).slice(0,4).map((team,i)=>({teamId:team.id,seed:i+1,conference:'UFL'}));
}
function scheduleDescriptors(rng,u){
  const rows=[];
  buildNFLWeeks(u.teams.nfl,rng).forEach((pairs,i)=>pairs.forEach(([a,b],j)=>{const home=(i+j)%2===0?a:b,away=home===a?b:a;rows.push({week:i+1,league:'NFL',homeId:home.id,awayId:away.id})}));
  buildCollegeWeeks(u.teams.college,rng).forEach((pairs,i)=>pairs.forEach(([a,b],j)=>{const home=(i+j)%2===0?a:b,away=home===a?b:a;rows.push({week:i+1,league:'COLLEGE',homeId:home.id,awayId:away.id})}));
  const rr=roundRobinRounds(rng.shuffle(u.teams.ufl)),ufl=[...rr,...rr.slice(0,3).map(r=>r.map(([a,b])=>[b,a]))];ufl.forEach((pairs,i)=>pairs.forEach(([a,b],j)=>{const home=(i+j)%2===0?a:b,away=home===a?b:a;rows.push({week:i+1,league:'UFL',homeId:home.id,awayId:away.id})}));
  return rows;
}
function prepareSeason(u,rng){resetCompetition(u,'NFL');resetCompetition(u,'COLLEGE');resetCompetition(u,'UFL');u.currentGames=[];u.postseasonState=null;u.seasonState={week:0,maxWeek:18,schedule:scheduleDescriptors(rng,u),regularComplete:false};u.phase='Regular Season';u.offseasonState=null;}
function simulateWeekMutable(u,rng){
  if(!u.seasonState||u.phase==='Preseason')prepareSeason(u,rng);if(u.phase!=='Regular Season')return;
  const week=u.seasonState.week+1;for(const d of u.seasonState.schedule.filter(x=>x.week===week)){const h=teamById(u,d.homeId,d.league),a=teamById(u,d.awayId,d.league),g=simulateGame(rng,h,a,roster(u,h.id,d.league),roster(u,a.id,d.league),{league:d.league,stage:'Regular Season',round:week});applyGame(u,g,true,true);u.currentGames.push(g);}u.seasonState.week=week;if(week>=u.seasonState.maxWeek)preparePostseasonMutable(u);
}
function playoffGame(u,rng,league,home,away,stage,round){const g=simulateGame(rng,home,away,roster(u,home.id,league),roster(u,away.id,league),{league,stage,round});u.currentGames.push(g);return g}
const winner=(g,u)=>teamById(u,g.homeScore>g.awayScore?g.homeId:g.awayId,g.league);
const loser=(g,u)=>teamById(u,g.homeScore>g.awayScore?g.awayId:g.homeId,g.league);
function markFinish(map,teams,label){teams.forEach(t=>{if(!map[t.id])map[t.id]=label})}
function gameById(u,id){return id?u.currentGames.find(g=>g.id===id):null}
function preparePostseasonMutable(u){
  if(u.phase!=='Regular Season')return;
  const nflFinish={},collegeFinish={},uflFinish={};markFinish(nflFinish,u.teams.nfl,'No Playoffs');markFinish(collegeFinish,u.teams.college,'No Playoff');markFinish(uflFinish,u.teams.ufl,'No Playoff');
  const nfl={finish:nflFinish,conferences:{}};
  for(const conf of ['AFC','NFC']){const seeds=nflConferenceSeeds(u.teams.nfl,conf);seeds.forEach((t,i)=>{t.history.playoffs++;nflFinish[t.id]=i===0?'Lost Divisional':'Lost Wild Card'});nfl.conferences[conf]={seeds:seeds.map(t=>t.id),wcWinners:[],divWinners:[],championId:null};}
  const collegeSeeds=collegeRanking(u.teams.college).slice(0,12);collegeSeeds.forEach((t,i)=>{t.history.playoffs++;collegeFinish[t.id]=i<4?'Lost CFP Quarterfinal':'Lost CFP First Round'});
  const uflSeeds=standings(u.teams.ufl).slice(0,4);uflSeeds.forEach(t=>{t.history.playoffs++;uflFinish[t.id]='Lost Semifinal'});
  const playoffIds=new Set(collegeSeeds.map(t=>t.id)),nonPlayoff=collegeRanking(u.teams.college).filter(t=>!playoffIds.has(t.id)).slice(0,16),bowlNames=['Citrus Bowl','Alamo Bowl','Holiday Bowl','Gator Bowl','Sun Bowl','Liberty Bowl','Music City Bowl','Las Vegas Bowl'];
  const bowls=[];for(let i=0;i<8&&i*2+1<nonPlayoff.length;i++)bowls.push({name:bowlNames[i],homeId:nonPlayoff[i*2].id,awayId:nonPlayoff[i*2+1].id,gameId:null});
  u.postseasonState={roundIndex:0,roundsTotal:4,complete:false,NFL:nfl,COLLEGE:{finish:collegeFinish,seeds:collegeSeeds.map(t=>t.id),firstWinners:[],quarterWinners:[],semiWinners:[],championId:null,runnerUpId:null,finalGameId:null},UFL:{finish:uflFinish,seeds:uflSeeds.map(t=>t.id),semiWinners:[],championId:null,runnerUpId:null,finalGameId:null},bowls};
  u.seasonState.regularComplete=true;u.phase='Postseason';
}
function playByIds(u,rng,league,homeId,awayId,stage,round){const h=teamById(u,homeId,league),a=teamById(u,awayId,league);return h&&a?playoffGame(u,rng,league,h,a,stage,round):null}
function simulatePostseasonRoundMutable(u,rng){
  if(u.phase!=='Postseason'||!u.postseasonState)return;const ps=u.postseasonState,round=ps.roundIndex;
  if(round===0){
    for(const conf of ['AFC','NFC']){const c=ps.NFL.conferences[conf],s=c.seeds,games=[[s[1],s[6]],[s[2],s[5]],[s[3],s[4]]].map(([h,a])=>playByIds(u,rng,'NFL',h,a,'Wild Card',1)).filter(Boolean);c.wcWinners=games.map(g=>winner(g,u).id);c.wcWinners.forEach(id=>ps.NFL.finish[id]='Lost Divisional');}
    const s=ps.COLLEGE.seeds,first=[[s[4],s[11]],[s[5],s[10]],[s[6],s[9]],[s[7],s[8]]].map(([h,a])=>playByIds(u,rng,'COLLEGE',h,a,'CFP First Round',1)).filter(Boolean);ps.COLLEGE.firstWinners=first.map(g=>winner(g,u).id);ps.COLLEGE.firstWinners.forEach(id=>ps.COLLEGE.finish[id]='Lost CFP Quarterfinal');
    const us=ps.UFL.seeds,semis=[[us[0],us[3]],[us[1],us[2]]].map(([h,a])=>playByIds(u,rng,'UFL',h,a,'UFL Semifinal',1)).filter(Boolean);ps.UFL.semiWinners=semis.map(g=>winner(g,u).id);ps.UFL.semiWinners.forEach(id=>ps.UFL.finish[id]='Lost Championship');
    for(const bowl of ps.bowls){const g=playByIds(u,rng,'COLLEGE',bowl.homeId,bowl.awayId,bowl.name,1);if(g)bowl.gameId=g.id;}
  } else if(round===1){
    for(const conf of ['AFC','NFC']){const c=ps.NFL.conferences[conf],survivors=[c.seeds[0],...c.wcWinners].sort((a,b)=>c.seeds.indexOf(a)-c.seeds.indexOf(b)),games=[[survivors[0],survivors[3]],[survivors[1],survivors[2]]].map(([h,a])=>playByIds(u,rng,'NFL',h,a,'Divisional',2)).filter(Boolean);c.divWinners=games.map(g=>winner(g,u).id);c.divWinners.forEach(id=>ps.NFL.finish[id]='Lost Conference Championship');}
    const s=ps.COLLEGE.seeds,w=ps.COLLEGE.firstWinners,q=[[s[0],w[3]],[s[1],w[2]],[s[2],w[1]],[s[3],w[0]]].map(([h,a])=>playByIds(u,rng,'COLLEGE',h,a,'CFP Quarterfinal',2)).filter(Boolean);ps.COLLEGE.quarterWinners=q.map(g=>winner(g,u).id);ps.COLLEGE.quarterWinners.forEach(id=>ps.COLLEGE.finish[id]='Lost CFP Semifinal');
    const us=ps.UFL.semiWinners;if(us.length===2){const g=playByIds(u,rng,'UFL',us[0],us[1],'UFL Championship',2);if(g){const champ=winner(g,u),runner=loser(g,u);ps.UFL.championId=champ.id;ps.UFL.runnerUpId=runner.id;ps.UFL.finalGameId=g.id;ps.UFL.finish[champ.id]='UFL Champion';ps.UFL.finish[runner.id]='Lost Championship';champ.history.championships++;}}
  } else if(round===2){
    for(const conf of ['AFC','NFC']){const c=ps.NFL.conferences[conf];if(c.divWinners.length===2){const ordered=[...c.divWinners].sort((a,b)=>c.seeds.indexOf(a)-c.seeds.indexOf(b)),g=playByIds(u,rng,'NFL',ordered[0],ordered[1],'Conference Championship',3);if(g){c.championId=winner(g,u).id;ps.NFL.finish[c.championId]='Lost Super Bowl';}}}
    const q=ps.COLLEGE.quarterWinners;if(q.length===4){const games=[[q[0],q[3]],[q[1],q[2]]].map(([h,a])=>playByIds(u,rng,'COLLEGE',h,a,'CFP Semifinal',3)).filter(Boolean);ps.COLLEGE.semiWinners=games.map(g=>winner(g,u).id);ps.COLLEGE.semiWinners.forEach(id=>ps.COLLEGE.finish[id]='Lost National Championship');}
  } else if(round===3){
    const afc=ps.NFL.conferences.AFC.championId,nfc=ps.NFL.conferences.NFC.championId;if(afc&&nfc){const g=playByIds(u,rng,'NFL',afc,nfc,'Super Bowl',4);if(g){const champ=winner(g,u),runner=loser(g,u);ps.NFL.championId=champ.id;ps.NFL.runnerUpId=runner.id;ps.NFL.finalGameId=g.id;ps.NFL.finish[champ.id]='Super Bowl Champion';ps.NFL.finish[runner.id]='Lost Super Bowl';champ.history.championships++;}}
    const semi=ps.COLLEGE.semiWinners;if(semi.length===2){const g=playByIds(u,rng,'COLLEGE',semi[0],semi[1],'National Championship',4);if(g){const champ=winner(g,u),runner=loser(g,u);ps.COLLEGE.championId=champ.id;ps.COLLEGE.runnerUpId=runner.id;ps.COLLEGE.finalGameId=g.id;ps.COLLEGE.finish[champ.id]='National Champion';ps.COLLEGE.finish[runner.id]='Lost National Championship';champ.history.championships++;}}
  }
  ps.roundIndex++;if(ps.roundIndex>=ps.roundsTotal)finishSeasonMutable(u,rng);
}
function postseasonResults(u){const ps=u.postseasonState;return{
  NFL:{champion:teamById(u,ps.NFL.championId,'NFL'),runnerUp:teamById(u,ps.NFL.runnerUpId,'NFL'),final:gameById(u,ps.NFL.finalGameId),finish:ps.NFL.finish,regular:standings(u.teams.nfl)},
  COLLEGE:{champion:teamById(u,ps.COLLEGE.championId,'COLLEGE'),runnerUp:teamById(u,ps.COLLEGE.runnerUpId,'COLLEGE'),final:gameById(u,ps.COLLEGE.finalGameId),finish:ps.COLLEGE.finish,regular:collegeRanking(u.teams.college)},
  UFL:{champion:teamById(u,ps.UFL.championId,'UFL'),runnerUp:teamById(u,ps.UFL.runnerUpId,'UFL'),final:gameById(u,ps.UFL.finalGameId),finish:ps.UFL.finish,regular:standings(u.teams.ufl)}
};}

function productionFromStats(position,s={}){if(position==='QB')return(s.passYards||0)/35+(s.passTD||0)*6-(s.interceptions||0)*3+(s.rushYards||0)/28+(s.rushTD||0)*5;if(['HB','FB'].includes(position))return(s.rushYards||0)/10+(s.rushTD||0)*7+(s.recYards||0)/18+(s.recTD||0)*6;if(['WR','TE'].includes(position))return(s.recYards||0)/10+(s.recTD||0)*8;if(DEFENSE.has(position))return(s.tackles||0)*.35+(s.sacks||0)*7+(s.defInterceptions||0)*8+(s.forcedFumbles||0)*6+(s.defensiveTD||0)*10;return 10}
function playerProduction(p){return productionFromStats(p.position,p.currentSeason||{})}
function teamSeasonStars(u,teamId,year=null,limit=2){const rows=[];for(const p of u.players||[]){let stats=null;if(year==null){if(p.teamId!==teamId||!p.currentSeason)continue;stats=p.currentSeason;}else{stats=(p.stats?.seasons||[]).find(x=>x.year===year&&x.teamId===teamId);if(!stats)continue;}const score=productionFromStats(p.position,stats)+(Number(stats.overall||p.overall||0)*.42);rows.push({p,score});}return rows.sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.p)}
function coachAtTeamYear(u,teamId,year){const staff=[];const seen=new Set();for(const t of allTeams(u))for(const key of ['hc','oc','dc']){const x=t[key];if(x&&!seen.has(x.id)){seen.add(x.id);staff.push(x)}}for(const x of u.coachFreeAgents||[])if(x&&!seen.has(x.id)){seen.add(x.id);staff.push(x)}for(const x of staff){const h=[...(x.history||[])].filter(e=>(e.year||1)<=year).sort((a,b)=>(a.year||1)-(b.year||1));const last=h[h.length-1];if(last?.teamId===teamId&&last?.role==='HC')return x;}return null}
function backfillTeamHistoryContext(u){for(const t of allTeams(u)){for(const row of t.history?.seasons||[]){if(!row.coachId&&!row.coachName){const c=coachAtTeamYear(u,t.id,row.year);if(c){row.coachId=c.id;row.coachName=c.name;}}if(!Array.isArray(row.topStarIds)||!row.topStarIds.length){const stars=teamSeasonStars(u,t.id,row.year,2);row.topStarIds=stars.map(p=>p.id);row.topStarNames=stars.map(p=>p.name);}else if(!Array.isArray(row.topStarNames)||!row.topStarNames.length){row.topStarNames=row.topStarIds.map(id=>playerById(u,id)?.name||'—');}}}}
function pickPlayerAward(u,league,name,kind='all'){
  let c=u.players.filter(p=>!p.retired&&p.league===league&&p.currentSeason);if(kind==='offense')c=c.filter(p=>OFFENSE.has(p.position));if(kind==='defense')c=c.filter(p=>DEFENSE.has(p.position));if(kind==='rookie')c=c.filter(p=>(p.proYear||0)<=1||p.draftYear===u.year);let best=null,bestScore=-1;
  for(const p of c){const t=teamById(u,p.teamId),wp=t?t.current.wins/Math.max(1,t.current.wins+t.current.losses):.5,posW=p.position==='QB'?1.13:['WR','HB','EDGE','CB'].includes(p.position)?1.02:.92,repeat=(name.includes('MVP')||name==='Heisman Trophy')?Math.pow(.80,p.mvpWins||0):1,score=playerProduction(p)*posW*(.72+wp*.5)*repeat;if(score>bestScore){bestScore=score;best=p;}}
  if(best){best.awards.push({year:u.year,name,league});if(name.includes('MVP')||name==='Heisman Trophy')best.mvpWins=(best.mvpWins||0)+1;}return best;
}
function pickCoachAward(u,league,name){const teams=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'];const best=[...teams].sort((a,b)=>(b.current.wins*2+(b.current.pf-b.current.pa)/100+(b.hc?.overall||0)/25)-(a.current.wins*2+(a.current.pf-a.current.pa)/100+(a.hc?.overall||0)/25))[0];if(best?.hc){best.hc.awards=best.hc.awards||[];best.hc.awards.push({year:u.year,name,league});}return best?.hc||null}
const ALL_LEAGUE_POSITIONS=['QB','HB','FB','WR','TE','OT','OG','C','EDGE','DT','LB','CB','S','K','P'];
const POSITION_AWARD_LABEL={HB:'RB',OG:'G',OT:'T'};
function positionAwardScore(u,p){
  const t=teamById(u,p.teamId),s=p.currentSeason||{},wp=t?t.current.wins/Math.max(1,t.current.wins+t.current.losses):.5;
  if(['OT','OG','C'].includes(p.position))return(p.overall||0)*1.55+(t?.current?.yards||0)/180+(t?.current?.pf||0)/35+wp*18;
  if(['K','P'].includes(p.position))return(p.overall||0)*1.5+wp*20+(t?.current?.pf||0)/55;
  return playerProduction(p)+(p.overall||0)*.35+wp*15;
}
function pickPositionAwards(u,league){
  const prefix=league==='COLLEGE'?'All-College':league==='NFL'?'All-NFL':'All-UFL',out={};
  for(const pos of ALL_LEAGUE_POSITIONS){const rows=u.players.filter(p=>!p.retired&&p.league===league&&p.position===pos&&p.currentSeason).sort((a,b)=>positionAwardScore(u,b)-positionAwardScore(u,a));const best=rows[0];if(best){const name=`${prefix} ${POSITION_AWARD_LABEL[pos]||pos}`;best.awards.push({year:u.year,name,league,type:'POSITION',position:pos});out[pos]=best;}}
  return out;
}
function awardSet(u){return{NFL:{mvp:pickPlayerAward(u,'NFL','NFL MVP'),opoy:pickPlayerAward(u,'NFL','Offensive Player of the Year','offense'),dpoy:pickPlayerAward(u,'NFL','Defensive Player of the Year','defense'),roy:pickPlayerAward(u,'NFL','Rookie of the Year','rookie'),coach:pickCoachAward(u,'NFL','Coach of the Year'),positional:pickPositionAwards(u,'NFL')},COLLEGE:{mvp:pickPlayerAward(u,'COLLEGE','Heisman Trophy'),opoy:pickPlayerAward(u,'COLLEGE','College Offensive Player of the Year','offense'),dpoy:pickPlayerAward(u,'COLLEGE','College Defensive Player of the Year','defense'),coach:pickCoachAward(u,'COLLEGE','College Coach of the Year'),positional:pickPositionAwards(u,'COLLEGE')},UFL:{mvp:pickPlayerAward(u,'UFL','UFL MVP'),opoy:pickPlayerAward(u,'UFL','UFL Offensive Player of the Year','offense'),dpoy:pickPlayerAward(u,'UFL','UFL Defensive Player of the Year','defense'),coach:pickCoachAward(u,'UFL','UFL Coach of the Year'),positional:pickPositionAwards(u,'UFL')}}}

function addNews(u,type,importance,title,body,teamId=null,playerId=null){u.meta.nextNewsId=u.meta.nextNewsId||1;u.news.unshift({id:`N${u.meta.nextNewsId++}`,year:u.year,type,importance,title,body,teamId,playerId});u.news=u.news.slice(0,300)}
const YEAR_STAT_CATS={
  'Passing Yards':{type:'player',key:'passYards'},'Passing TD':{type:'player',key:'passTD'},
  'Rushing Yards':{type:'player',key:'rushYards'},'Rushing TD':{type:'player',key:'rushTD'},
  'Receiving Yards':{type:'player',key:'recYards'},'Receiving TD':{type:'player',key:'recTD'},
  'Sacks':{type:'player',key:'sacks'},'Tackles':{type:'player',key:'tackles'},'Defensive INT':{type:'player',key:'defInterceptions'},
  'Team Points':{type:'team',key:'pf'},'Team Yards':{type:'team',key:'yards'}
};
function buildYearStatHistory(u,year,league){
  const categories={};
  for(const [category,cfg] of Object.entries(YEAR_STAT_CATS)){
    let rows=[];
    if(cfg.type==='player'){
      for(const p of u.players){for(const ss of p.stats?.seasons||[]){if(ss.year!==year||ss.league!==league)continue;const value=ss[cfg.key]||0;if(value>0)rows.push({playerId:p.id,teamId:ss.teamId,value});}}
    }else{
      const teams=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'];
      for(const t of teams){const ss=(t.history?.seasons||[]).find(x=>x.year===year&&x.league===league);const value=ss?.[cfg.key]||0;if(value>0)rows.push({teamId:t.id,value});}
    }
    rows.sort((a,b)=>b.value-a.value);categories[category]={leader:rows[0]||null,runnerUp:rows[1]||null};
  }
  return {year,league,categories};
}
function recordYearStatHistory(u,year){
  u.statHistory=(u.statHistory||[]).filter(x=>x.year!==year);
  for(const league of ['NFL','COLLEGE','UFL'])u.statHistory.push(buildYearStatHistory(u,year,league));
  u.statHistory.sort((a,b)=>b.year-a.year||a.league.localeCompare(b.league));
}
function rebuildStatHistory(u){
  const expected=(u.seasonHistory||[]).length*3;
  if(expected>0&&(u.statHistory||[]).length>=expected)return;
  const years=new Set();
  for(const p of u.players)for(const ss of p.stats?.seasons||[])years.add(ss.year);
  if(!years.size)return;
  const existing=new Set((u.statHistory||[]).map(x=>`${x.year}-${x.league}`));
  for(const year of years)for(const league of ['NFL','COLLEGE','UFL'])if(!existing.has(`${year}-${league}`))u.statHistory.push(buildYearStatHistory(u,year,league));
  u.statHistory.sort((a,b)=>b.year-a.year||a.league.localeCompare(b.league));
}
function extractRecords(u,games){const push=(category,value,playerId,g,teamId)=>{const rec={category,value,playerId,teamId,year:u.year,league:g.league,stage:g.stage,round:g.round,gameId:g.id},same=u.records.filter(r=>r.category===category&&r.league===g.league);same.push(rec);same.sort((a,b)=>b.value-a.value);u.records=u.records.filter(r=>!(r.category===category&&r.league===g.league));u.records.push(...same.slice(0,10));};for(const g of games){push('Team Points',g.homeScore,null,g,g.homeId);push('Team Points',g.awayScore,null,g,g.awayId);push('Team Yards',g.homeBox.passYards+g.homeBox.rushYards,null,g,g.homeId);push('Team Yards',g.awayBox.passYards+g.awayBox.rushYards,null,g,g.awayId);for(const[pid,s]of Object.entries(g.playerStats)){const p=playerById(u,pid);if(!p)continue;if((s.passYards||0)>0)push('Passing Yards',s.passYards,pid,g,p.teamId);if((s.rushYards||0)>0)push('Rushing Yards',s.rushYards,pid,g,p.teamId);if((s.recYards||0)>0)push('Receiving Yards',s.recYards,pid,g,p.teamId);if((s.sacks||0)>0)push('Sacks',s.sacks,pid,g,p.teamId);}}}
function scoreOf(g,teamId){return g.homeId===teamId?g.homeScore:g.awayScore}
function nflDivisionWinnerIds(u){const ids=new Set();for(const conf of ['AFC','NFC'])for(const div of [...new Set(u.teams.nfl.filter(t=>t.conference===conf).map(t=>t.division))]){const best=standings(u.teams.nfl.filter(t=>t.conference===conf&&t.division===div))[0];if(best)ids.add(best.id);}return ids;}
function teamHonorsForSeason(u,league,teamId,res){const honors=[];if(league==='NFL'){if(nflDivisionWinnerIds(u).has(teamId))honors.push('Division Champion');for(const conf of ['AFC','NFC'])if(u.postseasonState?.NFL?.conferences?.[conf]?.championId===teamId)honors.push(`${conf} Champion`);if(res.champion?.id===teamId)honors.push('Super Bowl');}else if(league==='COLLEGE'&&res.champion?.id===teamId)honors.push('National Championship');else if(league==='UFL'&&res.champion?.id===teamId)honors.push('UFL Championship');return honors;}
function archiveSeason(u,results){
  u.players.filter(p=>p.currentSeason).forEach(p=>{p.stats.seasons.push({year:u.year,league:p.league,teamId:p.teamId,overall:p.overall,...p.currentSeason});for(const k of ['games','passYards','passTD','interceptions','rushYards','rushTD','recYards','recTD','sacks','tackles','defInterceptions','forcedFumbles','defensiveTD'])p.stats.career[k]=(p.stats.career[k]||0)+(p.currentSeason[k]||0);});
  for(const [league,res] of Object.entries(results)){const teams=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'],rank=league==='COLLEGE'?collegeRanking(teams):standings(teams);teams.forEach(t=>{const honors=teamHonorsForSeason(u,league,t.id,res),stars=teamSeasonStars(u,t.id,null,2),row={year:u.year,league,wins:t.current.wins,losses:t.current.losses,pf:t.current.pf,pa:t.current.pa,yards:t.current.yards,strength:getTeamStrength(u,t.id),rank:rank.findIndex(x=>x.id===t.id)+1,finish:res.finish[t.id]||'No Playoff',honors,coachId:t.hc?.id||null,coachName:t.hc?.name||'—',topStarIds:stars.map(p=>p.id),topStarNames:stars.map(p=>p.name)};t.history.seasons.push(row);for(const title of honors){t.history.honors.push({year:u.year,title});for(const p of roster(u,t.id)){if(!p.teamTitles.some(x=>x.year===u.year&&x.teamId===t.id&&x.title===title))p.teamTitles.push({year:u.year,league,title,teamId:t.id});}}if(t.id===res.champion.id)for(const p of roster(u,t.id))p.championships=(p.championships||0)+1;});}
  recordYearStatHistory(u,u.year);
}
function finishValue(f=''){if(/Champion$|Super Bowl Champion|National Champion/.test(f))return 6;if(/Lost Super Bowl|Lost National Championship|Lost Championship/.test(f))return 5;if(/Conference Championship|CFP Semifinal/.test(f))return 4;if(/Divisional|CFP Quarterfinal/.test(f))return 3;if(/Wild Card|CFP First Round|Semifinal/.test(f))return 2;return 0;}
function strengthSnapshot(u){return Object.fromEntries(allTeams(u).map(t=>[t.id,getTeamStrengthProfile(u,t.id)]));}
function mostImprovedTeams(u,league,limit=5){const teams=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'],rows=[];for(const t of teams){const hist=t.history?.seasons||[],cur=hist.find(x=>x.year===u.year),prev=hist.find(x=>x.year===u.year-1);if(!cur||!prev)continue;const winsDelta=(cur.wins||0)-(prev.wins||0),strengthDelta=(cur.strength||getTeamStrength(u,t.id)||0)-(prev.strength||cur.strength||0),finishDelta=finishValue(cur.finish)-finishValue(prev.finish),score=winsDelta*5+finishDelta*7+strengthDelta*.7;rows.push({teamId:t.id,league,score:Math.round(score*10)/10,winsDelta,strengthDelta:Math.round(strengthDelta),fromFinish:prev.finish,toFinish:cur.finish,fromRecord:`${prev.wins}-${prev.losses}`,toRecord:`${cur.wins}-${cur.losses}`});}return rows.sort((a,b)=>b.score-a.score).slice(0,limit);}
function finalScoreLabel(g,champion){return`${scoreOf(g,champion.id)}–${scoreOf(g,loser(g,{teams:{nfl:[],ufl:[],college:[]}})?.id)}`}
function leagueSummary(u,league,res,awards){const best=res.regular[0],g=res.final,champ=res.champion,runner=res.runnerUp,positional={};for(const [pos,p] of Object.entries(awards.positional||{}))positional[pos]=p?.id||null;return{championId:champ.id,championRecord:`${champ.current.wins}-${champ.current.losses}`,runnerUpId:runner.id,runnerUpRecord:`${runner.current.wins}-${runner.current.losses}`,finalScore:`${scoreOf(g,champ.id)}-${scoreOf(g,runner.id)}`,bestRecordTeamId:best.id,bestRecord:`${best.current.wins}-${best.current.losses}`,awards:{mvpId:awards.mvp?.id||null,opoyId:awards.opoy?.id||null,dpoyId:awards.dpoy?.id||null,royId:awards.roy?.id||null,coachId:awards.coach?.id||null,positional}}}
function finishSeasonMutable(u,rng){
  if(u.phase!=='Postseason'||!u.postseasonState)return;const results=postseasonResults(u),awards=awardSet(u);extractRecords(u,u.currentGames);archiveSeason(u,results);
  const summary={year:u.year,NFL:leagueSummary(u,'NFL',results.NFL,awards.NFL),COLLEGE:leagueSummary(u,'COLLEGE',results.COLLEGE,awards.COLLEGE),UFL:leagueSummary(u,'UFL',results.UFL,awards.UFL),mostImproved:{NFL:mostImprovedTeams(u,'NFL',5),COLLEGE:mostImprovedTeams(u,'COLLEGE',5),UFL:mostImprovedTeams(u,'UFL',4)}};summary.nflChampionId=summary.NFL.championId;summary.collegeChampionId=summary.COLLEGE.championId;summary.uflChampionId=summary.UFL.championId;summary.nflMvpId=summary.NFL.awards.mvpId;summary.heismanId=summary.COLLEGE.awards.mvpId;summary.uflMvpId=summary.UFL.awards.mvpId;u.seasonHistory.unshift(summary);
  addNews(u,'CHAMPIONSHIP',100,`${results.NFL.champion.name} wins the Super Bowl`,`${results.NFL.champion.name} defeats ${results.NFL.runnerUp.name} ${summary.NFL.finalScore}.`,results.NFL.champion.id);addNews(u,'COLLEGE',92,`${results.COLLEGE.champion.name} wins the national championship`,`${results.COLLEGE.champion.name} defeats ${results.COLLEGE.runnerUp.name} ${summary.COLLEGE.finalScore}.`,results.COLLEGE.champion.id);addNews(u,'UFL',78,`${results.UFL.champion.name} wins the UFL Championship`,`${results.UFL.champion.name} defeats ${results.UFL.runnerUp.name} ${summary.UFL.finalScore}.`,results.UFL.champion.id);
  for(const [league,set] of Object.entries(awards))for(const [key,p]of Object.entries(set)){if(p&&key!=='coach'&&key!=='positional')addNews(u,'AWARD',key==='mvp'?88:58,`${p.name} wins ${league==='COLLEGE'&&key==='mvp'?'the Heisman Trophy':key==='mvp'?`${league} MVP`:key.toUpperCase()}`,`Year ${u.year} award honors ${p.name}.`,p.teamId,p.id)}
  u.postseasonState.complete=true;u.phase='Season Complete';u.offseasonState={year:u.year,stageIndex:0,stageNames:OFFSEASON_STAGES,started:false,complete:false,summary,strengthStart:strengthSnapshot(u),strengthAfter:{},strengthEnd:null,events:{coachMarket:[],transfers:[],retirements:[],declarations:[],hallOfFame:[],retiredJerseys:[],freeAgency:[],draft:[],trades:[],spawned:[]},declaredIds:[]};
}

export function simulateWeeks(universe,count=1){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Preseason'||!u.seasonState)prepareSeason(u,rng);for(let i=0;i<count&&['Regular Season','Postseason'].includes(u.phase);i++){if(u.phase==='Regular Season')simulateWeekMutable(u,rng);else simulatePostseasonRoundMutable(u,rng);}u.rngState=rng.state();return u}
export function simulateToSeasonEnd(universe){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Preseason'||!u.seasonState)prepareSeason(u,rng);while(['Regular Season','Postseason'].includes(u.phase)){if(u.phase==='Regular Season')simulateWeekMutable(u,rng);else simulatePostseasonRoundMutable(u,rng);}u.rngState=rng.state();return u}

export function beginOffseason(universe){const u=ensureUniverse(cloneUniverse(universe));if(u.phase==='Season Complete'){u.phase='Offseason';u.offseasonState=u.offseasonState||{year:u.year,stageIndex:0,stageNames:OFFSEASON_STAGES,started:true,strengthStart:strengthSnapshot(u),strengthAfter:{},events:{}};u.offseasonState.stageNames=u.offseasonState.stageNames||OFFSEASON_STAGES;u.offseasonState.strengthStart=u.offseasonState.strengthStart||strengthSnapshot(u);u.offseasonState.strengthAfter=u.offseasonState.strengthAfter||{};u.offseasonState.started=true;}return u}

function tx(u,type,detail={}){const row={year:u.year,type,...detail};u.transactions.unshift(row);return row}
function processRetirements(u,rng){const out=[];for(const p of u.players.filter(p=>!p.retired&&p.league!=='COLLEGE')){p.proYear=(p.proYear||0)+1;p.age++;const forced=p.proYear>=p.careerYears,early=p.proYear>=7&&rng.bool(Math.max(0,(p.proYear-p.careerYears+2)*.06));if(forced||early){const oldTeam=p.teamId;p.retired=true;p.retirementYear=u.year;p.teamId=null;out.push({playerId:p.id,teamId:oldTeam,rarity:p.trueRarity,position:p.position,careerYears:p.proYear});tx(u,'Retirement',{playerId:p.id,fromId:oldTeam});if(rarityRank(p.trueRarity)>=3)addNews(u,'RETIREMENT',75,`${p.name} retires`,`${p.trueRarity} ${p.position} closes a ${p.proYear}-season professional career.`,oldTeam,p.id);}}return out}

function awardCount(p,predicate){return(p.awards||[]).filter(a=>typeof predicate==='function'?predicate(a):a.name===predicate).length}
function titleCount(p,predicate){return(p.teamTitles||[]).filter(a=>typeof predicate==='function'?predicate(a):a.title===predicate).length}
function careerStatBonus(p,league){const seasons=(p.stats?.seasons||[]).filter(s=>s.league===league),tot=k=>sum(seasons,s=>s[k]||0),cap=(v,m)=>Math.min(m,v);if(p.position==='QB')return cap(tot('passYards')/10000*9,26)+cap(tot('passTD')/100*7,20);if(['HB','FB'].includes(p.position))return cap(tot('rushYards')/4000*10,26)+cap(tot('rushTD')/40*7,16);if(['WR','TE'].includes(p.position))return cap(tot('recYards')/4000*10,26)+cap(tot('recTD')/40*7,16);if(['EDGE','DT','LB'].includes(p.position))return cap(tot('sacks')/40*12,28)+cap(tot('tackles')/400*8,15);if(['CB','S'].includes(p.position))return cap(tot('defInterceptions')/15*12,26)+cap(tot('tackles')/350*6,12);return Math.max(0,seasons.length-3)*1.5;}
function careerLeagueTotal(p,league,key){return sum((p.stats?.seasons||[]).filter(s=>s.league===league),s=>s[key]||0)}
function primaryCareerStats(p){if(p.position==='QB')return['passYards','passTD'];if(['HB','FB'].includes(p.position))return['rushYards','rushTD'];if(['WR','TE'].includes(p.position))return['recYards','recTD'];if(['EDGE','DT','LB'].includes(p.position))return['sacks','tackles'];if(['CB','S'].includes(p.position))return['defInterceptions','tackles'];return[]}
function historicalRankBonus(u,p,league='NFL'){let bonus=0;for(const key of primaryCareerStats(p)){const rows=u.players.filter(x=>x.position===p.position).map(x=>({id:x.id,value:careerLeagueTotal(x,league,key)})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value),rank=rows.findIndex(x=>x.id===p.id)+1;if(rank===1)bonus+=14;else if(rank>0&&rank<=3)bonus+=9;else if(rank>0&&rank<=10)bonus+=4;}return Math.min(22,bonus)}
function nflHofScore(u,p){const mvp=awardCount(p,'NFL MVP'),major=awardCount(p,a=>a.league==='NFL'&&['Offensive Player of the Year','Defensive Player of the Year'].includes(a.name)),all=awardCount(p,a=>a.league==='NFL'&&String(a.name).startsWith('All-NFL')),sb=titleCount(p,a=>a.league==='NFL'&&a.title==='Super Bowl'),conf=titleCount(p,a=>a.league==='NFL'&&['AFC Champion','NFC Champion'].includes(a.title)),div=titleCount(p,a=>a.league==='NFL'&&a.title==='Division Champion'),seasons=(p.stats?.seasons||[]).filter(s=>s.league==='NFL').length;return Math.round((mvp*28+major*16+all*8+sb*7+conf*2+div*.5+Math.max(0,seasons-6)*1.5+careerStatBonus(p,'NFL')*.85+historicalRankBonus(u,p,'NFL'))*10)/10;}
function collegeHofScore(p){const heisman=awardCount(p,'Heisman Trophy'),major=awardCount(p,a=>a.league==='COLLEGE'&&['College Offensive Player of the Year','College Defensive Player of the Year'].includes(a.name)),all=awardCount(p,a=>a.league==='COLLEGE'&&String(a.name).startsWith('All-College')),titles=titleCount(p,a=>a.league==='COLLEGE'&&a.title==='National Championship'),seasons=(p.stats?.seasons||[]).filter(s=>s.league==='COLLEGE').length;return Math.round((heisman*34+major*16+all*9+titles*7+Math.max(0,seasons-2)*3+careerStatBonus(p,'COLLEGE')*.7)*10)/10;}
function hofReasons(p,league){const names=[];if(league==='NFL'){const m=awardCount(p,'NFL MVP'),major=awardCount(p,a=>a.league==='NFL'&&['Offensive Player of the Year','Defensive Player of the Year'].includes(a.name)),a=awardCount(p,x=>x.league==='NFL'&&String(x.name).startsWith('All-NFL')),s=titleCount(p,x=>x.league==='NFL'&&x.title==='Super Bowl');if(m)names.push(`${m}× MVP`);if(major)names.push(`${major}× OPOY/DPOY`);if(a)names.push(`${a}× All-NFL`);if(s)names.push(`${s}× Super Bowl`);}else{const h=awardCount(p,'Heisman Trophy'),a=awardCount(p,x=>x.league==='COLLEGE'&&String(x.name).startsWith('All-College')),n=titleCount(p,x=>x.league==='COLLEGE'&&x.title==='National Championship');if(h)names.push(`${h}× Heisman`);if(a)names.push(`${a}× All-College`);if(n)names.push(`${n}× National Champion`);}return names.slice(0,3).join(' · ')||'Sustained elite career';}
function processHallOfFame(u){const events=[];u.hallOfFame=u.hallOfFame||{NFL:[],COLLEGE:[]};const existingNFL=new Set(u.hallOfFame.NFL.map(x=>x.playerId)),existingCollege=new Set(u.hallOfFame.COLLEGE.map(x=>x.playerId));const nfl=u.players.filter(p=>p.retired&&!existingNFL.has(p.id)&&(p.retirementYear||u.year)<=u.year).map(p=>[p,nflHofScore(u,p)]).filter(([p,score])=>score>=68&&(awardCount(p,'NFL MVP')>0||awardCount(p,a=>a.league==='NFL'&&['Offensive Player of the Year','Defensive Player of the Year'].includes(a.name))>0||awardCount(p,a=>a.league==='NFL'&&String(a.name).startsWith('All-NFL'))>=2||historicalRankBonus(u,p,'NFL')>=9)).sort((a,b)=>b[1]-a[1]).slice(0,10);for(const[p,score]of nfl){const row={league:'NFL',playerId:p.id,year:u.year,score,reasons:hofReasons(p,'NFL')};u.hallOfFame.NFL.push(row);p.hallOfFame={...(p.hallOfFame||{}),NFL:u.year};events.push(row);addNews(u,'HALL OF FAME',86,`${p.name} enters the Pro Football Hall of Fame`,row.reasons,null,p.id);}const college=u.players.filter(p=>!existingCollege.has(p.id)).map(p=>{const yrs=(p.stats?.seasons||[]).filter(s=>s.league==='COLLEGE').map(s=>s.year),last=yrs.length?Math.max(...yrs):(p.draftYear?Math.max(1,p.draftYear-1):null);return[p,last,collegeHofScore(p)]}).filter(([,last,score])=>last&&u.year-last>=2&&score>=52).sort((a,b)=>b[2]-a[2]).slice(0,10);for(const[p,,score]of college){const row={league:'COLLEGE',playerId:p.id,year:u.year,score,reasons:hofReasons(p,'COLLEGE')};u.hallOfFame.COLLEGE.push(row);p.hallOfFame={...(p.hallOfFame||{}),COLLEGE:u.year};events.push(row);addNews(u,'HALL OF FAME',72,`${p.name} enters the College Football Hall of Fame`,row.reasons,p.collegeId,p.id);}return events;}
function teamRetirementScore(p,teamId,league){const seasons=(p.stats?.seasons||[]).filter(s=>s.league===league&&s.teamId===teamId),years=new Set(seasons.map(s=>s.year)),awards=(p.awards||[]).filter(a=>a.league===league&&years.has(a.year)),titles=(p.teamTitles||[]).filter(a=>a.league===league&&a.teamId===teamId);if(league==='NFL'){const mvp=awards.filter(a=>a.name==='NFL MVP').length,major=awards.filter(a=>['Offensive Player of the Year','Defensive Player of the Year'].includes(a.name)).length,all=awards.filter(a=>String(a.name).startsWith('All-NFL')).length;if(!(mvp||major||all>=3))return 0;const individual=mvp*34+major*20+all*10,teamMultiplier=1+titles.filter(a=>a.title==='Super Bowl').length*.18+titles.filter(a=>['AFC Champion','NFC Champion'].includes(a.title)).length*.05+titles.filter(a=>a.title==='Division Champion').length*.015,tenure=1+Math.max(0,seasons.length-4)*.025;return Math.round(individual*teamMultiplier*tenure*10)/10;}const heisman=awards.filter(a=>a.name==='Heisman Trophy').length,major=awards.filter(a=>['College Offensive Player of the Year','College Defensive Player of the Year'].includes(a.name)).length,all=awards.filter(a=>String(a.name).startsWith('All-College')).length;if(!(heisman||major||all>=3))return 0;const individual=heisman*38+major*18+all*10,teamMultiplier=1+titles.filter(a=>a.title==='National Championship').length*.20,tenure=1+Math.max(0,seasons.length-2)*.04;return Math.round(individual*teamMultiplier*tenure*10)/10;}
function processRetiredJerseys(u,retirements=[]){const events=[],already=new Set((u.retiredJerseys||[]).map(x=>`${x.teamId}-${x.playerId}`));for(const r of retirements){const p=playerById(u,r.playerId);if(!p)continue;const teamIds=[...new Set((p.stats?.seasons||[]).map(s=>s.teamId).filter(Boolean))];if(p.collegeId)teamIds.push(p.collegeId);for(const teamId of [...new Set(teamIds)]){const t=teamById(u,teamId);if(!t||!['NFL','COLLEGE'].includes(t.league)||already.has(`${teamId}-${p.id}`))continue;const score=teamRetirementScore(p,teamId,t.league),threshold=t.league==='NFL'?62:58;if(score<threshold)continue;const row={year:u.year,league:t.league,teamId,playerId:p.id,number:p.jerseyNumber||jerseyNumber(p),score};u.retiredJerseys.push(row);t.retiredJerseys=t.retiredJerseys||[];t.retiredJerseys.push(row);already.add(`${teamId}-${p.id}`);events.push(row);addNews(u,'RETIRED JERSEY',80,`${t.name} retires No. ${row.number} for ${p.name}`,`Individual greatness, amplified by team success, produces a franchise legacy score of ${score}.`,t.id,p.id);}}return events;}
function processLegacy(u,retirements){return{hallOfFame:processHallOfFame(u),retiredJerseys:processRetiredJerseys(u,retirements)}}

function developPlayer(p){ensureDevelopmentProfile(p);const phase=p.league==='COLLEGE'?'COLLEGE':'PRO',year=phase==='COLLEGE'?(p.collegeYear||1):Math.min(p.careerYears||14,(p.proYear||0)+1);p.overall=developmentOverall(p,phase,year);p.peakOverall=Math.max(p.peakOverall||p.overall,p.overall)}
function positionNeed(u,team,pos){const same=roster(u,team.id).filter(p=>p.position===pos);if(team.league==='NFL'){const target=NFL_POSITION_TARGETS[pos]||1;if(same.length<target)return clamp(1+(target-same.length-1)*.22,1,1.45);const weakest=[...same].sort((a,b)=>a.overall-b.overall)[0];return clamp((72-(weakest?.overall||55))/45,0,.28);}if(!same.length)return 1;return clamp((78-Math.max(...same.map(p=>p.overall)))/25,0,1)}
function draftDeclarations(u,rng){const out=[];for(const p of u.players.filter(p=>!p.retired&&p.league==='COLLEGE')){if(p.collegeYear>=4||(p.collegeYear===3&&['Legend','Generational'].includes(p.trueRarity)&&rng.bool(.58))){p.declared=true;out.push({playerId:p.id,collegeId:p.teamId,scouting:p.scouting?.label||'Unknown'});}}return out}
function rebuildCap(t,u){t.capUsed=Math.round(sum(roster(u,t.id),p=>p.contract?.annual||0)*10)/10}
function releaseToMarket(u,p,from,events,type='Roster Cut'){if(from)from.capUsed=Math.max(0,from.capUsed-(p.contract?.annual||0));p.teamId=null;p.league='NFL';u.freeAgents=u.freeAgents||[];if(!u.freeAgents.includes(p.id))u.freeAgents.push(p.id);events.push({type,playerId:p.id,rarity:p.trueRarity,position:p.position,fromId:from?.id||null,overall:p.overall,annual:p.contract?.annual||0});tx(u,type,{playerId:p.id,fromId:from?.id||null});}
function playerKeepScore(p){return(p.overall||0)+rarityRank(p.trueRarity)*5-(p.contract?.annual||0)*.15}
function cutPositionalExcess(u,events){for(const t of u.teams.nfl){for(const [pos,target] of Object.entries(NFL_POSITION_TARGETS)){const same=roster(u,t.id,'NFL').filter(p=>p.position===pos).sort((a,b)=>playerKeepScore(b)-playerKeepScore(a));for(const p of same.slice(target))releaseToMarket(u,p,t,events,'Roster Cut');}rebuildCap(t,u);while(t.capUsed>t.capLimit){const candidates=roster(u,t.id,'NFL').filter(p=>p.trueRarity!=='Generational').sort((a,b)=>playerKeepScore(a)-playerKeepScore(b));if(!candidates.length)break;releaseToMarket(u,candidates[0],t,events,'Cap Cut');rebuildCap(t,u);}}}
function compatibleCandidate(pool,pos){for(const alt of COMPATIBLE_POSITIONS[pos]||[]){const p=pool.filter(x=>x.position===alt).sort((a,b)=>b.overall-a.overall)[0];if(p){p.position=pos;return p;}}return null}
function signContractFor(p,team,rng){const base={Generational:38,Legend:28,Epic:18,Rare:10,Uncommon:5,Common:2}[p.trueRarity]||1.2,posMult={QB:1.45,WR:1.15,EDGE:1.12,CB:1.08,OT:1.05,HB:.78,K:.55,P:.48}[p.position]||1,room=Math.max(.6,team.capLimit-team.capUsed),annual=Math.max(.6,Math.min(room,Math.round(base*posMult*10)/10));return{years:rng.int(rarityRank(p.trueRarity)>=3?3:1,rarityRank(p.trueRarity)>=3?5:4),annual}}
function fillNFLVacancies(u,rng,events){for(const t of u.teams.nfl){for(const [pos,target] of Object.entries(NFL_POSITION_TARGETS)){while(roster(u,t.id,'NFL').filter(p=>p.position===pos).length<target){let pool=u.players.filter(p=>!p.retired&&!p.teamId&&p.league!=='COLLEGE'&&p.position===pos).sort((a,b)=>playerKeepScore(b)-playerKeepScore(a));let p=pool[0];if(!p){const ufl=u.players.filter(x=>!x.retired&&x.league==='UFL'&&x.teamId&&x.position===pos).sort((a,b)=>playerKeepScore(b)-playerKeepScore(a));p=ufl[0];if(p){const old=teamById(u,p.teamId);if(old)old.capUsed=Math.max(0,old.capUsed-(p.contract?.annual||0));events.push({type:'NFL Promotion',playerId:p.id,rarity:p.trueRarity,position:p.position,fromId:old?.id||null,toId:t.id,overall:p.overall});}}if(!p){const convertible=u.players.filter(x=>!x.retired&&x.league!=='COLLEGE'&&(!x.teamId||x.league==='UFL')&&(COMPATIBLE_POSITIONS[pos]||[]).includes(x.position)).sort((a,b)=>playerKeepScore(b)-playerKeepScore(a));p=convertible[0];if(p){const old=teamById(u,p.teamId);if(old)old.capUsed=Math.max(0,old.capUsed-(p.contract?.annual||0));const fromPos=p.position;p.position=pos;events.push({type:'Position Conversion',playerId:p.id,rarity:p.trueRarity,position:pos,fromId:old?.id||null,toId:t.id,detail:`${fromPos} → ${pos}`,overall:p.overall});}}if(!p)break;p.teamId=t.id;p.league='NFL';p.contract=signContractFor(p,t,rng);t.capUsed+=p.contract.annual;u.freeAgents=u.freeAgents.filter(id=>id!==p.id);events.push({type:'Signed',playerId:p.id,rarity:p.trueRarity,position:p.position,toId:t.id,years:p.contract.years,annual:p.contract.annual,overall:p.overall});tx(u,'Free Agent Signing',{playerId:p.id,toId:t.id});} }rebuildCap(t,u);}}
function contractAndFreeAgency(u,rng){const events=[];u.freeAgents=u.freeAgents||[];for(const p of u.players.filter(p=>!p.retired&&['NFL','UFL'].includes(p.league)&&p.contract)){if(p.draftYear===u.year)continue;p.contract.years--;if(p.contract.years<=0){const t=teamById(u,p.teamId),same=t?roster(u,t.id).filter(x=>x.position===p.position).sort((a,b)=>playerKeepScore(b)-playerKeepScore(a)):[],target=t?.league==='NFL'?(NFL_POSITION_TARGETS[p.position]||1):99,worthKeeping=!t||t.league!=='NFL'||same.indexOf(p)<target,keep={Generational:.90,Legend:.82,Epic:.70,Rare:.58,Uncommon:.46,Common:.30}[p.trueRarity],desired=Math.max(.4,p.contract.annual*(1+rng.range(-.06,.18)));if(t&&worthKeeping&&rng.bool(keep)&&(t.capLimit-t.capUsed)+(p.contract?.annual||0)>=desired){p.contract={years:rng.int(2,5),annual:Math.round(desired*10)/10};events.push({type:'Renewal',playerId:p.id,rarity:p.trueRarity,position:p.position,teamId:t.id,years:p.contract.years,annual:p.contract.annual,overall:p.overall});tx(u,'Renewal',{playerId:p.id,toId:t.id});}else releaseToMarket(u,p,t,events,'Entered Free Agency');}}
  u.teams.nfl.forEach(t=>rebuildCap(t,u));cutPositionalExcess(u,events);fillNFLVacancies(u,rng,events);
  const leftovers=u.players.filter(p=>!p.retired&&!p.teamId&&p.league!=='COLLEGE').sort((a,b)=>rarityRank(b.trueRarity)-rarityRank(a.trueRarity)||b.overall-a.overall);for(const p of leftovers){if(rarityRank(p.trueRarity)>=1){const t=[...u.teams.ufl].sort((a,b)=>roster(u,a.id).length-roster(u,b.id).length)[0];p.teamId=t.id;p.league='UFL';p.contract={years:rng.int(1,2),annual:Math.round(rng.range(.4,1.8)*10)/10};u.freeAgents=u.freeAgents.filter(id=>id!==p.id);events.push({type:'UFL Signing',playerId:p.id,rarity:p.trueRarity,position:p.position,toId:t.id,years:p.contract.years,annual:p.contract.annual,overall:p.overall});tx(u,'UFL Signing',{playerId:p.id,toId:t.id});}}
  return events;
}
function publicDraftValue(p){const prestige=COLLEGES.find(c=>c.id===p.teamId)?.prestige||70;return(p.scouting?.expectedTier||0)*24+(p.currentSeason?playerProduction(p)*.05:0)+prestige*.08}
function runDraft(u,rng,declaredIds){const declared=declaredIds.map(id=>playerById(u,id)).filter(Boolean),order=[...u.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins||(a.current.pf-a.current.pa)-(b.current.pf-b.current.pa)),avail=[...declared],reveals=[];let overall=1;for(let round=1;round<=3;round++)for(const team of order){if(!avail.length)break;let bi=0,bs=-Infinity;avail.forEach((p,i)=>{const need=positionNeed(u,team,p.position),noise=(team.gm?.ratings?.scouting||team.gm?.overall||60)/100*rng.normal(0,3.2),v=publicDraftValue(p)+need*11+noise+(['QB','EDGE','WR','CB'].includes(p.position)?3:0);if(v>bs){bs=v;bi=i;}});const p=avail.splice(bi,1)[0],prior=p.teamId,scouting={...p.scouting,probs:{...(p.scouting?.probs||{})}};p.revealed=true;p.drafted=true;p.draftYear=u.year;p.draftRound=round;p.draftPick=overall;p.collegeSeasonsPlayed=p.collegeYear||4;p.league='NFL';p.teamId=team.id;p.collegeId=prior;p.collegeYear=null;p.proYear=0;p.age=Math.max(20,p.age);ensureDevelopmentProfile(p);p.overall=developmentOverall(p,'PRO',1);p.peakOverall=Math.max(p.peakOverall||p.overall,p.overall);p.contract={years:4,annual:round===1?8.5:round===2?4.2:2.2};team.capUsed+=p.contract.annual;const r={year:u.year,pick:overall,round,teamId:team.id,collegeId:prior,playerId:p.id,scouting,actualRarity:p.trueRarity,developmentPath:p.developmentPath,careerYears:p.careerYears,ceilingOverall:p.ceilingOverall};reveals.push(r);tx(u,'Draft',{playerId:p.id,toId:team.id,fromId:prior,detail:`Round ${round}, Pick ${overall}`});if(rarityRank(p.trueRarity)>=4||Math.abs((p.scouting?.expectedTier||0)-rarityRank(p.trueRarity))>=1.7)addNews(u,'DRAFT',88,`${team.name} takes ${p.name} at No. ${overall}`,`God View reveals ${p.trueRarity} talent with a ${p.developmentPath} career arc.`,team.id,p.id);overall++;}
  u.lastDraftReveal=reveals;u.draftHistory.unshift({year:u.year,reveals});for(const p of avail){if(rarityRank(p.trueRarity)>=1||['K','P','OT','OG','C','FB'].includes(p.position)){const t=[...u.teams.ufl].sort((a,b)=>roster(u,a.id).length-roster(u,b.id).length)[0];p.revealed=true;p.league='UFL';p.teamId=t.id;p.collegeId=p.collegeId||p.teamId;p.collegeYear=null;p.proYear=0;p.contract={years:1,annual:.7+rarityRank(p.trueRarity)*.22};}else{p.retired=true;p.teamId=null;}}return reveals}
function collegeTransfers(u,rng){const events=[],candidates=u.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&!p.declared&&p.collegeYear>=2).map(p=>{const t=teamById(u,p.teamId),publicTier=p.scouting?.expectedTier||0,prod=playerProduction(p);let chance=.025+publicTier*.012+(75-(t?.prestige||70))*.0015;if(p.personality==='Ambitious')chance+=.035;if(prod>90)chance+=.015;return[p,chance]}).filter(([p,c])=>rng.bool(clamp(c,.01,.16))).slice(0,rng.int(8,18));for(const[p]of candidates){const from=teamById(u,p.teamId),dest=rng.weighted(u.teams.college.filter(t=>t.id!==from.id).map(t=>[t,.2+Math.pow(t.prestige/100,3)*4]));if(!dest)continue;const fromId=from.id;p.teamId=dest.id;p.collegeId=dest.id;p.collegeHistory.push({year:u.year,type:'Transfer',fromId,toId:dest.id});const e={playerId:p.id,fromId,toId:dest.id,scouting:p.scouting?.label};events.push(e);tx(u,'College Transfer',e);if((p.scouting?.expectedTier||0)>=3)addNews(u,'TRANSFER',58,`${p.name} transfers to ${dest.name}`,`${p.position} prospect leaves ${from.name} for ${dest.name}.`,dest.id,p.id);}return events}
function tradeMarket(u,rng){
  const events=[],activity=new Map(u.teams.nfl.map(t=>[t.id,0])),moved=new Set(),ranked=[...u.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins),target=rng.int(18,28);
  const rebuildCap=t=>{const goodLeadership=(t.owner?.overall||t.owner?.ratings?.leadership||60)>=72&&(t.gm?.overall||60)>=72;return t.current.wins<=6&&goodLeadership?3:2};
  const eligiblePlayers=team=>roster(u,team.id,'NFL').filter(p=>!moved.has(p.id)&&p.draftYear!==u.year&&p.contract&&p.position!=='K'&&p.position!=='P');
  const tradeOne=(forceStar=false)=>{
    let sellers=[...u.teams.nfl].filter(t=>activity.get(t.id)<rebuildCap(t)&&eligiblePlayers(t).length).sort((a,b)=>a.current.wins-b.current.wins||(b.capUsed/b.capLimit)-(a.capUsed/a.capLimit));if(!sellers.length)return false;
    const from=rng.weighted(sellers.map(t=>[t,.4+(10-Math.min(10,t.current.wins))*.08+Math.max(0,t.capUsed-t.capLimit*.86)*.04]));
    let pool=eligiblePlayers(from).filter(p=>!forceStar||rarityRank(p.trueRarity)>=3);if(!pool.length&&forceStar)return false;
    pool.sort((a,b)=>{const av=rarityRank(a.trueRarity)*12+a.overall-(a.contract?.years||0)*1.5,bv=rarityRank(b.trueRarity)*12+b.overall-(b.contract?.years||0)*1.5;return forceStar?bv-av:Math.abs(bv-76)-Math.abs(av-76)});
    const p=forceStar?rng.pick(pool.slice(0,Math.min(8,pool.length))):rng.weighted(pool.map(x=>[x,1+Math.max(0,3-(x.contract?.years||3))*.6+Math.max(0,rarityRank(x.trueRarity)-1)*.25]));if(!p)return false;
    const salary=p.contract?.annual||0,buyers=u.teams.nfl.filter(t=>t.id!==from.id&&activity.get(t.id)<rebuildCap(t)&&(t.capLimit-t.capUsed)>=salary&&positionNeed(u,t,p.position)>.05).map(t=>({t,score:positionNeed(u,t,p.position)*18+(t.gm?.overall||60)*.12+(t.current.wins>=8?5:0)+(t.capLimit-t.capUsed)*.12})).sort((a,b)=>b.score-a.score);if(!buyers.length)return false;
    const to=rng.pick(buyers.slice(0,Math.min(5,buyers.length))).t,rar=rarityRank(p.trueRarity),detail=rar>=4?'Multiple premium draft picks':rar===3?'Day 1/2 draft capital':rar===2?'Mid-round draft capital':'Late-round / conditional draft capital';
    p.teamId=to.id;from.capUsed=Math.max(0,from.capUsed-salary);to.capUsed=Math.round((to.capUsed+salary)*10)/10;activity.set(from.id,activity.get(from.id)+1);activity.set(to.id,activity.get(to.id)+1);moved.add(p.id);
    const e={playerId:p.id,position:p.position,rarity:p.trueRarity,overall:p.overall,fromId:from.id,toId:to.id,detail,blockbuster:rar>=3};events.push(e);tx(u,'Trade',e);
    if(rar>=3)addNews(u,'BLOCKBUSTER',rar>=4?95:84,`${to.name} acquires ${p.name}`,`${p.trueRarity} ${p.position} moves from ${from.name} for ${detail.toLowerCase()}.`,to.id,p.id);else if(rar>=2&&rng.bool(.35))addNews(u,'TRADE',52,`${to.name} trades for ${p.name}`,`${p.position} depth and upside move across the league.`,to.id,p.id);return true;
  };
  const starTarget=rng.int(1,3);for(let i=0;i<starTarget;i++)tradeOne(true);let guard=0;while(events.length<target&&guard++<target*8)tradeOne(false);return events;
}
function trimNFLRosters(u){const events=[];cutPositionalExcess(u,events);return events}
function replaceStaffAtSource(u,rng,source,role,used){if(!source)return;const key=staffKey(role);source[key]=staffMember(rng,used,role,source.id);normalizeStaff(source[key],source.id,role);source[key].history=[{year:u.year,teamId:source.id,role,event:'Promoted into vacancy'}]}
function coachMarket(u,rng){
  const events=[],vacancies=[],movedStaff=new Set(),used=new Set(allTeams(u).flatMap(t=>[t.hc?.name,t.oc?.name,t.dc?.name]).filter(Boolean));u.coachFreeAgents=u.coachFreeAgents||[];
  // Career clocks create occasional retirements across the whole ecosystem; NFL retirements count toward its deliberately small turnover budget.
  let retiredNflHC=0,retiredNflCoord=0;
  for(const t of allTeams(u))for(const role of ['HC','OC','DC']){const key=staffKey(role),s=t[key];if(!s)continue;s.yearsCareer=(s.yearsCareer||0)+1;s.age=(s.age||40)+1;s.contractYears=(s.contractYears??3)-1;const nflBlocked=t.league==='NFL'&&((role==='HC'&&retiredNflHC>=2)||(role!=='HC'&&retiredNflCoord>=2));if(!nflBlocked&&s.yearsCareer>=s.careerLength&&rng.bool(t.league==='NFL'?.34:.42)){events.push({type:'Retirement',staffId:s.id,name:s.name,role,rarity:s.rarity,overall:s.overall,fromId:t.id});tx(u,'Coach Retirement',{staffId:s.id,fromId:t.id});t[key]=null;vacancies.push({team:t,role,reason:'Retirement'});if(t.league==='NFL'){if(role==='HC')retiredNflHC++;else retiredNflCoord++;}}}
  // NFL head-coach dismissals/resignations, deliberately capped to a realistic handful including retirements.
  let nflHcOpen=vacancies.filter(v=>v.team.league==='NFL'&&v.role==='HC').length;
  for(const t of [...u.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins)){if(nflHcOpen>=5)break;const hc=t.hc;if(!hc){vacancies.push({team:t,role:'HC',reason:'Vacancy'});continue;}const patience=(t.owner?.ratings?.leadership||65)/100,strength=getTeamStrength(u,t.id),wins=t.current.wins;let fire=wins<=4?.58:wins<=6?.34:wins<=8?.12:.015;fire*=1.25-.45*patience;const elite=['Legend','Generational'].includes(hc.rarity),resign=elite&&wins<=7&&strength<69&&rng.bool(hc.rarity==='Generational'?.28:.18);if(resign||rng.bool(fire)){t.hc=null;hc.teamId=null;hc.freeAgent=true;u.coachFreeAgents.push(hc);const type=resign?'Resigned':'Fired';events.push({type,staffId:hc.id,name:hc.name,role:'HC',rarity:hc.rarity,overall:hc.overall,fromId:t.id});tx(u,`Coach ${type}`,{staffId:hc.id,fromId:t.id});addNews(u,'COACHING',resign?75:62,`${hc.name} ${resign?'resigns from':'is fired by'} ${t.name}`,resign?`The ${hc.rarity} coach walks away after another underpowered season.`:`A ${wins}-${t.current.losses} season ends the tenure.`,t.id);vacancies.push({team:t,role:'HC',reason:type});nflHcOpen++;}else if(hc.contractYears<=0){hc.contractYears=rng.int(2,5);hc.salary=Math.round(hc.salary*rng.range(1.05,1.22)*10)/10;events.push({type:'Extension',staffId:hc.id,name:hc.name,role:'HC',rarity:hc.rarity,overall:hc.overall,teamId:t.id,years:hc.contractYears,salary:hc.salary});}}
  // A few coordinator changes on bad NFL teams; do not turn every offseason into a staff purge.
  let nflCoordOpen=vacancies.filter(v=>v.team.league==='NFL'&&['OC','DC'].includes(v.role)).length;
  for(const t of u.teams.nfl){for(const role of ['OC','DC']){const key=staffKey(role),s=t[key];if(!s||nflCoordOpen>=3)continue;const bad=t.current.wins<=6&&(role==='OC'?t.current.pf<360:t.current.pa>390);if((bad&&rng.bool(.12))||(s.contractYears<=0&&rng.bool(.10))){t[key]=null;s.teamId=null;s.freeAgent=true;u.coachFreeAgents.push(s);events.push({type:'Fired',staffId:s.id,name:s.name,role,rarity:s.rarity,overall:s.overall,fromId:t.id});vacancies.push({team:t,role,reason:'Coordinator change'});nflCoordOpen++;}else if(s.contractYears<=0){s.contractYears=rng.int(2,4);s.salary=Math.round(s.salary*rng.range(1.04,1.18)*10)/10;events.push({type:'Extension',staffId:s.id,name:s.name,role,rarity:s.rarity,overall:s.overall,teamId:t.id,years:s.contractYears,salary:s.salary});}}}
  // Fill vacancies from the actual coach market plus poachable coordinators / lower-league head coaches.
  const orderedVacancies=[...vacancies].sort((a,b)=>(a.team.league==='NFL'?0:a.team.league==='UFL'?1:2)-(b.team.league==='NFL'?0:b.team.league==='UFL'?1:2));
  for(const v of orderedVacancies){const role=v.role,team=v.team;let candidates=[];for(const s of u.coachFreeAgents){if(role==='HC'?['HC','OC','DC'].includes(s.role):s.role===role)candidates.push({s,source:null,market:true});}if(role==='HC'){for(const t of allTeams(u)){if(t.id===team.id)continue;for(const r of ['OC','DC'])if(t[r.toLowerCase()])candidates.push({s:t[r.toLowerCase()],source:t,market:false});if(t.league!=='NFL'&&t.hc)candidates.push({s:t.hc,source:t,market:false});}}else{for(const t of [...u.teams.ufl,...u.teams.college]){const s=t[role.toLowerCase()];if(s)candidates.push({s,source:t,market:false});}}
    candidates=candidates.filter(c=>c.s&&!movedStaff.has(c.s.id)).sort((a,b)=>(b.s.overall+rarityRank(b.s.rarity)*4+(b.market?3:0))-(a.s.overall+rarityRank(a.s.rarity)*4+(a.market?3:0)));let pick=candidates[0];if(!pick){const s=staffMember(rng,used,role,team.id);normalizeStaff(s,team.id,role);pick={s,source:null,market:false};}
    const s=pick.s,oldSource=pick.source;if(oldSource){const oldRole=s.role,srcKey=staffKey(oldRole);if(oldSource[srcKey]?.id===s.id)oldSource[srcKey]=null;replaceStaffAtSource(u,rng,oldSource,oldRole,used);if(oldSource[srcKey])movedStaff.add(oldSource[srcKey].id);}movedStaff.add(s.id);u.coachFreeAgents=u.coachFreeAgents.filter(x=>x.id!==s.id);s.freeAgent=false;s.teamId=team.id;s.role=role;s.contractYears=rng.int(2,5);s.salary=Math.round(staffSalary(role,s.rarity,s.overall)*rng.range(.92,1.18)*10)/10;s.history=s.history||[];s.history.push({year:u.year,teamId:team.id,role,event:oldSource?'Poached':'Signed'});team[staffKey(role)]=s;const type=oldSource?'Poached':'Hire';events.push({type,staffId:s.id,name:s.name,role,rarity:s.rarity,overall:s.overall,toId:team.id,fromId:oldSource?.id||null,salary:s.salary,years:s.contractYears});tx(u,`Coach ${type}`,{staffId:s.id,fromId:oldSource?.id||null,toId:team.id});addNews(u,'COACHING',role==='HC'?72:48,`${team.name} hires ${s.name}`,`${s.rarity} ${role} signs for ${s.contractYears} years${oldSource?` after leaving ${oldSource.name}`:''}.`,team.id);}
  return events;
}
function replenishFreshmen(u,rng,count){const before=new Set(u.players.map(p=>p.id)),active=u.players.filter(p=>!p.retired),counts={};RARITIES.forEach(r=>counts[r]=active.filter(p=>p.trueRarity===r).length);const needs={};Object.entries(TARGETS).forEach(([r,n])=>needs[r]=Math.max(0,n-(counts[r]||0)));const used=new Set(u.players.map(p=>p.name));used._rngNames=new Set(u.players.map(p=>p.legacyName||p.name));const slots=[],programs=u.teams.college;const activeEliteQBs=active.filter(p=>p.position==='QB'&&['Epic','Legend','Generational'].includes(p.trueRarity)).length,activeTopQBs=active.filter(p=>p.position==='QB'&&['Legend','Generational'].includes(p.trueRarity)).length;const forcedQBs=Math.min(count,Math.max(0,ELITE_QB_FLOOR-activeEliteQBs,TOP_QB_FLOOR-activeTopQBs));for(let i=0;i<count;i++){const program=rng.weighted(programs.map(p=>[p,Math.pow(p.prestige/100,2.7)*3+.35])),pos=i<forcedQBs?'QB':rng.weighted([['QB',12],['WR',16],['HB',10],['TE',5],['OT',8],['OG',5],['C',3],['EDGE',9],['DT',6],['LB',8],['CB',10],['S',6],['K',3],['P',3]]);slots.push({league:'COLLEGE',teamId:program.id,position:pos,collegeYear:1,programPrestige:program.prestige});}const assigned=Array(count).fill('Common'),available=new Set(slots.map((_,i)=>i));for(const rarity of ['Generational','Legend','Epic','Rare','Uncommon']){const quota=Math.min(needs[rarity]||0,available.size);for(let n=0;n<quota;n++){const currentEliteNew=slots.reduce((sum,s,i)=>sum+(s.position==='QB'&&['Epic','Legend','Generational'].includes(assigned[i])?1:0),0),currentTopNew=slots.reduce((sum,s,i)=>sum+(s.position==='QB'&&['Legend','Generational'].includes(assigned[i])?1:0),0),eliteNeed=Math.max(0,ELITE_QB_FLOOR-activeEliteQBs-currentEliteNew),topNeed=Math.max(0,TOP_QB_FLOOR-activeTopQBs-currentTopNew);const weights=[...available].map(i=>{const s=slots[i];let w=Math.pow(s.programPrestige/100,4)*2+.1;if(rarityRank(rarity)>=3&&['QB','WR','HB','CB','EDGE'].includes(s.position))w*=2.5;if(s.position==='QB'&&rarityRank(rarity)>=3&&eliteNeed>0)w*=35;if(s.position==='QB'&&['Legend','Generational'].includes(rarity)&&topNeed>0)w*=45;return[i,w]});const pick=rng.weighted(weights);assigned[pick]=rarity;available.delete(pick);}}rebalanceEliteQuarterbacks(slots,assigned,rng,active);slots.forEach((s,i)=>u.players.push(createPlayer(s,assigned[i],rng,used,u.meta.nextPlayerId++)));return u.players.filter(p=>!before.has(p.id)).map(p=>({playerId:p.id,collegeId:p.teamId,position:p.position,scouting:p.scouting?.label}))}

export function advanceOffseasonStage(universe){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Season Complete'){u.phase='Offseason';u.offseasonState.started=true;}if(u.phase!=='Offseason'){u.rngState=rng.state();return u;}const st=u.offseasonState,stages=st.stageNames||OFFSEASON_STAGES,idx=st.stageIndex,stage=stages[idx];if(!stage){st.complete=true;st.strengthEnd=st.strengthEnd||strengthSnapshot(u);u.phase='Ready for Next Season';u.rngState=rng.state();return u;}
  if(stage==='Coach Market')st.events.coachMarket=coachMarket(u,rng);
  else if(stage==='College Transfers')st.events.transfers=collegeTransfers(u,rng);
  else if(stage==='Retirements & Declarations'){st.events.retirements=processRetirements(u,rng);st.events.declarations=draftDeclarations(u,rng);st.declaredIds=st.events.declarations.map(x=>x.playerId);const active=u.players.filter(p=>!p.retired),gen=active.filter(p=>p.trueRarity==='Generational').length,leg=active.filter(p=>p.trueRarity==='Legend').length,urgent=Math.max(0,3-gen)+Math.max(0,10-leg);if(urgent>0)st.events.spawned.push(...replenishFreshmen(u,rng,urgent));}
  else if(stage==='Hall of Fame & Legacy'){const legacy=processLegacy(u,st.events.retirements||[]);st.events.hallOfFame=legacy.hallOfFame;st.events.retiredJerseys=legacy.retiredJerseys;}
  else if(stage==='Draft')st.events.draft=runDraft(u,rng,st.declaredIds||[]);
  else if(stage==='Trades & UFL')st.events.trades=tradeMarket(u,rng);
  else if(stage==='Development & New Class'){u.players.filter(p=>!p.retired&&p.league!=='COLLEGE').forEach(p=>developPlayer(p));u.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&!p.declared).forEach(p=>{p.collegeYear=Math.min(4,(p.collegeYear||1)+1);p.age++;developPlayer(p);});const targetCount=Math.max(130,Math.min(160,(st.declaredIds||[]).length||140)),remaining=Math.max(0,targetCount-(st.events.spawned?.length||0));st.events.spawned.push(...replenishFreshmen(u,rng,remaining));}
  else if(stage==='Free Agency'||stage==='Roster Cuts & Free Agency')st.events.freeAgency=contractAndFreeAgency(u,rng);
  st.strengthAfter=st.strengthAfter||{};st.strengthAfter[stage]=strengthSnapshot(u);st.stageIndex++;if(st.stageIndex>=stages.length){st.complete=true;st.strengthEnd=strengthSnapshot(u);u.phase='Ready for Next Season';u.offseasonHistory.unshift(cloneUniverse(st));u.offseasonHistory=u.offseasonHistory.slice(0,50);}assignUniverseFaceAssets(u.players||[]);u.rngState=rng.state();return u;
}
export function startNextSeason(universe){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Ready for Next Season'){const safety=[];cutPositionalExcess(u,safety);fillNFLVacancies(u,rng,safety);u.year++;u.phase='Preseason';u.seasonState=null;u.offseasonState=null;prepareSeason(u,rng);}assignUniverseFaceAssets(u.players||[]);u.rngState=rng.state();return u}
export function simulateYear(universe){let u=simulateToSeasonEnd(universe);u=beginOffseason(u);while(u.phase==='Offseason')u=advanceOffseasonStage(u);u=startNextSeason(u);return u}

export function getStandings(u,league){const list=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'];return league==='COLLEGE'?collegeRanking(list):standings(list)}
function displayUnit(raw){return Math.round(clamp(48+(raw-48)*1.18,45,98))}
export function getTeamStrengthProfile(u,teamId){
  const t=teamById(u,teamId);if(!t)return null;const r=roster(u,teamId),x=teamUnitRatings(t,r);
  const leagueBase=t.league==='COLLEGE'?54+(t.prestige||60)*.08:t.league==='UFL'?60:62;
  const k=r.filter(p=>p.position==='K').sort((a,b)=>b.overall-a.overall)[0]?.overall||leagueBase;
  const p=r.filter(p=>p.position==='P').sort((a,b)=>b.overall-a.overall)[0]?.overall||leagueBase;
  const hc=t.hc?.overall||60;
  const passing=displayUnit(x.passOff),rushing=displayUnit(x.rushOff),defense=displayUnit((x.passDef+x.rushDef)/2),other=displayUnit(k*.42+p*.38+hc*.20);
  const overall=Math.round(passing*.29+rushing*.22+defense*.37+other*.12);
  return{overall,passing,rushing,defense,other};
}
export function getTeamStrength(u,teamId){return getTeamStrengthProfile(u,teamId)?.overall??null}
export function getStrengthBand(u,teamId,metric='overall'){
  const t=teamById(u,teamId);if(!t)return{tier:2,label:'Average'};const teams=t.league==='NFL'?u.teams.nfl:t.league==='UFL'?u.teams.ufl:u.teams.college;
  const rows=teams.map(x=>({id:x.id,value:getTeamStrengthProfile(u,x.id)?.[metric]??0})).sort((a,b)=>b.value-a.value),idx=rows.findIndex(x=>x.id===teamId),pct=rows.length<=1?0.5:idx/(rows.length-1);
  if(pct<=.12)return{tier:5,label:'Elite'};if(pct<=.32)return{tier:4,label:'Strong'};if(pct<=.68)return{tier:3,label:'Average'};if(pct<=.88)return{tier:2,label:'Weak'};return{tier:1,label:'Very weak'};
}
export function getRoster(u,teamId){return roster(u,teamId)}
export function findTeam(u,id){return teamById(u,id)}
export function findPlayer(u,id){return playerById(u,id)}
export function getAllCoaches(u){const rows=[];for(const t of allTeams(u))for(const role of ['HC','OC','DC']){const s=t[staffKey(role)];if(s)rows.push({...s,currentTeamId:t.id,currentLeague:t.league})}for(const s of u.coachFreeAgents||[])rows.push({...s,currentTeamId:null,currentLeague:'FREE'});return rows}
