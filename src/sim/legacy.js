// ─────────────────────────────────────────────────────────────────────────────
// Legacy layer (v1.1): makes the universe notice its own history.
//   • dynasty caps     – hard ceilings: three-peat, 4 titles in 6 years, 5 in 10
//   • title context    – back-to-back, three-peat, droughts, title counts
//   • dynasties        – named eras built from championship runs
//   • preseason outlook– power rankings + title odds, judged again at season end
//   • offseason grades – A+ … F report cards from strength gained or lost
// Pure helpers: season.js passes in anything that would create a circular import.
// ─────────────────────────────────────────────────────────────────────────────

export const TITLE_NAME={NFL:'Super Bowl',COLLEGE:'national championship',UFL:'UFL Championship'};
export const DYNASTY_LIMITS={streak:3,six:4,ten:5};
const LEAGUE_KEY={NFL:'nfl',COLLEGE:'college',UFL:'ufl'};

// Team names like "Pittsburgh Steelers" read as plural; "Ohio State" as singular.
export const isPlural=name=>/s$/i.test(String(name||'').trim());
export const verb=(name,plural,singular)=>isPlural(name)?plural:singular;

export function titleYears(u,league,teamId){
  return (u.seasonHistory||[]).filter(s=>s?.[league]?.championId===teamId).map(s=>s.year).sort((a,b)=>a-b);
}

// Why a team may not win this year's title (null when it may). Only past seasons count.
export function titleCapReason(u,league,teamId,year=u.year){
  const won=new Set(titleYears(u,league,teamId).filter(y=>y<year));
  const inLast=n=>{let c=0;for(let y=year-n;y<year;y++)if(won.has(y))c++;return c;};
  if(won.has(year-1)&&won.has(year-2)&&won.has(year-3))return 'a four-peat';
  if(inLast(5)>=DYNASTY_LIMITS.six)return 'a fifth title in six years';
  if(inLast(9)>=DYNASTY_LIMITS.ten)return 'a sixth title in ten years';
  return null;
}

// Simulate a title game under the dynasty caps. A capped team can reach the final, but cannot win it.
// It replays the game with fresh dice; if the capped side keeps winning, it plays below its level.
export function cappedTitleGame(u,league,home,away,play){
  const capH=titleCapReason(u,league,home.id),capA=titleCapReason(u,league,away.id);
  if(!capH===!capA)return {game:play(0,0),denied:null};// neither capped, or both (no way to honour both)
  const cappedId=capH?home.id:away.id,reason=capH||capA;
  const lost=g=>(g.homeId===cappedId?g.homeScore<g.awayScore:g.awayScore<g.homeScore);
  let g=null;
  for(let i=0;i<30;i++){g=play(0,0);if(lost(g))break;}
  for(let k=1;!lost(g)&&k<=8;k++){const drop=k*4;g=capH?play(drop,0):play(0,drop);}
  return {game:g,denied:lost(g)?{teamId:cappedId,reason}:null};
}

export function titleContext(u,league,teamId,year=u.year,includeYear=false){
  const ys=[...new Set([...titleYears(u,league,teamId).filter(y=>y<=year),...(includeYear?[year]:[])])].sort((a,b)=>a-b),set=new Set(ys);
  let streak=0;for(let y=year;set.has(y);y--)streak++;
  const inWindow=n=>ys.filter(y=>y>year-n).length,prev=ys.filter(y=>y<year).pop()||null;
  const firstYear=Math.min(...(u.seasonHistory||[]).map(s=>s.year),year);
  return {total:ys.length,streak,six:inWindow(6),ten:inWindow(10),prev,drought:prev?year-prev:null,first:!prev,yearsOfHistory:year-firstYear};
}

// Banner line for the trophy screen, shown before the season is archived.
export function celebrationTag(u,league,teamId){
  const c=titleContext(u,league,teamId,u.year,true);
  if(c.streak>=3)return {tag:'THREE-PEAT',line:'A third straight title. The most any dynasty can win in a row.'};
  if(c.six>=4)return {tag:'DYNASTY',line:`A 4th title in six years. Title No. ${c.total}.`};
  if(c.ten>=5)return {tag:'DYNASTY',line:`A 5th title in ten years. Title No. ${c.total}.`};
  if(c.streak===2)return {tag:'BACK-TO-BACK',line:'Champions again. Next year: a shot at the three-peat.'};
  if(c.drought&&c.drought>=8)return {tag:'DROUGHT OVER',line:`The first title in ${c.drought} years.`};
  if(c.first&&c.yearsOfHistory>=5)return {tag:'FIRST TITLE',line:'The first championship in the history of this universe.'};
  return c.total>1?{tag:`TITLE NO. ${c.total}`,line:null}:null;
}
export function titleHeadline(u,league,team,runner,score){
  const c=titleContext(u,league,team.id),T=TITLE_NAME[league],n=team.name,w=verb(n,'win','wins');
  let title,tag=null;
  if(c.streak>=3){title=`THREE-PEAT! ${n} ${w} a third straight ${T}`;tag='Three-peat';}
  else if(c.six>=4){title=`Dynasty: ${n} ${w} a 4th ${T} in six years`;tag='Dynasty';}
  else if(c.ten>=5){title=`Dynasty: ${n} ${w} a 5th ${T} in ten years`;tag='Dynasty';}
  else if(c.streak===2){title=`Back-to-back! ${n} ${verb(n,'repeat','repeats')} as ${league==='NFL'?'Super Bowl':league==='UFL'?'UFL':'national'} champions`;tag='Back-to-back';}
  else if(c.drought&&c.drought>=8){title=`${n} ${verb(n,'end','ends')} a ${c.drought}-year drought with the ${T}`;tag='Drought over';}
  else if(c.first&&c.yearsOfHistory>=5){title=`${n} ${w} ${league==='COLLEGE'?'their':'the franchise’s'} first ${T}`;tag='First title';}
  else title=`${n} ${w} the ${T}`;
  const bits=[`${n} ${verb(n,'defeat','defeats')} ${runner.name} ${score}.`,`Title No. ${c.total}${c.streak>=2?`, ${c.streak} in a row`:''}.`];
  if(c.streak===3)bits.push('Three straight is the ceiling: no team in this universe has ever won four in a row.');
  return {title,body:bits.join(' '),tag,context:c};
}

