import React,{useMemo,useState} from 'react';
import { TeamMark, PlayerFace, RarityPill, Panel, Segmented, Empty } from './ui.jsx';
import { findTeam, findPlayer, getRoster } from '../sim/season.js';
import { TRAITS, gradeLabel, isInjured, qbDuelsFor, recordChases, seasonRecords, careerRecords, RECORD_CATS, hottestRivalries, greatestQbDuels, rivalryHeadline, pickLabel, startingQB } from '../sim/chronicle.js';
import { RARITIES } from '../sim/generate.js';
import { STORY_GROUPS } from '../sim/stories.js';

// ─────────────────────────────────────────────────────────────────────────────
// v0.9 story surfaces: traits, form, injuries, grades, head-to-heads, record
// book, rivalries, free agency & deadline trackers, draft night, report cards.
// ─────────────────────────────────────────────────────────────────────────────
const POS={HB:'RB',OG:'G',OT:'T'},posLabel=p=>POS[p]||p;
const num=n=>Number(n||0).toLocaleString();
const rr=r=>RARITIES.indexOf(r);

export function TraitChips({p,limit=3}){
  const t=(p?.traits||[]).slice(0,limit);if(!t.length)return null;
  return <span className="trait-chips">{t.map(k=><span key={k} className={`trait-chip ${k==='Injury Prone'?'neg':''}`} title={TRAITS[k]?.desc||''}>{k}</span>)}</span>;
}
export function InjuryBadge({p,long=false}){
  if(!isInjured(p))return null;const i=p.injury;
  return <span className="injury-badge" title={i.type}>{i.seasonEnding?'OUT · SEASON':`OUT ${i.weeks} WK${i.weeks>1?'S':''}`}{long?` · ${i.type}`:''}</span>;
}
export function FormChip({p,u}){
  const f=p?.form;if(!f||f.year!==u?.year||!f.tag)return null;
  const good=f.delta>0;return <span className={`form-chip ${good?'up':'down'}`} title={`Season form ${good?'+':''}${f.delta} OVR vs career curve`}>{f.tag.toUpperCase()} {good?'+':''}{f.delta}</span>;
}
export function GradeChip({g}){if(!g)return <span className="grade-chip none">—</span>;return <span className={`grade-chip g-${g.replace('+','plus').toLowerCase()}`} title={gradeLabel(g)}>{g}</span>;}
export function GradeStrip({p}){
  const rows=(p.stats?.seasons||[]).filter(s=>s.grade).sort((a,b)=>a.year-b.year);if(!rows.length)return <Empty>Season grades appear once a season is completed.</Empty>;
  return <div className="grade-strip">{rows.map(s=><div key={`${s.year}-${s.league}`} className="grade-strip-cell" title={`Year ${s.year} · ${s.league} · ${gradeLabel(s.grade)}${s.gradePct!=null?` · ${s.gradePct}th pct`:''}`}><GradeChip g={s.grade}/><small>Y{s.year}</small><em>{s.league==='COLLEGE'?'CFB':s.league}</em></div>)}</div>;
}
export function LegacyMoments({p}){
  const m=[...(p.legacyMoments||[])].reverse();if(!m.length)return null;
  return <div className="legacy-moments">{m.slice(0,12).map((x,i)=><span key={i}><b>Y{x.year}</b> {x.text}</span>)}</div>;
}
export function QbHeadToHead({u,p,openPlayer}){
  if(p.position!=='QB')return null;const duels=qbDuelsFor(u,p.id).slice(0,10);
  return <Panel title="Quarterback head-to-head" eyebrow="EVERY STARTING MATCHUP · RIVALRY LEDGER">{duels.length?<table><thead><tr><th>Opponent</th><th>Record</th><th>Playoff meetings</th><th>Biggest stage</th><th>Last meeting</th></tr></thead><tbody>{duels.map(d=>{const oppId=d.a===p.id?d.b:d.a,opp=findPlayer(u,oppId),w=d.wins[p.id]||0,l=d.wins[oppId]||0,big=[...d.meetings].sort((a,b)=>(STAGE_ORDER[b.stage]||0)-(STAGE_ORDER[a.stage]||0))[0],last=d.last;return <tr key={oppId} onClick={()=>opp&&openPlayer?.(opp.id)}><td><b>{opp?.name||'—'}</b></td><td><b className={w>l?'positive':w<l?'negative':''}>{w}–{l}</b></td><td>{d.playoff}</td><td>{big?`${big.stage} · Y${big.year}`:'—'}</td><td>{last?`Y${last.year} ${last.stage==='Regular Season'?`Wk ${last.round}`:last.stage} · ${last.winnerQB===p.id?'W':'L'} ${last.score}`:'—'}</td></tr>})}</tbody></table>:<Empty>No starting matchups recorded yet.</Empty>}</Panel>;
}
const STAGE_ORDER={'Regular Season':0,'Wild Card':1,'Divisional':2,'Conference Championship':3,'Super Bowl':4};

