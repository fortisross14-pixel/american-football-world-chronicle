// ─────────────────────────────────────────────────────────────────────────────
// Storylines engine (v1.0). Turns each simulated week into a handful of headlines
// worth reading: upsets, comebacks, walk-offs, monster games, streaks, the MVP and
// rookie races, coaches on the hot seat and rivalry results. The most dramatic
// game of the week is the Game of the Week on Home, so it is kept out of the
// headlines to avoid spoiling it.
// ─────────────────────────────────────────────────────────────────────────────
import { teamRivalry, startingQB } from './chronicle.js';

export const STORY_GROUPS={
  Games:['UPSET','COMEBACK','WALK-OFF','PERFORMANCE','STREAK','RIVALRY','PLAYOFFS','CHAMPIONSHIP','COLLEGE','UFL'],
  Races:['MVP RACE','ROOKIE WATCH','HOT SEAT','RECORD WATCH','AWARD'],
  Moves:['DEADLINE','FREE AGENCY','BLOCKBUSTER','TRADE','COACHING','DRAFT','INJURY','TRANSFER'],
  Legacy:['RECORD','MILESTONE','HALL OF FAME','RETIRED JERSEY','RETIREMENT']
};
export function storyGroup(type){for(const [g,list] of Object.entries(STORY_GROUPS))if(list.includes(type))return g;return 'Games';}

export function dramaScore(g,u=null){
  const f=g.flags||{},m=Math.abs(g.homeScore-g.awayScore);
  let s=(f.comeback>=8?f.comeback*1.4:0)+(f.leadChanges||0)*4+(f.gameWinner?10:0)+(f.ot?12:0)+Math.max(0,17-m)*.8;
  if(u){const all=u.teams.nfl,h=all.find(t=>t.id===g.homeId),a=all.find(t=>t.id===g.awayId);s+=((h?.current?.wins||0)+(a?.current?.wins||0))*.45;}
  return s;
}
export function gameOfTheWeekId(u,week){
  const games=(u.currentGames||[]).filter(g=>g.league==='NFL'&&g.stage==='Regular Season'&&g.round===week&&Array.isArray(g.drives));
  if(!games.length)return null;return [...games].sort((a,b)=>dramaScore(b,u)-dramaScore(a,u))[0].id;
}
const nameOf=(u,id)=>u.teams.nfl.find(t=>t.id===id)?.name||id;
const rec=t=>`${t.current.wins}-${t.current.losses}`;
const poss=n=>/s$/.test(n||'')?`${n}'`:`${n}'s`;
const an=n=>/^(8|11|18)/.test(String(n))?'An':'A';

