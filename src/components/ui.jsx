import React from 'react';
import { RARITY_META, RARITIES } from '../sim/generate.js';

export function TeamMark({team,size=34}){
  if(!team) return <span className="team-mark unknown">?</span>;
  return <span className="team-mark" style={{'--team':team.primary,'--team2':team.secondary,width:size,height:size,fontSize:Math.max(10,size*.28)}}>{team.id.slice(0,4)}</span>;
}

export function RarityPill({rarity,compact=false}){
  if(!rarity) return <span className="rarity mystery">UNREVEALED</span>;
  return <span className={`rarity ${compact?'compact':''}`} style={{'--rarity':RARITY_META[rarity]?.color||'#fff'}}>{rarity}</span>;
}

export function ProbabilityStrip({probs={}}){
  return <div className="prob-strip" title={RARITIES.filter(r=>probs[r]).map(r=>`${r}: ${probs[r]}%`).join(' · ')}>
    {RARITIES.map(r=>probs[r]>0?<span key={r} style={{width:`${probs[r]}%`,'--c':RARITY_META[r].color}}><b>{probs[r]>=12?`${probs[r]}%`:''}</b></span>:null)}
  </div>;
}

export function Metric({label,value,sub,tone}){
  return <div className={`metric ${tone||''}`}><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>;
}

export function Panel({title,eyebrow,action,children,className=''}){
  return <section className={`panel ${className}`}><div className="panel-head"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h3>{title}</h3></div>{action}</div>{children}</section>;
}

export function Segmented({items,value,onChange}){
  return <div className="segmented">{items.map(x=><button key={x.value||x} className={(x.value||x)===value?'active':''} onClick={()=>onChange(x.value||x)}>{x.label||x}</button>)}</div>;
}

export function Empty({children}){ return <div className="empty">{children}</div>; }