// Pre-game rivalry strip (used in game previews and the finale).
export function RivalryStrip({u,homeId,awayId,homeQB,awayQB,excludeGameId=null}){
  const {lines,heat}=rivalryHeadline(u,homeId,awayId,homeQB,awayQB,id=>findTeam(u,id)?.name||id,excludeGameId);
  if(!lines.length)return null;
  return <div className={`rivalry-strip ${heat>=8?'hot':''}`}><span>{heat>=8?'🔥 RIVALRY':'HEAD-TO-HEAD'}</span>{lines.map(l=><b key={l}>{l}</b>)}</div>;
}
export function likelyStarter(u,teamId){return getRoster(u,teamId).filter(p=>p.position==='QB'&&!p.retired&&!isInjured(p)).sort((a,b)=>b.overall-a.overall)[0]||null;}
export function gameQBs(u,game){return {home:startingQB(u,game,game.homeId),away:startingQB(u,game,game.awayId)};}

// ── Home storylines ─────────────────────────────────────────────────────────
export function StorylinesPanel({u,openPlayer,openTeam}){
  const chases=useMemo(()=>recordChases(u,'NFL'),[u]);
  const injured=u.players.filter(p=>!p.retired&&p.league==='NFL'&&isInjured(p)&&rr(p.trueRarity)>=2).sort((a,b)=>rr(b.trueRarity)-rr(a.trueRarity)||b.overall-a.overall).slice(0,6);
  const deadline=(u.deadlineHistory?.[0]?.year===u.year?u.deadlineHistory[0].events:[]);
  const breakouts=u.players.filter(p=>!p.retired&&p.league==='NFL'&&p.form?.year===u.year&&p.form.tag==='Breakout'&&p.currentSeason?.games).sort((a,b)=>b.overall-a.overall).slice(0,4);
  if(u.phase!=='Regular Season'&&u.phase!=='Postseason')return null;
  return <div className="three-col storylines">
    <Panel title="Record watch" eyebrow="ON PACE FOR HISTORY" className="premium-panel">{chases.length?chases.map(c=>{const p=findPlayer(u,c.playerId),h=findPlayer(u,c.holderId);return <button className="story-row" key={c.playerId+c.key} onClick={()=>openPlayer(p.id)}><PlayerFace player={p} team={findTeam(u,p.teamId)} size={38}/><span><b>{p.name}</b><small>{c.cat}: {num(c.value)} · pace <strong>{num(c.pace)}</strong></small><em>Record {num(c.record)} · {h?.name||'—'} (Y{c.holderYear})</em></span></button>}):<Empty>{(u.seasonState?.week||0)<6?'Record chases appear from Week 6.':'Nobody is on record pace right now.'}</Empty>}</Panel>
    <Panel title="Injury report" eyebrow="NOTABLE PLAYERS OUT" className="premium-panel">{injured.length?injured.map(p=><button className="story-row" key={p.id} onClick={()=>openPlayer(p.id)}><PlayerFace player={p} team={findTeam(u,p.teamId)} size={38}/><span><b>{p.name}</b><small>{posLabel(p.position)} · {findTeam(u,p.teamId)?.name}</small><em>{p.injury.type}</em></span><InjuryBadge p={p}/></button>):<Empty>No notable injuries.</Empty>}</Panel>
    <Panel title={deadline.length?'Deadline deals':'Breakout watch'} eyebrow={deadline.length?`WEEK 9 · ${deadline.length} TRADES`:'CAREER-YEAR FORM'} className="premium-panel">{deadline.length?deadline.map((e,i)=>{const p=findPlayer(u,e.playerId),to=findTeam(u,e.toId),from=findTeam(u,e.fromId);return <button className="story-row" key={i} onClick={()=>openPlayer(p.id)}><PlayerFace player={p} team={to} size={38}/><span><b>{p?.name}</b><small>{from?.shortId||from?.id} → <strong>{to?.name}</strong></small><em>for {e.detail}</em></span><RarityPill rarity={e.rarity} compact/></button>}):breakouts.length?breakouts.map(p=><button className="story-row" key={p.id} onClick={()=>openPlayer(p.id)}><PlayerFace player={p} team={findTeam(u,p.teamId)} size={38}/><span><b>{p.name}</b><small>{posLabel(p.position)} · {findTeam(u,p.teamId)?.name}</small><em>OVR {p.overall} ({p.form.delta>0?'+':''}{p.form.delta} on his curve)</em></span><FormChip p={p} u={u}/></button>):<Empty>No breakout seasons yet.</Empty>}</Panel>
  </div>;
}

