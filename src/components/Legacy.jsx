import React,{useState} from 'react';
import { TeamMark, PlayerFace, RarityPill, Panel, Segmented, Empty } from './ui.jsx';
import { findTeam, findPlayer, freeAgentBoard } from '../sim/season.js';
import { dynastyEras, titleYears } from '../sim/legacy.js';
import { RARITIES } from '../sim/generate.js';

// ─────────────────────────────────────────────────────────────────────────────
// v1.1 legacy surfaces: card reveals for the offseason's biggest moves,
// the pre-market free-agent board, preseason power rankings, dynasties,
// offseason report cards and title banners.
// ─────────────────────────────────────────────────────────────────────────────
const POS={HB:'RB',OG:'G',OT:'T'},posLabel=p=>POS[p]||p;
const rr=r=>RARITIES.indexOf(r);
const money=n=>`$${Number(n||0).toFixed(1)}M`;
const hiddenProspect=p=>p?.league==='COLLEGE'&&!p?.revealed;

// ── Card reveal ─────────────────────────────────────────────────────────────
// Each card flips in three beats: where he came from → who he is → where he went.
const STEP_LABEL=['REVEAL ORIGIN','REVEAL PLAYER','REVEAL DESTINATION'];
function RevealSlot({shown,label,accent,children,back}){
  return <div className={`rv-slot ${shown?'shown':''}`} style={accent?{'--rv':accent}:undefined}>
    <div className="rv-inner"><div className="rv-back"><span>{back||'?'}</span><small>{label}</small></div><div className="rv-front"><small>{label}</small>{children}</div></div>
  </div>;
}
export function RevealDeck({u,title,eyebrow,cards,openPlayer,openTeam}){
  const [idx,setIdx]=useState(0),[step,setStep]=useState(0),[all,setAll]=useState(false);
  if(!cards?.length)return null;
  const i=Math.min(idx,cards.length-1),c=cards[i],shownStep=all?3:step,last=i>=cards.length-1;
  const p=findPlayer(u,c.playerId),from=findTeam(u,c.fromId),to=findTeam(u,c.toId);
  const advance=()=>{if(shownStep<3)setStep(s=>s+1);else if(!last){setIdx(i+1);setStep(0);}};
  return <section className="reveal-deck" style={{'--rv':shownStep>=3?(to?.primary||'#1678c2'):'#1678c2'}}>
    <div className="rv-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><div className="rv-count"><b>{i+1}</b><span>/ {cards.length}</span></div></div>
    <div className="rv-badge">{c.badge}</div>
    <div className="rv-row">
      <RevealSlot shown={shownStep>=1} label={c.fromLabel||'FROM'} accent={from?.primary} back="?">
        {from?<><TeamMark team={from} size={64}/><b>{from.name}</b></>:<><span className="rv-none">—</span><b>{c.fromFallback||'Open market'}</b></>}
        {c.originNote&&<em>{c.originNote}</em>}
      </RevealSlot>
      <span className="rv-arrow">›</span>
      <RevealSlot shown={shownStep>=2} label="PLAYER" back="?">
        {p&&<button className="rv-player" onClick={()=>openPlayer?.(p.id)}><PlayerFace player={p} team={shownStep>=3?to:from} size={72}/><b>{p.name}</b><span>{posLabel(p.position)} · age {p.age}</span>{c.hideRarity?<em className="rv-scout">{c.scoutLabel||p.scouting?.label||'Prospect'}</em>:<RarityPill rarity={c.rarity||p.trueRarity} compact/>}</button>}
        {c.playerNote&&<em>{c.playerNote}</em>}
      </RevealSlot>
      <span className="rv-arrow">›</span>
      <RevealSlot shown={shownStep>=3} label={c.toLabel||'TO'} accent={to?.primary} back="?">
        {to&&<button className="rv-team" onClick={()=>openTeam?.(to.id)}><TeamMark team={to} size={72}/><b>{to.name}</b></button>}
        {c.destNote&&<em className="rv-dest-note">{c.destNote}</em>}
      </RevealSlot>
    </div>
    <div className="gc-controls">
      {(shownStep<3||!last)&&<button className="advance" onClick={advance}>{shownStep<3?STEP_LABEL[shownStep]:'NEXT CARD'} <span>›</span></button>}
      {!all&&<button onClick={()=>setAll(true)}>REVEAL ALL</button>}
      {(i>0||all)&&<button onClick={()=>{setIdx(0);setStep(0);setAll(false);}}>RESTART</button>}
    </div>
    {(i>0||all)&&<div className="rv-done">{cards.slice(0,all?cards.length:i).map((x,k)=>{const q=findPlayer(u,x.playerId),a=findTeam(u,x.fromId),b=findTeam(u,x.toId);return <button key={k} onClick={()=>{setAll(false);setIdx(k);setStep(3);}}><TeamMark team={a} size={20}/><span>›</span><b>{q?.name}</b><span>›</span><TeamMark team={b} size={20}/></button>})}</div>}
  </section>;
}

