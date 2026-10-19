import React,{useEffect,useMemo,useState} from 'react';
import { TeamMark, PlayerFace } from './ui.jsx';
import { findTeam, findPlayer, describePlay } from '../sim/season.js';
import { RivalryStrip, gameQBs } from './Stories.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Game Center (v0.8): everything here is drawn from the engine's real drive log,
// so the field, the win-probability swing and the drive chart all tell the same
// story the box score does.
// ─────────────────────────────────────────────────────────────────────────────

const GAME=3600;
const POS={HB:'RB',OG:'G',OT:'T'};
const posLabel=p=>POS[p]||p;
export const hasDriveLog=g=>Array.isArray(g?.drives)&&g.drives.length>0&&Array.isArray(g?.plays);

export function clockLabel(sec,length=GAME,stage='Regular Season'){
  if(sec>=length&&length>=GAME)return 'FINAL';
  if(sec>=GAME){const ot=stage==='Regular Season'?600:900,into=sec-GAME,period=Math.floor(into/ot),left=ot-(into%ot);return `${period?`${period+1}OT`:'OT'} ${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`;}
  const q=Math.min(4,Math.floor(sec/900)+1),left=900-(sec%900);
  return `Q${q} ${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`;
}
export function scoreAt(game,sec){
  let h=0,a=0;for(const p of game.plays||[]){if(p.t>sec)break;if(p.pts){h=p.h;a=p.a;}}
  if(sec>=(game.length||GAME))return {h:game.homeScore,a:game.awayScore};
  return {h,a};
}
function erf(x){const s=Math.sign(x);x=Math.abs(x);const t=1/(1+.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return s*y;}
const phi=z=>.5*(1+erf(z/Math.SQRT2));
export function winProbAt(game,sec,h,a){
  const L=Math.max(GAME,game.length||GAME);
  if(sec>=L)return h>a?1:h<a?0:.5;
  const diff=h-a;
  if(sec>=GAME){return clampN(.5+diff*.12,.02,.98);}
  const rem=(GAME-sec)/GAME,xm=(game.xm||0)*rem,sd=13.5*Math.sqrt(rem)+.9;
  return clampN(phi((diff+xm)/sd),.005,.995);
}
const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
export function winProbSeries(game){
  const pts=[{t:0,wp:winProbAt(game,0,0,0)}];
  const marks=new Set([0]);
  for(const d of game.drives||[]){marks.add(d.s);marks.add(d.e);}
  for(const p of game.plays||[])if(p.pts||p.k==='INT'||p.k==='FUMBLE')marks.add(p.t);
  for(let s=60;s<GAME;s+=120)marks.add(s);
  const L=Math.max(GAME,game.length||GAME);marks.add(L);
  for(const t of [...marks].sort((x,y)=>x-y)){if(t===0)continue;const {h,a}=scoreAt(game,t);pts.push({t,wp:winProbAt(game,t,h,a)});}
  return pts;
}
export function dramaScore(g,u=null){
  const f=g.flags||{},m=Math.abs(g.homeScore-g.awayScore);
  let s=(f.comeback>=8?f.comeback*1.4:0)+(f.leadChanges||0)*4+(f.gameWinner?10:0)+(f.ot?12:0)+Math.max(0,17-m)*.8;
  if(u){const h=findTeam(u,g.homeId),a=findTeam(u,g.awayId);s+=((h?.current?.wins||0)+(a?.current?.wins||0))*.45;}
  return s;
}
export function dramaTags(g){
  const f=g.flags||{},tags=[];
  if(f.ot)tags.push('OVERTIME');
  if(f.comeback>=14)tags.push(`${f.comeback}-PT COMEBACK`);else if(f.comeback>=10)tags.push('COMEBACK');
  if(f.gameWinner)tags.push('LATE WINNER');
  if((f.leadChanges||0)>=3)tags.push(`${f.leadChanges} LEAD CHANGES`);
  return tags;
}

// Ball position on the 0–100 field (0 = home goal line on the left).
function ballState(game,sec){
  const drives=game.drives||[];let cur=null,prev=null;
  for(const d of drives){if(d.s<=sec&&sec<d.e){cur=d;break;}if(d.e<=sec)prev=d;}
  if(cur){const f=clampN((sec-cur.s)/Math.max(1,cur.e-cur.s),0,1),y=cur.y0+(cur.y1-cur.y0)*f;return {drive:cur,yard:y,live:true};}
  if(prev)return {drive:prev,yard:prev.y1,live:false};
  return {drive:null,yard:50,live:false};
}
const fieldX=(side,yard)=>side===0?yard:100-yard;

const RESULT_LABEL={TD:'TOUCHDOWN',FG:'FIELD GOAL',PUNT:'PUNT',INT:'INTERCEPTION',FUM:'FUMBLE',DOWNS:'ON DOWNS',MISS:'MISSED FG',HALF:'END OF HALF',END:'END OF GAME',SAFETY:'SAFETY'};
const RESULT_TONE={TD:'score',FG:'score',PUNT:'neutral',INT:'turnover',FUM:'turnover',DOWNS:'turnover',MISS:'neutral',HALF:'neutral',END:'neutral',SAFETY:'turnover'};

export function FieldView({u,game,sec=Infinity}){
  const home=findTeam(u,game.homeId),away=findTeam(u,game.awayId);
  const L=Math.max(GAME,game.length||GAME),t=Math.min(sec,L),b=ballState(game,t);
  const W=1000,H=210,ez=70,fx=y=>ez+y*(W-ez*2)/100;
  const d=b.drive,side=d?.o??0,offense=side===0?home:away;
  const ballX=fx(fieldX(side,b.yard)),startX=d?fx(fieldX(side,d.y0)):ballX;
  const dir=side===0?1:-1;
  const recent=[...(game.plays||[])].filter(p=>p.t<=t&&['TD','DTD','FG','INT','FUMBLE','SACK','SAFETY','BIG','FGMISS'].includes(p.k)).slice(-1)[0];
  const flash=recent&&t-recent.t<=40&&t<L?recent:null;
  return <div className="gc-field-wrap">
    <svg className="gc-field" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Field position">
      <defs>
        <linearGradient id="gc-turf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2f7a3d"/><stop offset="1" stopColor="#1f5a2b"/></linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="14" fill="url(#gc-turf)"/>
      {Array.from({length:10},(_,i)=><rect key={i} x={fx(i*10)} y="0" width={(W-ez*2)/10} height={H} fill={i%2?'#ffffff08':'#00000010'}/>)}
      <rect x="0" y="0" width={ez} height={H} rx="14" fill={home?.primary||'#1b3a5a'}/>
      <rect x={W-ez} y="0" width={ez} height={H} rx="14" fill={away?.primary||'#5a1b2a'}/>
      <text x={ez/2} y={H/2} className="gc-ez-text" transform={`rotate(-90 ${ez/2} ${H/2})`} fill={home?.secondary||'#fff'}>{(home?.shortId||home?.id||'HOME').replace('CFB-','')}</text>
      <text x={W-ez/2} y={H/2} className="gc-ez-text" transform={`rotate(90 ${W-ez/2} ${H/2})`} fill={away?.secondary||'#fff'}>{(away?.shortId||away?.id||'AWAY').replace('CFB-','')}</text>
      {Array.from({length:21},(_,i)=>{const x=fx(i*5);return <line key={i} x1={x} x2={x} y1="8" y2={H-8} stroke="#ffffff" strokeOpacity={i%2?.18:.55} strokeWidth={i===10?2.4:1.4}/>})}
      {[10,20,30,40,50,60,70,80,90].map(y=><g key={y}><text x={fx(y)} y="30" className="gc-yard-num">{y>50?100-y:y}</text><text x={fx(y)} y={H-16} className="gc-yard-num">{y>50?100-y:y}</text></g>)}
      {d&&<>
        <line x1={startX} x2={ballX} y1={H/2} y2={H/2} stroke={offense?.primary||'#2f9fff'} strokeWidth="9" strokeLinecap="round" opacity=".9"/>
        <line x1={startX} x2={ballX} y1={H/2} y2={H/2} stroke={offense?.secondary||'#fff'} strokeWidth="2" strokeLinecap="round" opacity=".7"/>
        <line x1={startX} x2={startX} y1="14" y2={H-14} stroke="#ffffff" strokeOpacity=".5" strokeDasharray="5 5"/>
        <g transform={`translate(${ballX} ${H/2})`}><ellipse rx="13" ry="8" fill="#7a3f1d" stroke="#2b1408" strokeWidth="1.5"/><line x1="-5" x2="5" y1="0" y2="0" stroke="#fff" strokeWidth="1.4"/><line x1="-2" x2="-2" y1="-2.5" y2="2.5" stroke="#fff" strokeWidth="1"/><line x1="2" x2="2" y1="-2.5" y2="2.5" stroke="#fff" strokeWidth="1"/></g>
        <polygon points={`${ballX+dir*22},${H/2-34} ${ballX+dir*36},${H/2-26} ${ballX+dir*22},${H/2-18}`} fill={offense?.primary||'#fff'} stroke="#fff" strokeWidth="1.2"/>
      </>}
    </svg>
    <div className="gc-field-caption">
      {d?<><TeamMark team={offense} size={22}/><span><b>{offense?.name}</b> {b.live?'ball':'last drive'} · {d.n} plays, {d.yds} yds{!b.live?` · ${RESULT_LABEL[d.r]||d.r}`:''}</span></>:<span>Kickoff</span>}
      {flash&&<em className={`gc-flash gc-flash-${flash.k.toLowerCase()}`}>{flash.k==='DTD'?'TD':flash.k==='FGMISS'?'NO GOOD':flash.k==='BIG'?'BIG PLAY':flash.k}</em>}
    </div>
  </div>;
}

export function WinProbChart({u,game,sec=Infinity}){
  const home=findTeam(u,game.homeId),away=findTeam(u,game.awayId);
  const series=useMemo(()=>winProbSeries(game),[game.id]);
  // Don't reveal overtime before the viewer reaches it.
  const full=Math.max(GAME,game.length||GAME),L=sec>=GAME?full:GAME,t=Math.min(sec,full);
  const W=600,H=150,pad=22,x=s=>pad+s*(W-pad*2)/L,y=wp=>pad/2+(1-wp)*(H-pad*1.5);
  const shown=series.filter(p=>p.t<=t);
  if(shown.length&&shown[shown.length-1].t<t){const {h,a}=scoreAt(game,t);shown.push({t,wp:winProbAt(game,t,h,a)});}
  const path=shown.map((p,i)=>`${i?'L':'M'}${x(p.t).toFixed(1)},${y(p.wp).toFixed(1)}`).join(' ');
  const area=shown.length?`${path} L${x(shown[shown.length-1].t).toFixed(1)},${y(.5)} L${x(0)},${y(.5)} Z`:'';
  const last=shown[shown.length-1]||{wp:.5};
  const leader=last.wp>=.5?home:away,pct=Math.round(Math.max(last.wp,1-last.wp)*100);
  return <div className="gc-wp">
    <div className="gc-wp-head"><span>WIN PROBABILITY</span><b>{leader?.name||'—'} {pct}%</b></div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Win probability over time">
      <defs>
        <clipPath id={`gc-top-${game.id}`}><rect x="0" y="0" width={W} height={y(.5)}/></clipPath>
        <clipPath id={`gc-bot-${game.id}`}><rect x="0" y={y(.5)} width={W} height={H}/></clipPath>
      </defs>
      {[900,1800,2700].map(q=><line key={q} x1={x(q)} x2={x(q)} y1={pad/2} y2={H-pad} className="gc-grid"/>)}
      {L>GAME&&<rect x={x(GAME)} y={pad/2} width={x(L)-x(GAME)} height={H-pad*1.5} className="gc-ot-band"/>}
      <line x1={pad} x2={W-pad} y1={y(.5)} y2={y(.5)} className="gc-mid"/>
      {area&&<path d={area} fill={home?.primary||'#2f9fff'} opacity=".55" clipPath={`url(#gc-top-${game.id})`}/>}
      {area&&<path d={area} fill={away?.primary||'#ff3956'} opacity=".55" clipPath={`url(#gc-bot-${game.id})`}/>}
      {path&&<path d={path} fill="none" stroke="#f4f8fc" strokeWidth="2"/>}
      {shown.length>0&&<circle cx={x(last.t||0)} cy={y(last.wp)} r="4" fill="#f3c94d"/>}
      <text x={pad+2} y={pad+4} className="gc-wp-label">{home?.shortId||home?.id}</text>
      <text x={pad+2} y={H-pad-4} className="gc-wp-label">{away?.shortId||away?.id}</text>
      {['Q1','Q2','Q3','Q4'].map((q,i)=><text key={q} x={x(i*900+450)} y={H-6} className="gc-wp-q">{q}</text>)}
      {L>GAME&&<text x={x((GAME+L)/2)} y={H-6} className="gc-wp-q">OT</text>}
    </svg>
  </div>;
}

export function DriveChart({u,game,sec=Infinity,limit=null}){
  const home=findTeam(u,game.homeId),away=findTeam(u,game.awayId);
  let drives=(game.drives||[]).filter(d=>d.s<=sec);
  if(limit)drives=drives.slice(-limit);
  return <div className="gc-drives">
    <div className="gc-drives-head"><span>DRIVE CHART</span><small>{drives.length} drives</small></div>
    {[...drives].reverse().map((d,i)=>{const team=d.o===0?home:away,live=d.e>sec,y1=live?d.y0+(d.y1-d.y0)*clampN((sec-d.s)/Math.max(1,d.e-d.s),0,1):d.y1;const a=fieldX(d.o,d.y0),b=fieldX(d.o,y1),lo=Math.min(a,b),hi=Math.max(a,b);
      return <div key={`${d.s}-${i}`} className={`gc-drive ${live?'live':''} tone-${live?'live':RESULT_TONE[d.r]||'neutral'}`}>
        <TeamMark team={team} size={22}/>
        <span className="gc-drive-time">{clockLabel(d.s,game.length,game.stage)}</span>
        <div className="gc-drive-bar"><i style={{left:`${lo}%`,width:`${Math.max(1.2,hi-lo)}%`,background:team?.primary||'#2f9fff',borderColor:team?.secondary||'#fff'}}/><b style={{left:`${50}%`}}/></div>
        <span className="gc-drive-meta">{d.n} pl · {d.yds>0?'+':''}{Math.round(d.yds)}</span>
        <em>{live?'IN PROGRESS':RESULT_LABEL[d.r]||d.r}{!live&&d.pts?` +${d.pts}`:''}</em>
        {!live&&<strong>{d.a}–{d.h}</strong>}
      </div>})}
  </div>;
}

export function QuarterTable({u,game,sec=Infinity}){
  const home=findTeam(u,game.homeId),away=findTeam(u,game.awayId),q=game.quarters;if(!q)return null;
  const L=game.length||GAME,final=sec>=L,hasOT=sec>=GAME&&((q.home[4]||0)+(q.away[4]||0)>0||game.flags?.ot);
  // Partial quarters while watching
  const byQ=side=>{const out=[0,0,0,0,0];for(const p of game.plays||[]){if(p.t>sec||!p.pts||p.o!==side)continue;out[p.t>=GAME?4:Math.min(3,Math.floor(p.t/900))]+=p.pts;}return out;};
  const rows=[[away,final?q.away:byQ(1),final?game.awayScore:scoreAt(game,sec).a],[home,final?q.home:byQ(0),final?game.homeScore:scoreAt(game,sec).h]];
  return <table className="gc-quarters"><thead><tr><th>Team</th><th>1</th><th>2</th><th>3</th><th>4</th>{hasOT&&<th>OT</th>}<th>T</th></tr></thead><tbody>{rows.map(([t,qs,tot])=><tr key={t?.id}><td><div className="team-cell"><TeamMark team={t} size={22}/><b>{t?.shortId||t?.id}</b></div></td>{qs.slice(0,4).map((v,i)=><td key={i}>{v}</td>)}{hasOT&&<td>{qs[4]}</td>}<td><b>{tot}</b></td></tr>)}</tbody></table>;
}

function leadersFor(u,game,teamId){
  const rows=Object.entries(game.playerStats||{}).map(([id,s])=>({p:findPlayer(u,id),s})).filter(x=>x.p&&x.p.teamId===teamId);
  const best=(fn,filter=()=>true)=>rows.filter(x=>filter(x)).sort((a,b)=>fn(b.s)-fn(a.s))[0];
  const pass=best(s=>s.passYards||0,x=>x.p.position==='QB'),rush=best(s=>s.rushYards||0,x=>x.p.position!=='QB'||!(x.s.passYards>0)),rec=best(s=>s.recYards||0),def=best(s=>(s.sacks||0)*3+(s.interceptions&&!s.passYards?s.interceptions*4:0)+(s.defensiveTD||0)*6+(s.tackles||0)*.2,x=>['EDGE','DT','LB','CB','S'].includes(x.p.position));
  return [
    pass&&(pass.s.passYards||0)>0&&{label:'PASSING',p:pass.p,line:`${pass.s.passYards} yds · ${pass.s.passTD||0} TD · ${pass.s.interceptions||0} INT`},
    rush&&(rush.s.rushYards||0)>0&&{label:'RUSHING',p:rush.p,line:`${rush.s.rushYards} yds · ${rush.s.rushTD||0} TD`},
    rec&&(rec.s.recYards||0)>0&&{label:'RECEIVING',p:rec.p,line:`${rec.s.recYards} yds · ${rec.s.recTD||0} TD`},
    def&&{label:'DEFENSE',p:def.p,line:`${def.s.tackles||0} TKL · ${def.s.sacks||0} SCK${def.s.interceptions&&!def.s.passYards?` · ${def.s.interceptions} INT`:''}${def.s.defensiveTD?' · TD':''}`}
  ].filter(Boolean);
}
const mmss=s=>`${Math.floor((s||0)/60)}:${String(Math.round((s||0)%60)).padStart(2,'0')}`;
export function BoxScore({u,game,openPlayer}){
  const home=findTeam(u,game.homeId),away=findTeam(u,game.awayId),hb=game.homeBox||{},ab=game.awayBox||{};
  const rows=[['Total yards',(ab.passYards||0)+(ab.rushYards||0),(hb.passYards||0)+(hb.rushYards||0)],['Passing',ab.passYards,hb.passYards],['Rushing',ab.rushYards,hb.rushYards],['First downs',ab.firstDowns??'—',hb.firstDowns??'—'],['3rd down',ab.thirdAtt!=null?`${ab.thirdConv}/${ab.thirdAtt}`:'—',hb.thirdAtt!=null?`${hb.thirdConv}/${hb.thirdAtt}`:'—'],['Turnovers',ab.turnovers,hb.turnovers],['Sacks taken',ab.sacksAllowed,hb.sacksAllowed],['Possession',ab.top!=null?mmss(ab.top):'—',hb.top!=null?mmss(hb.top):'—']];
  return <div className="gc-box">
    <div className="gc-box-stats"><div className="gc-box-head"><b>{away?.shortId||away?.id}</b><span>TEAM STATS</span><b>{home?.shortId||home?.id}</b></div>{rows.map(([l,a,h])=><div key={l} className="gc-box-row"><strong>{a??0}</strong><span>{l}</span><strong>{h??0}</strong></div>)}</div>
    <div className="gc-leaders">{[[away,game.awayId],[home,game.homeId]].map(([t,id])=><div key={id}><div className="gc-leaders-team"><TeamMark team={t} size={24}/><b>{t?.name}</b></div>{leadersFor(u,game,id).map(r=><button key={r.label} onClick={()=>openPlayer?.(r.p.id)}><PlayerFace player={r.p} team={t} size={34}/><span><small>{r.label}</small><b>{posLabel(r.p.position)} {r.p.name}</b><em>{r.line}</em></span></button>)}</div>)}</div>
  </div>;
}

export function KeyPlays({u,game,sec=Infinity,limit=null}){
  let plays=(game.plays||[]).filter(p=>p.t<=sec&&['TD','DTD','FG','INT','FUMBLE','SAFETY','FGMISS','XP2'].includes(p.k));
  if(limit)plays=plays.slice(-limit);
  return <div className="gc-keyplays"><div className="gc-drives-head"><span>SCORING & TURNOVERS</span><small>{plays.length}</small></div>
    {[...plays].reverse().map((p,i)=>{const team=findTeam(u,p.o===0?game.homeId:game.awayId);return <div key={`${p.t}-${i}`} className={`gc-keyplay k-${p.k.toLowerCase()}`} style={{'--kp':team?.primary||'#2f9fff'}}><span className="gc-kp-time">{clockLabel(p.t,game.length,game.stage)}</span><TeamMark team={team} size={22}/><span className="gc-kp-copy"><b>{p.k==='DTD'?'DEF TD':p.k==='FGMISS'?'NO GOOD':p.k==='XP2'?'2-PT':p.k}</b><small>{describePlay(u,game,p)}</small></span><strong>{p.pts?`${p.a}–${p.h}`:''}</strong></div>})}
    {!plays.length&&<div className="empty">No scores or turnovers yet.</div>}
  </div>;
}

export function Scoreboard({u,game,sec=Infinity,hidden=false}){
  const home=findTeam(u,game.homeId),away=findTeam(u,game.awayId),L=game.length||GAME,{h,a}=scoreAt(game,Math.min(sec,L));
  // Season records already include this game, so they only appear once the result is final.
  const showRec=!hidden&&sec>=L,rec=t=>showRec&&t?.current?` · ${t.current.wins}-${t.current.losses}`:'';
  return <div className="gc-scoreboard">
    <div className="gc-sb-team"><TeamMark team={away} size={54}/><span><small>AWAY{rec(away)}</small><b>{away?.name}</b></span><strong>{hidden?'–':a}</strong></div>
    <div className="gc-sb-clock"><b>{hidden?'PRE-GAME':clockLabel(Math.min(sec,L),L,game.stage)}</b><small>{game.stage==='Regular Season'?`WEEK ${game.round}`:game.stage}</small></div>
    <div className="gc-sb-team home"><strong>{hidden?'–':h}</strong><span><small>HOME{rec(home)}</small><b>{home?.name}</b></span><TeamMark team={home} size={54}/></div>
  </div>;
}

// Full replay player. startAtEnd=true opens the finished game (box-score view);
// false starts a spoiler-free broadcast from kickoff.
export function GameReplay({u,game,onClose,startAtEnd=false,openPlayer,title}){
  const L=Math.max(GAME,game.length||GAME);
  const[sec,setSec]=useState(startAtEnd?L:0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[started,setStarted]=useState(startAtEnd);
  useEffect(()=>{if(!playing)return;const id=setInterval(()=>setSec(s=>{const n=Math.min(L,s+9*speed);if(n>=L)setPlaying(false);return n;}),110);return()=>clearInterval(id)},[playing,speed,L]);
  useEffect(()=>{const onKey=e=>{if(e.key==='Escape')onClose?.()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  const nextScore=()=>{const n=(game.plays||[]).find(p=>p.t>sec+1&&(p.pts>0||p.k==='INT'||p.k==='FUMBLE'));setSec(n?Math.min(L,n.t+2):L);};
  const final=sec>=L,D=sec>=GAME?L:GAME; // progress scale hides overtime until it happens
  if(!hasDriveLog(game))return <div className="gc-modal" onClick={onClose}><div className="gc-modal-card" onClick={e=>e.stopPropagation()}><button className="gc-close" onClick={onClose}>×</button><Scoreboard u={u} game={game}/><p className="explain">This game was played by the pre-v0.8 engine, so only its box score was recorded.</p><BoxScore u={u} game={game} openPlayer={openPlayer}/></div></div>;
  return <div className="gc-modal" onClick={onClose}><div className="gc-modal-card" onClick={e=>e.stopPropagation()}>
    <button className="gc-close" onClick={onClose} aria-label="Close">×</button>
    {title&&<div className="eyebrow gc-title">{title}</div>}
    <Scoreboard u={u} game={game} sec={sec} hidden={!started}/>
    {!started?<div className="gc-pregame">
      <RivalryStrip u={u} homeId={game.homeId} awayId={game.awayId} homeQB={gameQBs(u,game).home} awayQB={gameQBs(u,game).away} excludeGameId={game.id}/>
      <p>Result sealed. Watch it unfold drive by drive, or open the final box score.</p>
      <div className="gc-controls"><button className="advance" onClick={()=>{setStarted(true);setPlaying(true);}}>WATCH FROM KICKOFF <span>›</span></button><button onClick={()=>{setStarted(true);setSec(L);}}>SKIP TO FINAL</button></div>
    </div>:<>
      <div className="gc-progress" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setSec(Math.round(clampN((e.clientX-r.left)/r.width,0,1)*D));}}><i style={{width:`${Math.min(100,sec/D*100)}%`}}/>{[900,1800,2700].map(q=><b key={q} style={{left:`${q/D*100}%`}}/>)}</div>
      <div className="gc-controls">
        {!final&&<button className="advance" onClick={()=>setPlaying(p=>!p)}>{playing?'PAUSE':'PLAY'}</button>}
        {!final&&<button onClick={nextScore}>NEXT SCORE ›</button>}
        {!final&&<div className="speed-toggle">{[1,3,8].map(s=><button key={s} className={speed===s?'active':''} onClick={()=>setSpeed(s)}>{s}×</button>)}</div>}
        {!final&&<button onClick={()=>{setSec(L);setPlaying(false);}}>FINAL</button>}
        {final&&<button onClick={()=>{setSec(0);setPlaying(true);}}>REPLAY FROM KICKOFF</button>}
      </div>
      <FieldView u={u} game={game} sec={sec}/>
      <div className="gc-grid-2"><WinProbChart u={u} game={game} sec={sec}/><QuarterTable u={u} game={game} sec={sec}/></div>
      <div className="gc-grid-2"><KeyPlays u={u} game={game} sec={sec}/><DriveChart u={u} game={game} sec={sec}/></div>
      {final&&<BoxScore u={u} game={game} openPlayer={openPlayer}/>}
    </>}
  </div></div>;
}