// ── Record book ─────────────────────────────────────────────────────────────
export function RecordBook({u,openPlayer,league='NFL'}){
  const[mode,setMode]=useState('Season'),[key,setKey]=useState('passYards');
  const rows=useMemo(()=>mode==='Season'?seasonRecords(u,league,key,15):careerRecords(u,league,key,15),[u,mode,key,league]);
  return <Panel title="Record book" eyebrow={`${league} · ${mode.toUpperCase()} RECORDS`} action={<Segmented value={mode} onChange={setMode} items={['Season','Career']}/>}>
    <div className="record-cats">{RECORD_CATS.map(c=><button key={c.key} className={key===c.key?'active':''} onClick={()=>setKey(c.key)}>{c.label}</button>)}</div>
    <table><thead><tr><th>#</th><th>Player</th><th>Team</th>{mode==='Season'&&<th>Year</th>}<th>{RECORD_CATS.find(c=>c.key===key)?.label}</th></tr></thead><tbody>{rows.map((r,i)=>{const p=findPlayer(u,r.playerId),t=findTeam(u,r.teamId);return <tr key={`${r.playerId}-${r.year||i}`} onClick={()=>p&&openPlayer(p.id)} className={i===0?'record-holder':''}><td>{i+1}</td><td><div className="team-cell"><PlayerFace player={p} team={findTeam(u,p?.teamId)} size={30}/><b>{p?.name||'—'}</b>{mode==='Career'&&!p?.retired&&<span className="active-tag">ACTIVE</span>}</div></td><td>{t?.name||(p?.retired?'Retired':'—')}</td>{mode==='Season'&&<td>Year {r.year}</td>}<td><b>{num(r.value)}</b></td></tr>})}{!rows.length&&<tr><td colSpan="5"><Empty>Complete a season to start the record book.</Empty></td></tr>}</tbody></table>
  </Panel>;
}