// ctx: {addNews, findPlayer, mvpLadder, rookieLadder}
export function weeklyStories(u,week,ctx){
  const games=(u.currentGames||[]).filter(g=>g.league==='NFL'&&g.stage==='Regular Season'&&g.round===week);
  if(!games.length)return;
  const gotw=gameOfTheWeekId(u,week),cands=[];
  const add=(importance,type,title,body,teamId=null,playerId=null,gameId=null)=>cands.push({importance,type,title,body,teamId,playerId,gameId});
  for(const g of games){
    if(g.id===gotw)continue;
    const hw=g.homeScore>g.awayScore,W=hw?g.homeId:g.awayId,L=hw?g.awayId:g.homeId,ws=Math.max(g.homeScore,g.awayScore),ls=Math.min(g.homeScore,g.awayScore),wt=u.teams.nfl.find(t=>t.id===W),lt=u.teams.nfl.find(t=>t.id===L);
    const edgeForWinner=hw?(g.xm||0):-(g.xm||0),f=g.flags||{};
    if(edgeForWinner<=-7&&(lt.current.wins-wt.current.wins)>=2)add(70+Math.min(15,-edgeForWinner),'UPSET',`Stunner: ${wt.name} topple ${lt.name}`,`The ${rec(wt)} ${wt.name} beat the ${rec(lt)} ${lt.name} ${ws}-${ls} as clear underdogs.`,W,null,g.id);
    if(f.comeback>=14)add(72+Math.min(14,f.comeback-14),'COMEBACK',`${wt.name} rally from ${f.comeback} down`,`${wt.name} erase a ${f.comeback}-point deficit to beat ${lt.name} ${ws}-${ls}${f.ot?' in overtime':''}.`,W,null,g.id);
    else if(f.gameWinner||f.ot){const last=[...(g.plays||[])].reverse().find(p=>p.pts>0&&p.k!=='XP'&&p.k!=='XP2');const hero=last?.p?ctx.findPlayer(u,last.p):null;add(f.ot?70:64,'WALK-OFF',f.ot?`${wt.name} win it in overtime`:`${wt.name} steal it late`,`${hero?`${hero.name} delivers the decisive ${last.k==='FG'?`${last.y}-yard field goal`:'score'}`:'A late score decides it'} as ${wt.name} edge ${lt.name} ${ws}-${ls}.`,W,hero?.id||null,g.id);}
    // Monster individual games
    for(const [id,s] of Object.entries(g.playerStats||{})){
      const p=ctx.findPlayer(u,id);if(!p||p.league!=='NFL')continue;const tn=nameOf(u,p.teamId),tp=poss(tn);
      if((s.passYards||0)>=410||(s.passTD||0)>=5)add(60+Math.min(20,Math.floor(((s.passYards||0)-380)/12)+(s.passTD||0)*2),'PERFORMANCE',(s.passTD||0)>=5?`${p.name} throws ${s.passTD} touchdown passes`:`${p.name} throws for ${s.passYards} yards`,`${s.passYards} yards, ${s.passTD||0} touchdowns and ${s.interceptions||0} interceptions for ${tn}.`,p.teamId,p.id,g.id);
      if((s.rushYards||0)>=180||(s.rushTD||0)>=4)add(60+Math.min(18,Math.floor(((s.rushYards||0)-170)/8)+(s.rushTD||0)*2),'PERFORMANCE',(s.rushTD||0)>=4?`${p.name} runs in ${s.rushTD} touchdowns`:`${p.name} runs wild for ${s.rushYards} yards`,`${s.rushYards} yards and ${s.rushTD||0} rushing touchdowns for ${tn}.`,p.teamId,p.id,g.id);
      if((s.recYards||0)>=190||(s.recTD||0)>=3)add(58+Math.min(18,Math.floor(((s.recYards||0)-170)/8)+(s.recTD||0)*2),'PERFORMANCE',(s.recTD||0)>=3?`${p.name} catches ${s.recTD} touchdowns`:`${p.name}: ${s.recYards} receiving yards`,`${s.recYards} yards and ${s.recTD||0} touchdown catches for ${tn}.`,p.teamId,p.id,g.id);
      if((s.sacks||0)>=4)add(60+(s.sacks||0)*3,'PERFORMANCE',`${p.name} wrecks the pocket with ${s.sacks} sacks`,`${tp} ${p.position} terrorises the quarterback.`,p.teamId,p.id,g.id);
      if(!(s.passYards>0)&&(s.interceptions||0)>=3)add(60+(s.interceptions||0)*4,'PERFORMANCE',`${p.name} picks off ${s.interceptions} passes`,`${tp} ${p.position} turns the game with ${s.interceptions} interceptions${s.defensiveTD?' and a pick-six':''}.`,p.teamId,p.id,g.id);
    }
    // Rivalry games
    const R=teamRivalry(u,g.homeId,g.awayId);
    if(R&&R.heat>=9&&R.games>=4){const ww=R.wins[W]||0,lw=R.wins[L]||0;add(55+Math.min(15,R.heat),'RIVALRY',`${wt.name} take round ${R.games} against ${lt.name}`,`${ws}-${ls}. The series now stands ${ww}-${lw}${R.playoff?` with ${R.playoff} playoff meeting${R.playoff>1?'s':''}`:''}.`,W,null,g.id);}
  }
  // Streaks
  for(const t of u.teams.nfl){
    const st=t.current.streak||0,prev=t.current.prevStreak||0;
    const unbeaten=t.current.losses===0;
    if(unbeaten&&t.current.wins>=6&&t.current.wins%2===0)add(74+t.current.wins,'STREAK',`${t.name} are ${t.current.wins}-0`,`Still unbeaten after Week ${week}. Can anyone stop them?`,t.id);
    else if(!unbeaten&&(st===5||st===7||st===10))add(60+st,'STREAK',`${t.name} win ${st} straight`,`${an(st)} ${st}-game win streak lifts ${t.name} to ${rec(t)}.`,t.id);
    if(t.current.wins===0&&t.current.losses>=6&&t.current.losses%3===0)add(58+t.current.losses,'STREAK',`${t.name} fall to 0-${t.current.losses}`,`Still searching for a first win of Year ${u.year}.`,t.id);
    if(prev>=6&&st<0)add(66+prev,'STREAK',prev===t.current.wins&&t.current.losses===1?`${t.name} suffer their first loss`:`${poss(t.name)} ${prev}-game win streak is over`,`They fall to ${rec(t)}.`,t.id);
  }
  // Races & seats
  if(week>=6&&week%3===0){
    const ladder=ctx.mvpLadder(u,'NFL',3);
    if(ladder.length>=2){const [a,b,c]=ladder;add(76,'MVP RACE',`MVP race: ${a.p.name} leads after Week ${week}`,`${b.p.name}${c?` and ${c.p.name}`:''} are chasing. ${a.p.name} (${a.line}).`,a.p.teamId,a.p.id);}
  }
  if(week===8||week===14){const r=ctx.rookieLadder(u,1)[0];if(r)add(64,'ROOKIE WATCH',`Rookie watch: ${r.p.name} is turning heads`,`${r.p.position} for ${nameOf(u,r.p.teamId)}: ${r.line}.`,r.p.teamId,r.p.id);}
  if(week>=10){
    u.storyFlags=u.storyFlags||{};
    for(const t of u.teams.nfl){const hc=t.hc;if(!hc)continue;const key=`seat-${u.year}-${hc.id}`;if(u.storyFlags[key])continue;if(t.current.wins<=2&&t.current.losses>=7){u.storyFlags[key]=1;add(66,'HOT SEAT',`Hot seat: ${hc.name}'s job in danger`,`${t.name} sit at ${rec(t)}. Ownership patience is wearing thin.`,t.id);}}
  }
  // Keep the wire readable: best stories first, at most two per team, six per week.
  const used={},out=[];
  for(const c of cands.sort((a,b)=>b.importance-a.importance)){const k=c.teamId||c.playerId;if(k&&(used[k]||0)>=2)continue;if(out.some(o=>o.title===c.title))continue;out.push(c);if(k)used[k]=(used[k]||0)+1;if(out.length>=6)break;}
  for(const c of out.reverse())ctx.addNews(u,c.type,Math.round(c.importance),c.title,c.body,c.teamId,c.playerId,{week,gameId:c.gameId});
}