// Championship runs: 2+ titles inside a window of 4 years form an era.
export function dynastyEras(u,league){
  const teams=u.teams?.[LEAGUE_KEY[league]]||[],eras=[];
  for(const t of teams){
    const ys=titleYears(u,league,t.id);if(ys.length<2)continue;
    let run=[ys[0]];
    const flush=()=>{if(run.length>=2){const streak=longestStreak(run);eras.push({teamId:t.id,league,start:run[0],end:run[run.length-1],titles:run.length,years:[...run],streak,label:eraLabel(run,streak)});}};
    for(let i=1;i<ys.length;i++){if(ys[i]-run[run.length-1]<=3)run.push(ys[i]);else{flush();run=[ys[i]];}}
    flush();
  }
  return eras.sort((a,b)=>b.titles-a.titles||b.streak-a.streak||b.end-a.end);
}
function longestStreak(ys){let best=1,cur=1;for(let i=1;i<ys.length;i++){cur=ys[i]===ys[i-1]+1?cur+1:1;best=Math.max(best,cur);}return best;}
function eraLabel(ys,streak){if(ys.length>=4)return 'Dynasty';if(streak>=3)return 'Three-peat';if(streak===2&&ys.length===2)return 'Back-to-back';return `${ys.length} titles in ${ys[ys.length-1]-ys[0]+1} years`;}

// Defending champion of a league for the season being played (u.year).
export function defendingChampionId(u,league){
  const last=(u.seasonHistory||[]).find(s=>s.year===u.year-1);return last?.[league]?.championId||null;
}

// ── Preseason outlook ───────────────────────────────────────────────────────
// Title odds come from a softmax over team strength; the scale keeps favourites
// around 12–20% in the NFL so long shots still happen.
export function preseasonOutlook(u,league,strengthOf){
  const teams=u.teams?.[LEAGUE_KEY[league]]||[];if(!teams.length)return null;
  const scale=league==='COLLEGE'?2.2:2.6;
  const rows=teams.map(t=>({teamId:t.id,strength:strengthOf(t.id)||0}));
  const max=Math.max(...rows.map(r=>r.strength)),ws=rows.map(r=>Math.exp((r.strength-max)/scale)),tot=ws.reduce((a,b)=>a+b,0);
  rows.forEach((r,i)=>{r.odds=Math.round(ws[i]/tot*1000)/10;});
  rows.sort((a,b)=>b.strength-a.strength||b.odds-a.odds);rows.forEach((r,i)=>r.rank=i+1);
  return {league,year:u.year,rows};
}
// Judge the preseason picks once the season is over. finishScore ranks final outcomes.
export function judgeOutlook(outlook,teams,finishScore){
  if(!outlook?.rows?.length)return null;
  const finalOrder=[...teams].sort((a,b)=>finishScore(b)-finishScore(a)),finalRank=new Map(finalOrder.map((t,i)=>[t.id,i+1]));
  const rows=outlook.rows.map(r=>({...r,finalRank:finalRank.get(r.teamId)||r.rank,delta:r.rank-(finalRank.get(r.teamId)||r.rank)}));
  const surprise=[...rows].sort((a,b)=>b.delta-a.delta)[0],bust=[...rows].filter(r=>r.rank<=8).sort((a,b)=>a.delta-b.delta)[0];
  return {favoriteId:rows[0].teamId,favoriteOdds:rows[0].odds,surprise:surprise?.delta>=8?surprise:null,bust:bust?.delta<=-8?bust:null,rows:rows.map(({teamId,rank,odds,finalRank})=>({teamId,rank,odds,finalRank}))};
}

// ── Offseason report cards ──────────────────────────────────────────────────
const GRADE_STEPS=[[.06,'A+'],[.16,'A'],[.28,'A-'],[.40,'B+'],[.52,'B'],[.62,'B-'],[.72,'C+'],[.80,'C'],[.87,'C-'],[.94,'D'],[1.01,'F']];
export function offseasonGrades(teams,start,end){
  const rows=teams.map(t=>{const a=start?.[t.id]?.overall,b=end?.[t.id]?.overall;return a==null||b==null?null:{teamId:t.id,from:a,to:b,delta:b-a};}).filter(Boolean).sort((x,y)=>y.delta-x.delta);
  rows.forEach((r,i)=>{const pct=(i+.5)/rows.length;r.grade=GRADE_STEPS.find(([p])=>pct<p)[1];});
  return rows;
}