// ── Rivalries ───────────────────────────────────────────────────────────────
export function RivalriesView({u,openPlayer,openTeam}){
  const teams=hottestRivalries(u,12),qbs=greatestQbDuels(u,12);
  const meetingText=m=>`Y${m.year} ${m.stage==='Regular Season'?`Wk ${m.round}`:m.stage}`;
  return <div className="rivalries-stack">
    <Panel title="Hottest team rivalries" eyebrow="HEAT = PLAYOFF MEETINGS · CLOSE GAMES · DIVISION · RECENCY">{teams.length?<table><thead><tr><th>Rivalry</th><th>Series</th><th>Playoffs</th><th>Heat</th><th>Last</th></tr></thead><tbody>{teams.map(r=>{const a=findTeam(u,r.a),b=findTeam(u,r.b),wa=r.wins[r.a]||0,wb=r.wins[r.b]||0,big=r.meetings.filter(m=>m.stage!=='Regular Season').slice(-1)[0];return <tr key={r.a+r.b}><td><div className="rivalry-cell"><button onClick={()=>openTeam(a.id)}><TeamMark team={a} size={26}/></button><span>vs</span><button onClick={()=>openTeam(b.id)}><TeamMark team={b} size={26}/></button><b>{a?.shortId||a?.id} – {b?.shortId||b?.id}</b></div></td><td><b>{wa}–{wb}</b></td><td>{r.playoff}{big?<small className="block">{meetingText(big)}</small>:null}</td><td><span className="heat-bar"><i style={{width:`${Math.min(100,r.heat*4)}%`}}/></span></td><td>{r.last?`${meetingText(r.last)} · ${findTeam(u,r.last.winnerId)?.shortId||''}`:'—'}</td></tr>})}</tbody></table>:<Empty>Rivalries form as teams meet.</Empty>}</Panel>
    <Panel title="Great quarterback duels" eyebrow="BRADY–MANNING ENERGY · STARTING QBs ONLY">{qbs.length?<table><thead><tr><th>Duel</th><th>Record</th><th>Playoffs</th><th>Title games</th><th>Last</th></tr></thead><tbody>{qbs.map(q=>{const a=findPlayer(u,q.a),b=findPlayer(u,q.b),wa=q.wins[q.a]||0,wb=q.wins[q.b]||0;return <tr key={q.a+q.b}><td><div className="duel-cell"><button onClick={()=>openPlayer(a.id)}><PlayerFace player={a} team={findTeam(u,a?.teamId)} size={30}/><b>{a?.name}</b></button><span>vs</span><button onClick={()=>openPlayer(b.id)}><PlayerFace player={b} team={findTeam(u,b?.teamId)} size={30}/><b>{b?.name}</b></button></div></td><td><b>{wa}–{wb}</b></td><td>{q.playoff}</td><td>{q.titleGames}</td><td>{q.last?meetingText(q.last):'—'}</td></tr>})}</tbody></table>:<Empty>QB duels appear once starters meet more than once.</Empty>}</Panel>
  </div>;
}