// Postseason: every playoff result is a story; upsets and comebacks are big ones.
export function playoffStories(u,games,ctx){
  for(const g of games){
    if(g.league!=='NFL'||g.stage==='Regular Season'||g.stage==='Super Bowl')continue;
    const hw=g.homeScore>g.awayScore,W=hw?g.homeId:g.awayId,L=hw?g.awayId:g.homeId,ws=Math.max(g.homeScore,g.awayScore),ls=Math.min(g.homeScore,g.awayScore),f=g.flags||{};
    const upset=(hw?(g.xm||0):-(g.xm||0))<=-5,qb=startingQB(u,g,W);
    const imp=g.stage==='Conference Championship'?88:g.stage==='Divisional'?78:72;
    const title=g.stage==='Conference Championship'?`${nameOf(u,W)} are going to the Super Bowl`:`${nameOf(u,W)} ${upset?'stun':'beat'} ${nameOf(u,L)} in the ${g.stage}`;
    ctx.addNews(u,'PLAYOFFS',imp+(upset?6:0)+(f.comeback>=10?4:0),title,`${ws}-${ls}${f.ot?' in overtime':''}${f.comeback>=10?` after trailing by ${f.comeback}`:''}${qb?`. ${qb.name} leads the way`:''}.`,W,qb?.id||null,{gameId:g.id});
  }
}