// Card builders for the three reveal stages.
export function freeAgencyCards(u,events,limit=5){
  return (events||[]).filter(e=>e.type==='Marquee Signing').sort((a,b)=>rr(b.rarity)-rr(a.rarity)||b.overall-a.overall).slice(0,limit).map(e=>{
    const suitors=(e.suitors||[]).map(id=>findTeam(u,id)?.name).filter(Boolean);
    return {playerId:e.playerId,fromId:e.fromId,toId:e.toId,rarity:e.rarity,badge:e.ringChase?'CHASING A RING':e.returned?'HOMETOWN RETURN':'MARQUEE FREE AGENT',fromLabel:'LEAVES',toLabel:e.returned?'RE-SIGNS':'SIGNS WITH',
      playerNote:suitors.length>1?`Finalists: ${suitors.join(', ')}`:`OVR ${e.overall}`,destNote:`${e.years} yrs · ${money(e.annual)}/yr`};
  });
}
export function transferCards(u,events,limit=5){
  const tier=e=>{const p=findPlayer(u,e.playerId);return (p?.scouting?.expectedTier||0)*100+(p?.potential||p?.ceilingOverall||0);};
  return [...(events||[])].sort((a,b)=>tier(b)-tier(a)).slice(0,limit).map(e=>{const p=findPlayer(u,e.playerId);
    return {playerId:e.playerId,fromId:e.fromId,toId:e.toId,badge:'TRANSFER PORTAL',fromLabel:'ENTERS PORTAL FROM',toLabel:'COMMITS TO',hideRarity:hiddenProspect(p),scoutLabel:e.scouting,playerNote:p?[p.league==='COLLEGE'&&p.collegeYear?`College year ${p.collegeYear}`:null,p.personality].filter(Boolean).join(' · '):null};});
}
export function draftCards(u,events,limit=3){
  return [...(events||[])].sort((a,b)=>a.pick-b.pick).slice(0,limit).map(e=>({playerId:e.playerId,fromId:e.collegeId,toId:e.teamId,badge:`NO. ${e.pick} OVERALL PICK`,fromLabel:'OUT OF',toLabel:`PICK ${e.pick}`,hideRarity:true,
    scoutLabel:`Board: ${e.scouting?.label||'Prospect'}`,destNote:e.actualRarity?`True talent: ${e.actualRarity} · ceiling ${e.ceilingOverall||'—'}`:null}));
}

// ── Pre-market board ────────────────────────────────────────────────────────
export function FreeAgentBoard({u,openPlayer,openTeam}){
  const rows=freeAgentBoard(u,10);
  return <Panel title="Top 10 pending free agents" eyebrow="BEFORE THE MARKET OPENS · WILL THEY STAY?">
    {rows.length?<div className="fa-board">{rows.map((r,i)=>{const p=findPlayer(u,r.playerId),t=findTeam(u,r.teamId),odds=r.stay>=70?'Likely to stay':r.stay>=50?'Coin flip':'Testing the market';return <div key={r.playerId} className="fa-board-row">
      <strong>{i+1}</strong>
      <button className="fa-player" onClick={()=>openPlayer(p.id)}><PlayerFace player={p} team={t} size={40}/><span><b>{p.name}</b><small>{posLabel(p.position)} · OVR {p.overall} · age {p.age}{r.ringChaser?' · ring chaser':''}</small></span></button>
      <RarityPill rarity={p.trueRarity} compact/>
      <span className={`stay ${r.stay>=70?'hi':r.stay>=50?'mid':'lo'}`}><b>{r.stay}%</b><small>{odds}</small></span>
      <span className="fa-watch"><small>WATCH</small>{r.suitors.map(id=>{const x=findTeam(u,id);return <button key={id} onClick={()=>openTeam(id)} title={x?.name}><TeamMark team={x} size={22}/></button>})}</span>
    </div>})}</div>:<Empty>No notable contracts expire this year.</Empty>}
  </Panel>;
}