// ── Market trackers ─────────────────────────────────────────────────────────
export function FreeAgencyTracker({u,openPlayer,openTeam}){
  const sources=[u.offseasonState,...(u.offseasonHistory||[])].filter(Boolean),[idx,setIdx]=useState(0);
  const withFa=sources.filter(s=>(s.events?.freeAgency||[]).some(e=>e.type==='Marquee Signing'));
  const src=withFa[Math.min(idx,withFa.length-1)],rows=(src?.events?.freeAgency||[]).filter(e=>e.type==='Marquee Signing').sort((a,b)=>rr(b.rarity)-rr(a.rarity)||b.overall-a.overall);
  return <Panel title="Free agency tracker" eyebrow="MARQUEE MARKET · SUITORS AND WHERE THEY LANDED" action={withFa.length>1?<select value={idx} onChange={e=>setIdx(Number(e.target.value))}>{withFa.map((s,i)=><option key={i} value={i}>Year {s.year} offseason</option>)}</select>:null}>
    {rows.length?<div className="fa-grid">{rows.map(e=>{const p=findPlayer(u,e.playerId),to=findTeam(u,e.toId),from=findTeam(u,e.fromId);return <div key={e.playerId} className={`fa-card ${e.returned?'returned':''}`}><button className="fa-player" onClick={()=>openPlayer(p.id)}><PlayerFace player={p} team={to} size={48}/><span><b>{p?.name}</b><small>{posLabel(e.position)} · OVR {e.overall} · {e.personality||p?.personality}</small><RarityPill rarity={e.rarity} compact/></span></button><div className="fa-suitors"><span>SUITORS</span>{e.suitors.map(id=>{const t=findTeam(u,id);return <button key={id} className={id===e.toId?'won':''} onClick={()=>openTeam(id)}><TeamMark team={t} size={26}/><small>{t?.shortId||t?.id}</small></button>})}</div><div className="fa-result">{e.returned?<b>STAYS with {to?.name}</b>:<b>{from?<>{from.shortId||from.id} → </>:null}{to?.name}</b>}<small>{e.years} yrs · ${e.annual?.toFixed(1)}M/yr</small></div></div>})}</div>:<Empty>The marquee market opens in the Roster Cuts & Free Agency stage of the offseason.</Empty>}
  </Panel>;
}
export function DeadlineTracker({u,openPlayer,openTeam}){
  const hist=u.deadlineHistory||[];
  return <Panel title="Trade deadline" eyebrow="WEEK 9 · CONTENDERS BUY, REBUILDERS SELL">{hist.some(h=>h.events.length)?<table><thead><tr><th>Year</th><th>Player</th><th>From</th><th>To</th><th>Price</th></tr></thead><tbody>{hist.flatMap(h=>h.events.map((e,i)=>{const p=findPlayer(u,e.playerId),f=findTeam(u,e.fromId),t=findTeam(u,e.toId);return <tr key={`${h.year}-${i}`} onClick={()=>p&&openPlayer(p.id)}><td>Year {h.year}</td><td><div className="team-cell"><PlayerFace player={p} team={t} size={30}/><b>{p?.name}</b><RarityPill rarity={e.rarity} compact/></div></td><td onClick={ev=>{ev.stopPropagation();openTeam(f.id)}}>{f?.name}</td><td onClick={ev=>{ev.stopPropagation();openTeam(t.id)}}><b>{t?.name}</b></td><td>{e.detail}</td></tr>}))}</tbody></table>:<Empty>No deadline deals yet. The deadline passes after Week 9.</Empty>}</Panel>;
}
export function PickLedger({u,openTeam}){
  const rows=u.teams.nfl.map(t=>{const own=(u.draftPicks||[]).filter(p=>p.ownerId===t.id),away=(u.draftPicks||[]).filter(p=>p.originalTeamId===t.id&&p.ownerId!==t.id);return {t,own,away,value:own.reduce((s,p)=>s+(4-p.round),0)};}).sort((a,b)=>b.value-a.value);
  return <Panel title="Draft capital" eyebrow="REAL PICK OWNERSHIP · ACQUIRED PICKS SHOW THEIR ORIGINAL TEAM"><table><thead><tr><th>Team</th><th>Picks owned</th><th>Acquired</th><th>Traded away</th></tr></thead><tbody>{rows.map(({t,own,away})=><tr key={t.id} onClick={()=>openTeam(t.id)}><td><div className="team-cell"><TeamMark team={t} size={26}/><b>{t.name}</b></div></td><td><b>{own.length}</b></td><td><div className="pick-tags">{own.filter(p=>p.originalTeamId!==t.id).map(p=><span key={p.id} className={`pick-tag r${p.round}`}>{pickLabel(u,p)}</span>)}</div></td><td><div className="pick-tags">{away.map(p=><span key={p.id} className="pick-tag gone">Y{p.year} R{p.round} → {findTeam(u,p.ownerId)?.shortId||p.ownerId}</span>)}</div></td></tr>)}</tbody></table></Panel>;
}

