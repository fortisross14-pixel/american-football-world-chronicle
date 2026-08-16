import { makeRng } from './rng.js';
import { simulateGame, teamUnitRatings } from './match.js';
import { RARITIES, RARITY_META, createPlayer, staffMember, ensureDevelopmentProfile, developmentOverall } from './generate.js';
import { COLLEGES } from '../data/colleges.js';

const TARGETS={Generational:3,Legend:12,Epic:20,Rare:50,Uncommon:80};
export const OFFSEASON_STAGES=['Coach Market','College Transfers','Retirements & Declarations','Free Agency','Draft','Trades & UFL','Development & New Class'];
const OFFENSE=new Set(['QB','HB','FB','WR','TE','OT','OG','C','K','P']);
const DEFENSE=new Set(['EDGE','DT','LB','CB','S']);
const rarityRank=r=>RARITIES.indexOf(r);
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


function cloneUniverse(value){
  // structuredClone is absent on older iOS/Safari and some in-app browsers.
  if(typeof globalThis!=='undefined' && typeof globalThis.structuredClone==='function'){
    try{return globalThis.structuredClone(value)}catch(e){console.warn('structuredClone failed; using JSON clone',e)}
  }
  return JSON.parse(JSON.stringify(value));
}
export function ensureUniverse(universe){
  const u=universe;
  u.meta=u.meta||{};migrateCollegeNamespace(u);
  u.version='0.3.0';u.currentGames=u.currentGames||[];u.transactions=u.transactions||[];u.news=u.news||[];u.records=u.records||[];u.statHistory=u.statHistory||[];u.seasonHistory=u.seasonHistory||[];u.draftHistory=u.draftHistory||[];u.freeAgents=u.freeAgents||[];u.coachFreeAgents=u.coachFreeAgents||[];u.offseasonHistory=u.offseasonHistory||[];u.meta=u.meta||{};u.meta.nextPlayerId=u.meta.nextPlayerId||u.players.length+1;u.meta.nextNewsId=u.meta.nextNewsId||1;u.meta.nextStaffId=u.meta.nextStaffId||1;
  allTeams(u).forEach(t=>{t.history=t.history||{championships:0,playoffs:0,seasons:[]};t.history.seasons=t.history.seasons||[];t.current=t.current||{wins:0,losses:0,pf:0,pa:0,yards:0};[['OWNER','owner'],['GM','gm'],['HC','hc'],['OC','oc'],['DC','dc']].forEach(([role,key])=>{if(t[key])normalizeStaff(t[key],t.id,role)});});
  u.players.forEach(p=>{p.stats=p.stats||{career:{},seasons:[]};p.stats.career=p.stats.career||{};p.stats.seasons=p.stats.seasons||[];p.awards=p.awards||[];p.championships=p.championships||0;p.teamTitles=p.teamTitles||[];p.collegeHistory=p.collegeHistory||[];ensureDevelopmentProfile(p);});
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
function standings(teams){return [...teams].sort((a,b)=>b.current.wins-a.current.wins||(b.current.pf-b.current.pa)-(a.current.pf-a.current.pa)||b.current.pf-a.current.pf)}
function scheduleDescriptors(rng,u){
  const rows=[];
  buildNFLWeeks(u.teams.nfl,rng).forEach((pairs,i)=>pairs.forEach(([a,b],j)=>{const home=(i+j)%2===0?a:b,away=home===a?b:a;rows.push({week:i+1,league:'NFL',homeId:home.id,awayId:away.id})}));
  roundRobinRounds(rng.shuffle(u.teams.college)).slice(0,12).forEach((pairs,i)=>pairs.forEach(([a,b],j)=>{const home=(i+j)%2===0?a:b,away=home===a?b:a;rows.push({week:i+1,league:'COLLEGE',homeId:home.id,awayId:away.id})}));
  const rr=roundRobinRounds(rng.shuffle(u.teams.ufl)),ufl=[...rr,...rr.slice(0,3).map(r=>r.map(([a,b])=>[b,a]))];ufl.forEach((pairs,i)=>pairs.forEach(([a,b],j)=>{const home=(i+j)%2===0?a:b,away=home===a?b:a;rows.push({week:i+1,league:'UFL',homeId:home.id,awayId:away.id})}));
  return rows;
}
function prepareSeason(u,rng){resetCompetition(u,'NFL');resetCompetition(u,'COLLEGE');resetCompetition(u,'UFL');u.currentGames=[];u.seasonState={week:0,maxWeek:18,schedule:scheduleDescriptors(rng,u),regularComplete:false};u.phase='Regular Season';u.offseasonState=null;}
function simulateWeekMutable(u,rng){
  if(!u.seasonState||u.phase==='Preseason')prepareSeason(u,rng);if(u.phase!=='Regular Season')return;
  const week=u.seasonState.week+1;for(const d of u.seasonState.schedule.filter(x=>x.week===week)){const h=teamById(u,d.homeId,d.league),a=teamById(u,d.awayId,d.league),g=simulateGame(rng,h,a,roster(u,h.id,d.league),roster(u,a.id,d.league),{league:d.league,stage:'Regular Season',round:week});applyGame(u,g,true,true);u.currentGames.push(g);}u.seasonState.week=week;if(week>=u.seasonState.maxWeek)finishSeasonMutable(u,rng);
}
function playoffGame(u,rng,league,home,away,stage,round){const g=simulateGame(rng,home,away,roster(u,home.id,league),roster(u,away.id,league),{league,stage,round});u.currentGames.push(g);return g}
const winner=(g,u)=>teamById(u,g.homeScore>g.awayScore?g.homeId:g.awayId,g.league);
const loser=(g,u)=>teamById(u,g.homeScore>g.awayScore?g.awayId:g.homeId,g.league);
function markFinish(map,teams,label){teams.forEach(t=>{if(!map[t.id])map[t.id]=label})}
function simulateNFLPlayoffs(u,rng){
  const teams=u.teams.nfl,finish={};markFinish(finish,teams,'No Playoffs');const confs=['AFC','NFC'].map(c=>standings(teams.filter(t=>t.conference===c)).slice(0,7)),confChamps=[];
  for(const seeds of confs){seeds.forEach(t=>{t.history.playoffs++;finish[t.id]='Lost Wild Card'});const wc=[playoffGame(u,rng,'NFL',seeds[1],seeds[6],'Wild Card',1),playoffGame(u,rng,'NFL',seeds[2],seeds[5],'Wild Card',1),playoffGame(u,rng,'NFL',seeds[3],seeds[4],'Wild Card',1)];seeds[0]&&(finish[seeds[0].id]='Lost Divisional');wc.forEach(g=>finish[winner(g,u).id]='Lost Divisional');const surv=[seeds[0],...wc.map(g=>winner(g,u))].sort((a,b)=>seeds.indexOf(a)-seeds.indexOf(b));const d1=playoffGame(u,rng,'NFL',surv[0],surv[3],'Divisional',2),d2=playoffGame(u,rng,'NFL',surv[1],surv[2],'Divisional',2);[d1,d2].forEach(g=>finish[winner(g,u).id]='Lost Conference Championship');const c=playoffGame(u,rng,'NFL',winner(d1,u),winner(d2,u),'Conference Championship',3);finish[winner(c,u).id]='Lost Super Bowl';confChamps.push(winner(c,u));}
  const final=playoffGame(u,rng,'NFL',confChamps[0],confChamps[1],'Super Bowl',4),champion=winner(final,u),runnerUp=loser(final,u);finish[champion.id]='Super Bowl Champion';finish[runnerUp.id]='Lost Super Bowl';champion.history.championships++;return{champion,runnerUp,final,finish,regular:standings(teams)};
}
function simulateCollegePlayoffs(u,rng){
  const teams=u.teams.college,finish={};markFinish(finish,teams,'No Playoff');const ranked=standings(teams).sort((a,b)=>{const score=t=>t.current.wins*10+(t.current.pf-t.current.pa)/35+t.prestige/18;return score(b)-score(a)}).slice(0,12);ranked.forEach(t=>{t.history.playoffs++;finish[t.id]='Lost CFP First Round'});ranked.slice(0,4).forEach(t=>finish[t.id]='Lost CFP Quarterfinal');const r=[playoffGame(u,rng,'COLLEGE',ranked[4],ranked[11],'CFP First Round',1),playoffGame(u,rng,'COLLEGE',ranked[5],ranked[10],'CFP First Round',1),playoffGame(u,rng,'COLLEGE',ranked[6],ranked[9],'CFP First Round',1),playoffGame(u,rng,'COLLEGE',ranked[7],ranked[8],'CFP First Round',1)];r.forEach(g=>finish[winner(g,u).id]='Lost CFP Quarterfinal');const q=[playoffGame(u,rng,'COLLEGE',ranked[0],winner(r[3],u),'CFP Quarterfinal',2),playoffGame(u,rng,'COLLEGE',ranked[1],winner(r[2],u),'CFP Quarterfinal',2),playoffGame(u,rng,'COLLEGE',ranked[2],winner(r[1],u),'CFP Quarterfinal',2),playoffGame(u,rng,'COLLEGE',ranked[3],winner(r[0],u),'CFP Quarterfinal',2)];q.forEach(g=>finish[winner(g,u).id]='Lost CFP Semifinal');const s1=playoffGame(u,rng,'COLLEGE',winner(q[0],u),winner(q[3],u),'CFP Semifinal',3),s2=playoffGame(u,rng,'COLLEGE',winner(q[1],u),winner(q[2],u),'CFP Semifinal',3);finish[winner(s1,u).id]='Lost National Championship';finish[winner(s2,u).id]='Lost National Championship';const final=playoffGame(u,rng,'COLLEGE',winner(s1,u),winner(s2,u),'National Championship',4),champion=winner(final,u),runnerUp=loser(final,u);finish[champion.id]='National Champion';finish[runnerUp.id]='Lost National Championship';champion.history.championships++;return{champion,runnerUp,final,finish,regular:standings(teams)};
}
function simulateUFLPlayoffs(u,rng){const teams=u.teams.ufl,finish={};markFinish(finish,teams,'No Playoff');const rank=standings(teams),top=rank.slice(0,4);top.forEach(t=>{t.history.playoffs++;finish[t.id]='Lost Semifinal'});const s1=playoffGame(u,rng,'UFL',top[0],top[3],'UFL Semifinal',1),s2=playoffGame(u,rng,'UFL',top[1],top[2],'UFL Semifinal',1);finish[winner(s1,u).id]='Lost Championship';finish[winner(s2,u).id]='Lost Championship';const final=playoffGame(u,rng,'UFL',winner(s1,u),winner(s2,u),'UFL Championship',2),champion=winner(final,u),runnerUp=loser(final,u);finish[champion.id]='UFL Champion';finish[runnerUp.id]='Lost Championship';champion.history.championships++;return{champion,runnerUp,final,finish,regular:rank}}

function playerProduction(p){const s=p.currentSeason||{};if(p.position==='QB')return(s.passYards||0)/35+(s.passTD||0)*6-(s.interceptions||0)*3+(s.rushYards||0)/28+(s.rushTD||0)*5;if(['HB','FB'].includes(p.position))return(s.rushYards||0)/10+(s.rushTD||0)*7+(s.recYards||0)/18+(s.recTD||0)*6;if(['WR','TE'].includes(p.position))return(s.recYards||0)/10+(s.recTD||0)*8;if(DEFENSE.has(p.position))return(s.tackles||0)*.35+(s.sacks||0)*7+(s.defInterceptions||0)*8+(s.forcedFumbles||0)*6+(s.defensiveTD||0)*10;return 10}
function pickPlayerAward(u,league,name,kind='all'){
  let c=u.players.filter(p=>!p.retired&&p.league===league&&p.currentSeason);if(kind==='offense')c=c.filter(p=>OFFENSE.has(p.position));if(kind==='defense')c=c.filter(p=>DEFENSE.has(p.position));if(kind==='rookie')c=c.filter(p=>(p.proYear||0)<=1||p.draftYear===u.year);let best=null,bestScore=-1;
  for(const p of c){const t=teamById(u,p.teamId),wp=t?t.current.wins/Math.max(1,t.current.wins+t.current.losses):.5,posW=p.position==='QB'?1.13:['WR','HB','EDGE','CB'].includes(p.position)?1.02:.92,repeat=(name.includes('MVP')||name==='Heisman Trophy')?Math.pow(.80,p.mvpWins||0):1,score=playerProduction(p)*posW*(.72+wp*.5)*repeat;if(score>bestScore){bestScore=score;best=p;}}
  if(best){best.awards.push({year:u.year,name,league});if(name.includes('MVP')||name==='Heisman Trophy')best.mvpWins=(best.mvpWins||0)+1;}return best;
}
function pickCoachAward(u,league,name){const teams=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'];const best=[...teams].sort((a,b)=>(b.current.wins*2+(b.current.pf-b.current.pa)/100+(b.hc?.overall||0)/25)-(a.current.wins*2+(a.current.pf-a.current.pa)/100+(a.hc?.overall||0)/25))[0];if(best?.hc){best.hc.awards=best.hc.awards||[];best.hc.awards.push({year:u.year,name,league});}return best?.hc||null}
function awardSet(u){return{NFL:{mvp:pickPlayerAward(u,'NFL','NFL MVP'),opoy:pickPlayerAward(u,'NFL','Offensive Player of the Year','offense'),dpoy:pickPlayerAward(u,'NFL','Defensive Player of the Year','defense'),roy:pickPlayerAward(u,'NFL','Rookie of the Year','rookie'),coach:pickCoachAward(u,'NFL','Coach of the Year')},COLLEGE:{mvp:pickPlayerAward(u,'COLLEGE','Heisman Trophy'),opoy:pickPlayerAward(u,'COLLEGE','College Offensive Player of the Year','offense'),dpoy:pickPlayerAward(u,'COLLEGE','College Defensive Player of the Year','defense'),coach:pickCoachAward(u,'COLLEGE','College Coach of the Year')},UFL:{mvp:pickPlayerAward(u,'UFL','UFL MVP'),opoy:pickPlayerAward(u,'UFL','UFL Offensive Player of the Year','offense'),dpoy:pickPlayerAward(u,'UFL','UFL Defensive Player of the Year','defense'),coach:pickCoachAward(u,'UFL','UFL Coach of the Year')}}}
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
function archiveSeason(u,results){
  u.players.filter(p=>p.currentSeason).forEach(p=>{p.stats.seasons.push({year:u.year,league:p.league,teamId:p.teamId,overall:p.overall,...p.currentSeason});for(const k of ['games','passYards','passTD','interceptions','rushYards','rushTD','recYards','recTD','sacks','tackles','defInterceptions','forcedFumbles','defensiveTD'])p.stats.career[k]=(p.stats.career[k]||0)+(p.currentSeason[k]||0);});
  for(const [league,res] of Object.entries(results)){const teams=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'],rank=standings(teams);teams.forEach(t=>{const row={year:u.year,league,wins:t.current.wins,losses:t.current.losses,pf:t.current.pf,pa:t.current.pa,yards:t.current.yards,rank:rank.findIndex(x=>x.id===t.id)+1,finish:res.finish[t.id]||'No Playoff'};t.history.seasons.push(row);if(t.id===res.champion.id){for(const p of roster(u,t.id)){p.championships=(p.championships||0)+1;p.teamTitles.push({year:u.year,league,title:league==='NFL'?'Super Bowl':league==='COLLEGE'?'National Championship':'UFL Championship',teamId:t.id});}}});}
  recordYearStatHistory(u,u.year);
}
function finalScoreLabel(g,champion){return`${scoreOf(g,champion.id)}–${scoreOf(g,loser(g,{teams:{nfl:[],ufl:[],college:[]}})?.id)}`}
function leagueSummary(u,league,res,awards){const best=res.regular[0],g=res.final,champ=res.champion,runner=res.runnerUp;return{championId:champ.id,championRecord:`${champ.current.wins}-${champ.current.losses}`,runnerUpId:runner.id,runnerUpRecord:`${runner.current.wins}-${runner.current.losses}`,finalScore:`${scoreOf(g,champ.id)}-${scoreOf(g,runner.id)}`,bestRecordTeamId:best.id,bestRecord:`${best.current.wins}-${best.current.losses}`,awards:{mvpId:awards.mvp?.id||null,opoyId:awards.opoy?.id||null,dpoyId:awards.dpoy?.id||null,royId:awards.roy?.id||null,coachId:awards.coach?.id||null}}}
function finishSeasonMutable(u,rng){
  if(u.phase!=='Regular Season')return;const results={NFL:simulateNFLPlayoffs(u,rng),COLLEGE:simulateCollegePlayoffs(u,rng),UFL:simulateUFLPlayoffs(u,rng)},awards=awardSet(u);extractRecords(u,u.currentGames);archiveSeason(u,results);
  const summary={year:u.year,NFL:leagueSummary(u,'NFL',results.NFL,awards.NFL),COLLEGE:leagueSummary(u,'COLLEGE',results.COLLEGE,awards.COLLEGE),UFL:leagueSummary(u,'UFL',results.UFL,awards.UFL)};summary.nflChampionId=summary.NFL.championId;summary.collegeChampionId=summary.COLLEGE.championId;summary.uflChampionId=summary.UFL.championId;summary.nflMvpId=summary.NFL.awards.mvpId;summary.heismanId=summary.COLLEGE.awards.mvpId;summary.uflMvpId=summary.UFL.awards.mvpId;u.seasonHistory.unshift(summary);
  addNews(u,'CHAMPIONSHIP',100,`${results.NFL.champion.name} wins the Super Bowl`,`${results.NFL.champion.name} defeats ${results.NFL.runnerUp.name} ${summary.NFL.finalScore}.`,results.NFL.champion.id);addNews(u,'COLLEGE',92,`${results.COLLEGE.champion.name} wins the national championship`,`${results.COLLEGE.champion.name} defeats ${results.COLLEGE.runnerUp.name} ${summary.COLLEGE.finalScore}.`,results.COLLEGE.champion.id);addNews(u,'UFL',78,`${results.UFL.champion.name} wins the UFL Championship`,`${results.UFL.champion.name} defeats ${results.UFL.runnerUp.name} ${summary.UFL.finalScore}.`,results.UFL.champion.id);
  for(const [league,set] of Object.entries(awards))for(const [key,p]of Object.entries(set)){if(p&&key!=='coach')addNews(u,'AWARD',key==='mvp'?88:58,`${p.name} wins ${league==='COLLEGE'&&key==='mvp'?'the Heisman Trophy':key==='mvp'?`${league} MVP`:key.toUpperCase()}`,`Year ${u.year} award honors ${p.name}.`,p.teamId,p.id)}
  u.phase='Season Complete';u.seasonState.regularComplete=true;u.offseasonState={year:u.year,stageIndex:0,started:false,complete:false,summary,events:{coachMarket:[],transfers:[],retirements:[],declarations:[],freeAgency:[],draft:[],trades:[],spawned:[]},declaredIds:[]};
}

export function simulateWeeks(universe,count=1){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Preseason'||!u.seasonState)prepareSeason(u,rng);for(let i=0;i<count&&u.phase==='Regular Season';i++)simulateWeekMutable(u,rng);u.rngState=rng.state();return u}
export function simulateToSeasonEnd(universe){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Preseason'||!u.seasonState)prepareSeason(u,rng);while(u.phase==='Regular Season')simulateWeekMutable(u,rng);u.rngState=rng.state();return u}
export function beginOffseason(universe){const u=ensureUniverse(cloneUniverse(universe));if(u.phase==='Season Complete'){u.phase='Offseason';u.offseasonState=u.offseasonState||{year:u.year,stageIndex:0,started:true,events:{}};u.offseasonState.started=true;}return u}

function tx(u,type,detail={}){const row={year:u.year,type,...detail};u.transactions.unshift(row);return row}
function processRetirements(u,rng){const out=[];for(const p of u.players.filter(p=>!p.retired&&p.league!=='COLLEGE')){p.proYear=(p.proYear||0)+1;p.age++;const forced=p.proYear>=p.careerYears,early=p.proYear>=7&&rng.bool(Math.max(0,(p.proYear-p.careerYears+2)*.06));if(forced||early){const oldTeam=p.teamId;p.retired=true;p.teamId=null;out.push({playerId:p.id,teamId:oldTeam,rarity:p.trueRarity,position:p.position,careerYears:p.proYear});tx(u,'Retirement',{playerId:p.id,fromId:oldTeam});if(rarityRank(p.trueRarity)>=3)addNews(u,'RETIREMENT',75,`${p.name} retires`,`${p.trueRarity} ${p.position} closes a ${p.proYear}-season professional career.`,oldTeam,p.id);}}return out}
function developPlayer(p){ensureDevelopmentProfile(p);const phase=p.league==='COLLEGE'?'COLLEGE':'PRO',year=phase==='COLLEGE'?(p.collegeYear||1):Math.min(p.careerYears||14,(p.proYear||0)+1);p.overall=developmentOverall(p,phase,year);p.peakOverall=Math.max(p.peakOverall||p.overall,p.overall)}
function positionNeed(u,team,pos){const same=roster(u,team.id).filter(p=>p.position===pos);if(!same.length)return 1;return clamp((78-Math.max(...same.map(p=>p.overall)))/25,0,1)}
function draftDeclarations(u,rng){const out=[];for(const p of u.players.filter(p=>!p.retired&&p.league==='COLLEGE')){if(p.collegeYear>=4||(p.collegeYear===3&&['Legend','Generational'].includes(p.trueRarity)&&rng.bool(.58))){p.declared=true;out.push({playerId:p.id,collegeId:p.teamId,scouting:p.scouting?.label||'Unknown'});}}return out}
function contractAndFreeAgency(u,rng){const events=[];u.freeAgents=[];for(const p of u.players.filter(p=>!p.retired&&['NFL','UFL'].includes(p.league)&&p.contract)){if(p.draftYear===u.year)continue;p.contract.years--;if(p.contract.years<=0){const t=teamById(u,p.teamId),room=t?t.capLimit-t.capUsed:0,keep={Generational:.82,Legend:.74,Epic:.62,Rare:.50,Uncommon:.42,Common:.30}[p.trueRarity],desired=Math.max(.4,p.contract.annual*(1+rng.range(-.08,.22)));if(t&&rng.bool(keep)&&room+Math.max(0,p.contract.annual)>=desired){p.contract={years:rng.int(2,5),annual:Math.round(desired*10)/10};events.push({type:'Renewal',playerId:p.id,rarity:p.trueRarity,teamId:t.id,years:p.contract.years,annual:p.contract.annual});tx(u,'Renewal',{playerId:p.id,toId:t.id});}else{if(t)t.capUsed=Math.max(0,t.capUsed-p.contract.annual);events.push({type:'Entered Free Agency',playerId:p.id,rarity:p.trueRarity,fromId:t?.id||null});p.teamId=null;p.contract=null;u.freeAgents.push(p.id);}}}
  u.teams.nfl.forEach(t=>t.capUsed=Math.round(sum(roster(u,t.id),p=>p.contract?.annual||0)*10)/10);const fa=u.players.filter(p=>u.freeAgents.includes(p.id)).sort((a,b)=>rarityRank(b.trueRarity)-rarityRank(a.trueRarity)||b.overall-a.overall);
  for(const p of fa){const cand=u.teams.nfl.map(t=>({t,room:t.capLimit-t.capUsed,need:positionNeed(u,t,p.position)})).filter(x=>x.room>1).sort((a,b)=>(b.room+b.need*5+b.t.gm.overall*.12)-(a.room+a.need*5+a.t.gm.overall*.12));let choices=cand.slice(0,Math.max(3,Math.min(10,cand.length)));if(!choices.length&&rarityRank(p.trueRarity)>=3){for(const t of [...u.teams.nfl].sort((a,b)=>b.prestige-a.prestige)){const cut=roster(u,t.id).filter(x=>x.trueRarity==='Common'&&x.position!==p.position).sort((a,b)=>a.overall-b.overall)[0];if(cut){t.capUsed-=cut.contract?.annual||0;cut.teamId=null;cut.retired=true;choices=[{t,room:t.capLimit-t.capUsed,need:positionNeed(u,t,p.position)}];break;}}}if(choices.length){const bid=choices[0],base={Generational:38,Legend:28,Epic:18,Rare:10,Uncommon:5,Common:2}[p.trueRarity],annual=Math.min(bid.room,Math.round(base*({QB:1.45,WR:1.15,EDGE:1.12,CB:1.08,HB:.78}[p.position]||1)*10)/10);if(annual>=.8){p.teamId=bid.t.id;p.league='NFL';p.contract={years:rng.int(2,5),annual};bid.t.capUsed+=annual;u.freeAgents=u.freeAgents.filter(id=>id!==p.id);events.push({type:'Signed',playerId:p.id,rarity:p.trueRarity,toId:bid.t.id,years:p.contract.years,annual});tx(u,'Free Agent Signing',{playerId:p.id,toId:bid.t.id});addNews(u,'FREE AGENCY',rarityRank(p.trueRarity)>=3?82:rarityRank(p.trueRarity)>=2?55:25,`${bid.t.name} signs ${p.name}`,`${p.trueRarity} ${p.position} joins on a ${p.contract.years}-year deal.`,bid.t.id,p.id);}}if(!p.teamId&&rarityRank(p.trueRarity)>=1){const t=[...u.teams.ufl].sort((a,b)=>roster(u,a.id).length-roster(u,b.id).length)[0];p.teamId=t.id;p.league='UFL';p.contract={years:rng.int(1,2),annual:Math.round(rng.range(.4,1.8)*10)/10};u.freeAgents=u.freeAgents.filter(id=>id!==p.id);events.push({type:'UFL Signing',playerId:p.id,rarity:p.trueRarity,toId:t.id,years:p.contract.years,annual:p.contract.annual});tx(u,'UFL Signing',{playerId:p.id,toId:t.id});}}
  return events;
}
function publicDraftValue(p){const prestige=COLLEGES.find(c=>c.id===p.teamId)?.prestige||70;return(p.scouting?.expectedTier||0)*24+(p.currentSeason?playerProduction(p)*.05:0)+prestige*.08}
function runDraft(u,rng,declaredIds){const declared=declaredIds.map(id=>playerById(u,id)).filter(Boolean),order=[...u.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins||(a.current.pf-a.current.pa)-(b.current.pf-b.current.pa)),avail=[...declared],reveals=[];let overall=1;for(let round=1;round<=3;round++)for(const team of order){if(!avail.length)break;let bi=0,bs=-Infinity;avail.forEach((p,i)=>{const need=positionNeed(u,team,p.position),noise=(team.gm?.ratings?.scouting||team.gm?.overall||60)/100*rng.normal(0,3.2),v=publicDraftValue(p)+need*11+noise+(['QB','EDGE','WR','CB'].includes(p.position)?3:0);if(v>bs){bs=v;bi=i;}});const p=avail.splice(bi,1)[0],prior=p.teamId,scouting={...p.scouting,probs:{...(p.scouting?.probs||{})}};p.revealed=true;p.drafted=true;p.draftYear=u.year;p.draftRound=round;p.draftPick=overall;p.collegeSeasonsPlayed=p.collegeYear||4;p.league='NFL';p.teamId=team.id;p.collegeId=prior;p.collegeYear=null;p.proYear=0;p.age=Math.max(20,p.age);ensureDevelopmentProfile(p);p.overall=developmentOverall(p,'PRO',1);p.peakOverall=Math.max(p.peakOverall||p.overall,p.overall);p.contract={years:4,annual:round===1?8.5:round===2?4.2:2.2};team.capUsed+=p.contract.annual;const r={year:u.year,pick:overall,round,teamId:team.id,collegeId:prior,playerId:p.id,scouting,actualRarity:p.trueRarity,developmentPath:p.developmentPath,careerYears:p.careerYears,ceilingOverall:p.ceilingOverall};reveals.push(r);tx(u,'Draft',{playerId:p.id,toId:team.id,fromId:prior,detail:`Round ${round}, Pick ${overall}`});if(rarityRank(p.trueRarity)>=4||Math.abs((p.scouting?.expectedTier||0)-rarityRank(p.trueRarity))>=1.7)addNews(u,'DRAFT',88,`${team.name} takes ${p.name} at No. ${overall}`,`God View reveals ${p.trueRarity} talent with a ${p.developmentPath} career arc.`,team.id,p.id);overall++;}
  u.lastDraftReveal=reveals;u.draftHistory.unshift({year:u.year,reveals});for(const p of avail){if(rarityRank(p.trueRarity)>=1){const t=[...u.teams.ufl].sort((a,b)=>roster(u,a.id).length-roster(u,b.id).length)[0];p.revealed=true;p.league='UFL';p.teamId=t.id;p.collegeId=p.collegeId||p.teamId;p.collegeYear=null;p.proYear=0;p.contract={years:1,annual:.7+rarityRank(p.trueRarity)*.22};}else{p.retired=true;p.teamId=null;}}return reveals}
function collegeTransfers(u,rng){const events=[],candidates=u.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&!p.declared&&p.collegeYear>=2).map(p=>{const t=teamById(u,p.teamId),publicTier=p.scouting?.expectedTier||0,prod=playerProduction(p);let chance=.025+publicTier*.012+(75-(t?.prestige||70))*.0015;if(p.personality==='Ambitious')chance+=.035;if(prod>90)chance+=.015;return[p,chance]}).filter(([p,c])=>rng.bool(clamp(c,.01,.16))).slice(0,rng.int(8,18));for(const[p]of candidates){const from=teamById(u,p.teamId),dest=rng.weighted(u.teams.college.filter(t=>t.id!==from.id).map(t=>[t,.2+Math.pow(t.prestige/100,3)*4]));if(!dest)continue;const fromId=from.id;p.teamId=dest.id;p.collegeId=dest.id;p.collegeHistory.push({year:u.year,type:'Transfer',fromId,toId:dest.id});const e={playerId:p.id,fromId,toId:dest.id,scouting:p.scouting?.label};events.push(e);tx(u,'College Transfer',e);if((p.scouting?.expectedTier||0)>=3)addNews(u,'TRANSFER',58,`${p.name} transfers to ${dest.name}`,`${p.position} prospect leaves ${from.name} for ${dest.name}.`,dest.id,p.id);}return events}
function blockbusterTrade(u,rng){const ranked=[...u.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins),low=new Set(ranked.slice(0,16).map(t=>t.id));let stars=u.players.filter(p=>!p.retired&&p.league==='NFL'&&rarityRank(p.trueRarity)>=3&&low.has(p.teamId)&&p.draftYear!==u.year);if(!stars.length)stars=u.players.filter(p=>!p.retired&&p.league==='NFL'&&rarityRank(p.trueRarity)>=3&&p.draftYear!==u.year);if(!stars.length)return[];stars.sort((a,b)=>(a.contract?.years||9)-(b.contract?.years||9)||rarityRank(b.trueRarity)-rarityRank(a.trueRarity));const p=rng.pick(stars.slice(0,Math.min(8,stars.length))),from=teamById(u,p.teamId);const contenders=[...u.teams.nfl].filter(t=>t.id!==from.id&&t.current.wins>=8).sort((a,b)=>(positionNeed(u,b,p.position)*10+(b.capLimit-b.capUsed)+b.gm.overall*.08)-(positionNeed(u,a,p.position)*10+(a.capLimit-a.capUsed)+a.gm.overall*.08));const to=contenders[0]||u.teams.nfl.find(t=>t.id!==from.id);if(!to)return[];const salary=p.contract?.annual||5;p.teamId=to.id;from.capUsed=Math.max(0,from.capUsed-salary);to.capUsed+=salary;const e={playerId:p.id,rarity:p.trueRarity,fromId:from.id,toId:to.id,detail:'Blockbuster: future draft capital'};tx(u,'Trade',e);addNews(u,'BLOCKBUSTER',94,`${to.name} acquires ${p.name}`,`${p.trueRarity} ${p.position} moves from ${from.name} in the offseason's blockbuster.`,to.id,p.id);return[e]}
function trimNFLRosters(u){u.teams.nfl.forEach(t=>{const cut=()=>{const c=roster(u,t.id).filter(p=>p.trueRarity!=='Generational').sort((a,b)=>rarityRank(a.trueRarity)-rarityRank(b.trueRarity)||a.overall-b.overall)[0];if(!c)return false;t.capUsed=Math.max(0,t.capUsed-(c.contract?.annual||0));c.teamId=null;if(rarityRank(c.trueRarity)>=1)u.freeAgents.push(c.id);else c.retired=true;return true};while(roster(u,t.id).length>27)if(!cut())break;while(t.capUsed>t.capLimit)if(!cut())break;t.capUsed=Math.round(sum(roster(u,t.id),p=>p.contract?.annual||0)*10)/10;})}
function replaceStaffAtSource(u,rng,source,role,used){if(!source)return;const key=staffKey(role);source[key]=staffMember(rng,used,role,source.id);normalizeStaff(source[key],source.id,role);source[key].history=[{year:u.year,teamId:source.id,role,event:'Promoted into vacancy'}]}
function coachMarket(u,rng){
  const events=[],vacancies=[],movedStaff=new Set(),used=new Set(allTeams(u).flatMap(t=>[t.hc?.name,t.oc?.name,t.dc?.name]).filter(Boolean));u.coachFreeAgents=u.coachFreeAgents||[];
  // Career clocks create occasional retirements across the whole ecosystem; NFL retirements count toward its deliberately small turnover budget.
  let retiredNflHC=0,retiredNflCoord=0;
  for(const t of allTeams(u))for(const role of ['HC','OC','DC']){const key=staffKey(role),s=t[key];if(!s)continue;s.yearsCareer=(s.yearsCareer||0)+1;s.age=(s.age||40)+1;s.contractYears=(s.contractYears??3)-1;const nflBlocked=t.league==='NFL'&&((role==='HC'&&retiredNflHC>=2)||(role!=='HC'&&retiredNflCoord>=2));if(!nflBlocked&&s.yearsCareer>=s.careerLength&&rng.bool(t.league==='NFL'?.34:.42)){events.push({type:'Retirement',staffId:s.id,name:s.name,role,rarity:s.rarity,fromId:t.id});tx(u,'Coach Retirement',{staffId:s.id,fromId:t.id});t[key]=null;vacancies.push({team:t,role,reason:'Retirement'});if(t.league==='NFL'){if(role==='HC')retiredNflHC++;else retiredNflCoord++;}}}
  // NFL head-coach dismissals/resignations, deliberately capped to a realistic handful including retirements.
  let nflHcOpen=vacancies.filter(v=>v.team.league==='NFL'&&v.role==='HC').length;
  for(const t of [...u.teams.nfl].sort((a,b)=>a.current.wins-b.current.wins)){if(nflHcOpen>=5)break;const hc=t.hc;if(!hc){vacancies.push({team:t,role:'HC',reason:'Vacancy'});continue;}const patience=(t.owner?.ratings?.leadership||65)/100,strength=getTeamStrength(u,t.id),wins=t.current.wins;let fire=wins<=4?.58:wins<=6?.34:wins<=8?.12:.015;fire*=1.25-.45*patience;const elite=['Legend','Generational'].includes(hc.rarity),resign=elite&&wins<=7&&strength<69&&rng.bool(hc.rarity==='Generational'?.28:.18);if(resign||rng.bool(fire)){t.hc=null;hc.teamId=null;hc.freeAgent=true;u.coachFreeAgents.push(hc);const type=resign?'Resigned':'Fired';events.push({type,staffId:hc.id,name:hc.name,role:'HC',rarity:hc.rarity,fromId:t.id});tx(u,`Coach ${type}`,{staffId:hc.id,fromId:t.id});addNews(u,'COACHING',resign?75:62,`${hc.name} ${resign?'resigns from':'is fired by'} ${t.name}`,resign?`The ${hc.rarity} coach walks away after another underpowered season.`:`A ${wins}-${t.current.losses} season ends the tenure.`,t.id);vacancies.push({team:t,role:'HC',reason:type});nflHcOpen++;}else if(hc.contractYears<=0){hc.contractYears=rng.int(2,5);hc.salary=Math.round(hc.salary*rng.range(1.05,1.22)*10)/10;events.push({type:'Extension',staffId:hc.id,name:hc.name,role:'HC',rarity:hc.rarity,teamId:t.id,years:hc.contractYears,salary:hc.salary});}}
  // A few coordinator changes on bad NFL teams; do not turn every offseason into a staff purge.
  let nflCoordOpen=vacancies.filter(v=>v.team.league==='NFL'&&['OC','DC'].includes(v.role)).length;
  for(const t of u.teams.nfl){for(const role of ['OC','DC']){const key=staffKey(role),s=t[key];if(!s||nflCoordOpen>=3)continue;const bad=t.current.wins<=6&&(role==='OC'?t.current.pf<360:t.current.pa>390);if((bad&&rng.bool(.12))||(s.contractYears<=0&&rng.bool(.10))){t[key]=null;s.teamId=null;s.freeAgent=true;u.coachFreeAgents.push(s);events.push({type:'Fired',staffId:s.id,name:s.name,role,rarity:s.rarity,fromId:t.id});vacancies.push({team:t,role,reason:'Coordinator change'});nflCoordOpen++;}else if(s.contractYears<=0){s.contractYears=rng.int(2,4);s.salary=Math.round(s.salary*rng.range(1.04,1.18)*10)/10;events.push({type:'Extension',staffId:s.id,name:s.name,role,rarity:s.rarity,teamId:t.id,years:s.contractYears,salary:s.salary});}}}
  // Fill vacancies from the actual coach market plus poachable coordinators / lower-league head coaches.
  const orderedVacancies=[...vacancies].sort((a,b)=>(a.team.league==='NFL'?0:a.team.league==='UFL'?1:2)-(b.team.league==='NFL'?0:b.team.league==='UFL'?1:2));
  for(const v of orderedVacancies){const role=v.role,team=v.team;let candidates=[];for(const s of u.coachFreeAgents){if(role==='HC'?['HC','OC','DC'].includes(s.role):s.role===role)candidates.push({s,source:null,market:true});}if(role==='HC'){for(const t of allTeams(u)){if(t.id===team.id)continue;for(const r of ['OC','DC'])if(t[r.toLowerCase()])candidates.push({s:t[r.toLowerCase()],source:t,market:false});if(t.league!=='NFL'&&t.hc)candidates.push({s:t.hc,source:t,market:false});}}else{for(const t of [...u.teams.ufl,...u.teams.college]){const s=t[role.toLowerCase()];if(s)candidates.push({s,source:t,market:false});}}
    candidates=candidates.filter(c=>c.s&&!movedStaff.has(c.s.id)).sort((a,b)=>(b.s.overall+rarityRank(b.s.rarity)*4+(b.market?3:0))-(a.s.overall+rarityRank(a.s.rarity)*4+(a.market?3:0)));let pick=candidates[0];if(!pick){const s=staffMember(rng,used,role,team.id);normalizeStaff(s,team.id,role);pick={s,source:null,market:false};}
    const s=pick.s,oldSource=pick.source;if(oldSource){const oldRole=s.role,srcKey=staffKey(oldRole);if(oldSource[srcKey]?.id===s.id)oldSource[srcKey]=null;replaceStaffAtSource(u,rng,oldSource,oldRole,used);if(oldSource[srcKey])movedStaff.add(oldSource[srcKey].id);}movedStaff.add(s.id);u.coachFreeAgents=u.coachFreeAgents.filter(x=>x.id!==s.id);s.freeAgent=false;s.teamId=team.id;s.role=role;s.contractYears=rng.int(2,5);s.salary=Math.round(staffSalary(role,s.rarity,s.overall)*rng.range(.92,1.18)*10)/10;s.history=s.history||[];s.history.push({year:u.year,teamId:team.id,role,event:oldSource?'Poached':'Signed'});team[staffKey(role)]=s;const type=oldSource?'Poached':'Hire';events.push({type,staffId:s.id,name:s.name,role,rarity:s.rarity,toId:team.id,fromId:oldSource?.id||null,salary:s.salary,years:s.contractYears});tx(u,`Coach ${type}`,{staffId:s.id,fromId:oldSource?.id||null,toId:team.id});addNews(u,'COACHING',role==='HC'?72:48,`${team.name} hires ${s.name}`,`${s.rarity} ${role} signs for ${s.contractYears} years${oldSource?` after leaving ${oldSource.name}`:''}.`,team.id);}
  return events;
}
function replenishFreshmen(u,rng,count){const before=new Set(u.players.map(p=>p.id)),active=u.players.filter(p=>!p.retired),counts={};RARITIES.forEach(r=>counts[r]=active.filter(p=>p.trueRarity===r).length);const needs={};Object.entries(TARGETS).forEach(([r,n])=>needs[r]=Math.max(0,n-(counts[r]||0)));const used=new Set(u.players.map(p=>p.name)),slots=[],programs=u.teams.college;for(let i=0;i<count;i++){const program=rng.weighted(programs.map(p=>[p,Math.pow(p.prestige/100,2.7)*3+.35])),pos=rng.weighted([['QB',12],['WR',16],['HB',10],['TE',5],['OT',8],['OG',5],['C',3],['EDGE',9],['DT',6],['LB',8],['CB',10],['S',6],['K',1],['P',1]]);slots.push({league:'COLLEGE',teamId:program.id,position:pos,collegeYear:1,programPrestige:program.prestige});}const assigned=Array(count).fill('Common'),available=new Set(slots.map((_,i)=>i));for(const rarity of ['Generational','Legend','Epic','Rare','Uncommon']){const quota=Math.min(needs[rarity]||0,available.size);for(let n=0;n<quota;n++){const weights=[...available].map(i=>{const s=slots[i];let w=Math.pow(s.programPrestige/100,4)*2+.1;if(rarityRank(rarity)>=3&&['QB','WR','HB','CB','EDGE'].includes(s.position))w*=2.5;return[i,w]});const pick=rng.weighted(weights);assigned[pick]=rarity;available.delete(pick);}}slots.forEach((s,i)=>u.players.push(createPlayer(s,assigned[i],rng,used,u.meta.nextPlayerId++)));return u.players.filter(p=>!before.has(p.id)).map(p=>({playerId:p.id,collegeId:p.teamId,position:p.position,scouting:p.scouting?.label}))}

export function advanceOffseasonStage(universe){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Season Complete'){u.phase='Offseason';u.offseasonState.started=true;}if(u.phase!=='Offseason'){u.rngState=rng.state();return u;}const st=u.offseasonState,idx=st.stageIndex,stage=OFFSEASON_STAGES[idx];if(!stage){st.complete=true;u.phase='Ready for Next Season';u.rngState=rng.state();return u;}
  if(stage==='Coach Market')st.events.coachMarket=coachMarket(u,rng);
  else if(stage==='College Transfers')st.events.transfers=collegeTransfers(u,rng);
  else if(stage==='Retirements & Declarations'){st.events.retirements=processRetirements(u,rng);st.events.declarations=draftDeclarations(u,rng);st.declaredIds=st.events.declarations.map(x=>x.playerId);const active=u.players.filter(p=>!p.retired),gen=active.filter(p=>p.trueRarity==='Generational').length,leg=active.filter(p=>p.trueRarity==='Legend').length,urgent=Math.max(0,3-gen)+Math.max(0,10-leg);if(urgent>0)st.events.spawned.push(...replenishFreshmen(u,rng,urgent));}
  else if(stage==='Free Agency')st.events.freeAgency=contractAndFreeAgency(u,rng);
  else if(stage==='Draft')st.events.draft=runDraft(u,rng,st.declaredIds||[]);
  else if(stage==='Trades & UFL'){st.events.trades=blockbusterTrade(u,rng);trimNFLRosters(u);}
  else if(stage==='Development & New Class'){u.players.filter(p=>!p.retired&&p.league!=='COLLEGE').forEach(p=>developPlayer(p));u.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&!p.declared).forEach(p=>{p.collegeYear=Math.min(4,(p.collegeYear||1)+1);p.age++;developPlayer(p);});const targetCount=Math.max(130,Math.min(160,(st.declaredIds||[]).length||140)),remaining=Math.max(0,targetCount-(st.events.spawned?.length||0));st.events.spawned.push(...replenishFreshmen(u,rng,remaining));}
  st.stageIndex++;if(st.stageIndex>=OFFSEASON_STAGES.length){st.complete=true;u.phase='Ready for Next Season';u.offseasonHistory.unshift(cloneUniverse(st));u.offseasonHistory=u.offseasonHistory.slice(0,50);}u.rngState=rng.state();return u;
}
export function startNextSeason(universe){const u=ensureUniverse(cloneUniverse(universe)),rng=makeRng(u.rngState||u.seed);if(u.phase==='Ready for Next Season'){u.year++;u.phase='Preseason';u.seasonState=null;u.offseasonState=null;prepareSeason(u,rng);}u.rngState=rng.state();return u}
export function simulateYear(universe){let u=simulateToSeasonEnd(universe);u=beginOffseason(u);while(u.phase==='Offseason')u=advanceOffseasonStage(u);u=startNextSeason(u);return u}

export function getStandings(u,league){const list=u.teams[league==='NFL'?'nfl':league==='UFL'?'ufl':'college'];return standings(list)}
export function getTeamStrength(u,teamId){const t=teamById(u,teamId);if(!t)return null;const r=roster(u,teamId),x=teamUnitRatings(t,r);return Math.round((x.passOff+x.rushOff+x.passDef+x.rushDef)/4)}
export function getRoster(u,teamId){return roster(u,teamId)}
export function findTeam(u,id){return teamById(u,id)}
export function findPlayer(u,id){return playerById(u,id)}
export function getAllCoaches(u){const rows=[];for(const t of allTeams(u))for(const role of ['HC','OC','DC']){const s=t[staffKey(role)];if(s)rows.push({...s,currentTeamId:t.id,currentLeague:t.league})}for(const s of u.coachFreeAgents||[])rows.push({...s,currentTeamId:null,currentLeague:'FREE'});return rows}