// ── Preseason power rankings ────────────────────────────────────────────────
export function PowerRankings({u,league='NFL',openTeam,limit=10,summaryOutlook=null}){
  const o=summaryOutlook||u.seasonState?.outlook?.[league];
  if(!o?.rows?.length)return null;
  const rows=o.rows.slice(0,limit),max=Math.max(...o.rows.map(r=>r.odds||0),1),judged=!!summaryOutlook;
  return <Panel title={judged?'Preseason picks vs reality':`Year ${o.year||u.year} power rankings`} eyebrow={judged?'WHERE THEY WERE PICKED · WHERE THEY FINISHED':`${league==='COLLEGE'?'COLLEGE':'NFL'} · PRESEASON TITLE ODDS`} className="premium-panel">
    <div className="power-rank">{rows.map(r=>{const t=findTeam(u,r.teamId);return <button key={r.teamId} onClick={()=>openTeam?.(r.teamId)}>
      <strong>{r.rank}</strong><TeamMark team={t} size={26}/><span><b>{t?.city||t?.name}</b>{!judged&&t?.current&&<small>{t.current.wins}-{t.current.losses}</small>}{judged&&<small>finished No. {r.finalRank}</small>}</span>
      <i style={{'--w':`${Math.max(4,(r.odds||0)/max*100)}%`,'--c':t?.primary||'#4ea1ff'}}/><em>{(r.odds||0).toFixed(1)}%</em>
    </button>})}</div>
  </Panel>;
}

// ── Dynasties ───────────────────────────────────────────────────────────────
export function DynastiesView({u,openTeam}){
  const [league,setLeague]=useState('NFL');
  const eras=dynastyEras(u,league),T=league==='NFL'?'Super Bowls':league==='UFL'?'UFL titles':'national titles';
  return <><Panel title="Dynasties & eras" eyebrow="RUNS OF TITLES · ERAS">
    <div className="panel-toggle"><Segmented value={league} onChange={setLeague} items={['NFL','COLLEGE','UFL']}/></div>
    <p className="explain">Two or more titles with no more than two empty years between them form an era. No team can win four straight, five in six years or six in ten.</p>
    {eras.length?<div className="dynasty-grid">{eras.map(e=>{const t=findTeam(u,e.teamId);return <button key={`${e.teamId}-${e.start}`} className={`dynasty-card ${e.label==='Dynasty'||e.label==='Three-peat'?'gold':''}`} style={{'--team':t?.primary||'#1678c2'}} onClick={()=>openTeam?.(e.teamId)}>
      <TeamMark team={t} size={56}/><span><small>{e.label.toUpperCase()}</small><b>The {t?.name} era</b><em>Y{e.start}–Y{e.end} · {e.titles} {T}{e.streak>=2?` · ${e.streak} straight`:''}</em></span>
      <div className="banners">{e.years.map(y=><i key={y}>Y{y}</i>)}</div>
    </button>})}</div>:<Empty>No team has won twice in a short window yet. Dynasties appear here.</Empty>}
  </Panel></>;
}

// ── Offseason report cards ──────────────────────────────────────────────────
export function OffseasonGrades({u,data,openTeam}){
  const [league,setLeague]=useState('NFL');const rows=data?.grades?.[league]||[];
  if(!data?.grades)return null;
  const cls=g=>g.startsWith('A')?'a':g.startsWith('B')?'b':g.startsWith('C')?'c':'f';
  const block=(label,list)=><div className="og-col"><span>{label}</span>{list.map(r=>{const t=findTeam(u,r.teamId);return <button key={r.teamId} onClick={()=>openTeam(r.teamId)}><b className={`og-grade ${cls(r.grade)}`}>{r.grade}</b><TeamMark team={t} size={26}/><span><b>{t?.name}</b><small>{r.from} → {r.to} ({r.delta>=0?'+':''}{r.delta})</small></span></button>})}</div>;
  return <Panel title="Offseason report cards" eyebrow="WINNERS & LOSERS · TEAM STRENGTH BEFORE VS AFTER">
    <div className="panel-toggle"><Segmented value={league} onChange={setLeague} items={['NFL','COLLEGE']}/></div>
    <div className="og-grid">{block('WINNERS',rows.slice(0,5))}{block('LOSERS',[...rows].reverse().slice(0,5))}</div>
  </Panel>;
}

// ── Title banners (team page) ───────────────────────────────────────────────
export function TitleBanners({u,team}){
  if(!team)return null;const ys=titleYears(u,team.league,team.id);if(!ys.length)return null;
  const T=team.league==='NFL'?'SUPER BOWL':team.league==='UFL'?'UFL':'NATIONAL';
  return <div className="title-banners" style={{'--team':team.primary,'--team2':team.secondary}}>{ys.map(y=><div key={y} className="title-banner"><small>{T}</small><b>CHAMPIONS</b><span>Y{y}</span></div>)}</div>;
}