// ── Draft night & report cards ──────────────────────────────────────────────
export function DraftNight({u,reveals,openPlayer}){
  const first=reveals.filter(r=>r.round===1).sort((a,b)=>a.pick-b.pick),[shown,setShown]=useState(0),[truth,setTruth]=useState(false);
  if(!first.length)return null;
  const cur=first[Math.min(shown,first.length-1)],p=findPlayer(u,cur.playerId),team=findTeam(u,cur.teamId),college=findTeam(u,cur.collegeId),via=cur.viaId?findTeam(u,cur.viaId):null,done=shown>=first.length;
  const delta=rr(cur.actualRarity)-(cur.scouting?.expectedTier||0);
  return <section className="draft-night" style={{'--dn':team?.primary||'#1678c2'}}>
    <div className="dn-head"><div><div className="eyebrow">YEAR {cur.year} NFL DRAFT · ROUND 1</div><h2>Draft night</h2><p>Pick by pick. The public board is all anyone knew on the night; reveal God View to see who teams really got.</p></div><div className="dn-progress"><b>{Math.min(shown+1,first.length)}</b><span>/ {first.length}</span></div></div>
    <div className="dn-card"><div className="dn-pick"><small>PICK</small><b>{cur.pick}</b>{via&&<em>via {via.name}</em>}</div><TeamMark team={team} size={86}/><div className="dn-player"><small>THE {team?.name?.toUpperCase()} SELECT</small><h3>{p?.name}</h3><span>{posLabel(p?.position)} · {college?.name||'—'}</span><span className="dn-scout">Public board: {cur.scouting?.label}</span>{truth&&<div className="dn-truth"><RarityPill rarity={cur.actualRarity}/><span>{cur.developmentPath} · ceiling {cur.ceilingOverall} · {cur.careerYears} yrs</span><b className={delta>1.15?'positive':delta<-.9?'negative':''}>{delta>1.15?'STEAL':delta<-.9?'BAD READ':'FAIR READ'}</b></div>}</div><PlayerFace player={p} team={team} size={110}/></div>
    <div className="gc-controls">{!truth&&<button onClick={()=>setTruth(true)}>REVEAL GOD VIEW</button>}{shown<first.length-1&&<button className="advance" onClick={()=>{setShown(s=>s+1);setTruth(false);}}>NEXT PICK <span>›</span></button>}{shown>0&&<button onClick={()=>{setShown(0);setTruth(false);}}>RESTART</button>}<button onClick={()=>openPlayer(p.id)}>PLAYER PAGE</button></div>
    <div className="dn-board">{first.slice(0,shown).map(r=>{const q=findPlayer(u,r.playerId),t=findTeam(u,r.teamId);return <span key={r.pick}><b>{r.pick}</b><TeamMark team={t} size={20}/>{q?.name} <small>{posLabel(q?.position)}</small></span>})}</div>
  </section>;
}
function pickValue(u,r){
  const p=findPlayer(u,r.playerId);if(!p)return {value:0};
  const rows=(p.stats?.seasons||[]).filter(s=>s.league==='NFL'&&s.year>r.year-1),aw=p.awards||[];
  const graded=rows.filter(s=>s.gradePct!=null),avgPct=graded.length?graded.reduce((t,s)=>t+s.gradePct,0)/graded.length:0;
  const value=rr(p.trueRarity)*5+rows.length*1.2+avgPct/12+aw.filter(a=>a.name==='Pro Bowl').length*3+aw.filter(a=>a.type==='POSITION'&&a.league==='NFL').length*6+aw.filter(a=>a.name==='NFL MVP').length*15+aw.filter(a=>/Player of the Year/.test(a.name)&&a.league==='NFL').length*8;
  return {p,value,expected:26-r.pick*.2};
}
export function DraftReportCards({u,openPlayer,openTeam}){
  const years=(u.draftHistory||[]).filter(d=>d.year<=u.year-3).map(d=>d.year),[year,setYear]=useState(years[0]);
  const d=(u.draftHistory||[]).find(x=>x.year===(years.includes(year)?year:years[0]));
  const data=useMemo(()=>{if(!d)return null;const picks=d.reveals.map(r=>({r,...pickValue(u,r)}));const byTeam={};for(const x of picks)(byTeam[x.r.teamId]=byTeam[x.r.teamId]||[]).push(x);
    const rows=Object.entries(byTeam).map(([teamId,list])=>({teamId,list,score:list.reduce((s,x)=>s+x.value-x.expected,0),best:[...list].sort((a,b)=>b.value-a.value)[0]})).sort((a,b)=>b.score-a.score);
    rows.forEach((r,i)=>{const pct=1-i/rows.length;r.grade=pct>.9?'A+':pct>.75?'A':pct>.5?'B':pct>.25?'C':pct>.1?'D':'F';});
    const sorted=[...picks].sort((a,b)=>(b.value-b.expected)-(a.value-a.expected));return {rows,steal:sorted[0],bust:sorted[sorted.length-1]};},[u,d?.year]);
  if(!years.length)return <Panel title="Draft class report cards" eyebrow="GRADED WITH HINDSIGHT"><Empty>Classes are graded three seasons after the draft. The first report cards arrive after Year 4.</Empty></Panel>;
  return <Panel title={`Year ${d.year} draft · report cards`} eyebrow="GRADED WITH THREE+ YEARS OF HINDSIGHT" action={<select value={d.year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y} value={y}>Year {y} class</option>)}</select>}>
    <div className="report-highlights">{[['STEAL OF THE DRAFT',data.steal],['BIGGEST BUST',data.bust]].map(([label,x])=>x?.p&&<button key={label} onClick={()=>openPlayer(x.p.id)}><PlayerFace player={x.p} team={findTeam(u,x.p.teamId)} size={46}/><span><small>{label}</small><b>{x.p.name}</b><em>Pick #{x.r.pick} · {findTeam(u,x.r.teamId)?.name} · {x.p.trueRarity}</em></span></button>)}</div>
    <table><thead><tr><th>Grade</th><th>Team</th><th>Picks</th><th>Best pick</th></tr></thead><tbody>{data.rows.map(r=>{const t=findTeam(u,r.teamId);return <tr key={r.teamId}><td><span className={`grade-chip g-${r.grade.replace('+','plus').toLowerCase()}`}>{r.grade}</span></td><td onClick={()=>openTeam(t.id)}><div className="team-cell"><TeamMark team={t} size={26}/><b>{t?.name}</b></div></td><td>{r.list.map(x=>`#${x.r.pick}`).join(', ')}</td><td onClick={()=>r.best?.p&&openPlayer(r.best.p.id)}>{r.best?.p?<><b>{r.best.p.name}</b> <small>{posLabel(r.best.p.position)} · #{r.best.r.pick}</small></>:'—'}</td></tr>})}</tbody></table>
  </Panel>;
}

// ── v1.0 news wire ──────────────────────────────────────────────────────────
const groupOf=type=>{for(const [g,list] of Object.entries(STORY_GROUPS))if(list.includes(type))return g;return 'Games';};
export function NewsList({u,items,openPlayer,openTeam,compact=false}){
  if(!items.length)return <Empty>No stories yet.</Empty>;
  return <div className={`news-wire-list ${compact?'compact':''}`}>{items.map(n=>{const p=n.playerId?findPlayer(u,n.playerId):null,t=findTeam(u,n.teamId||p?.teamId);return <button key={n.id} className={`wire-item grp-${groupOf(n.type).toLowerCase()} ${n.importance>=85?'hot':''}`} onClick={()=>n.playerId?openPlayer?.(n.playerId):n.teamId?openTeam?.(n.teamId):null}>
    <span className="wire-when">Y{n.year}{n.week?` · W${n.week}`:n.phase==='Offseason'?' · OFF':n.phase==='Postseason'?' · POST':''}</span>
    {p?<PlayerFace player={p} team={t} size={compact?28:36}/>:t?<TeamMark team={t} size={compact?28:36}/>:<span className="wire-dot"/>}
    <span className="wire-copy"><small>{n.type}</small><b>{n.title}</b>{!compact&&<em>{n.body}</em>}</span>
  </button>})}</div>;
}
export function NewsWire({u,openPlayer,openTeam}){
  const[group,setGroup]=useState('All'),[limit,setLimit]=useState(20);
  const items=(u.news||[]).filter(n=>group==='All'||groupOf(n.type)===group);
  return <Panel title="News wire" eyebrow="EVERY STORY IN THE UNIVERSE · NEWEST FIRST" action={<Segmented value={group} onChange={g=>{setGroup(g);setLimit(20)}} items={['All','Games','Races','Moves','Legacy']}/>}>
    <NewsList u={u} items={items.slice(0,limit)} openPlayer={openPlayer} openTeam={openTeam}/>
    {items.length>limit&&<div className="gc-controls"><button onClick={()=>setLimit(l=>l+30)}>LOAD MORE ({items.length-limit})</button></div>}
  </Panel>;
}
export function EntityNews({u,playerId,teamId,openPlayer,openTeam}){
  const items=(u.news||[]).filter(n=>(playerId&&n.playerId===playerId)||(teamId&&(n.teamId===teamId))).slice(0,12);
  return <Panel title="In the news" eyebrow="HEADLINES FROM THE CHRONICLE WIRE"><NewsList u={u} items={items} openPlayer={openPlayer} openTeam={openTeam} compact/></Panel>;
}
