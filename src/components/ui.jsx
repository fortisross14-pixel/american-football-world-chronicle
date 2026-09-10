import React from 'react';
import { RARITY_META, RARITIES } from '../sim/generate.js';

const NFL_LOGO_CODES={ARI:'ari',ATL:'atl',BAL:'bal',BUF:'buf',CAR:'car',CHI:'chi',CIN:'cin',CLE:'cle',DAL:'dal',DEN:'den',DET:'det',GB:'gb',HOU:'hou',IND:'ind',JAX:'jax',KC:'kc',LV:'lv',LAC:'lac',LAR:'lar',MIA:'mia',MIN:'min',NE:'ne',NO:'no',NYG:'nyg',NYJ:'nyj',PHI:'phi',PIT:'pit',SF:'sf',SEA:'sea',TB:'tb',TEN:'ten',WAS:'wsh'};
const NCAA_LOGO_IDS={MICH:130,OSU:194,ALA:333,UGA:61,TEX:251,ND:87,PSU:213,ORE:2483,LSU:99,OKLA:201,USC:30,CLEM:228,FSU:52,FLA:57,MIA:2390,TENN:2633,AUB:2,WASH:264,WIS:275,NEB:158,TAMU:245,MISS:145,ARK:8,SCAR:2579,MIZZ:142,UK:96,MSST:344,VANDY:238,ILL:356,IOWA:2294,MSU:127,MINN:135,UCLA:26,NW:77,PUR:2509,IND:84,MD:120,RUTG:164,CAL:25,STAN:24,UNC:153,NCST:152,VT:259,UVA:258,LOU:97,PITT:221,SYR:183,BC:103,GT:59,DUKE:150,WAKE:154,SMU:2567,TCU:2628,BAY:239,TTU:2641,OKST:197,KSU:2306,KU:2305,ISU:66,WVU:277,UCF:2116,CIN:2132,HOU:248,BYU:252,UTAH:254,ASU:9,ARIZ:12,COLO:38,BSU:68,FRES:278,SDSU:21,UNLV:2439,CSU:36,AF:2005,ARMY:349,NAVY:2426,MEM:235,TUL:2655,USF:58,UTSA:2636,ECU:151,FAU:2226,LIB:2335,APP:2026,JMU:256,MAR:276,CCU:324,TROY:2653,GASO:290,ULL:309,ULM:2433,TXST:326,WKU:98,MTSU:2393,TOLE:2649,OHIO:195,MIAO:193,BUFF:2084,NIU:2459,WMU:2711};

export function teamLogoUrl(team){
  if(!team)return null;
  if(team.league==='NFL'&&NFL_LOGO_CODES[team.id])return `https://a.espncdn.com/i/teamlogos/nfl/500/${NFL_LOGO_CODES[team.id]}.png`;
  if(team.league==='COLLEGE'){
    const id=NCAA_LOGO_IDS[team.shortId||String(team.id).replace('CFB-','')];
    if(id)return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
  }
  return null;
}

export function TeamMark({team,size=34}){
  if(!team) return <span className="team-mark unknown">?</span>;
  const logo=teamLogoUrl(team);
  return <span className={`team-mark ${logo?'has-logo':''}`} style={{'--team':team.primary,'--team2':team.secondary,width:size,height:size,fontSize:Math.max(10,size*.28)}}>
    {logo?<img src={logo} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement?.classList.remove('has-logo')}}/>:null}
    <span className="team-mark-fallback">{(team.shortId||team.id).slice(0,4)}</span>
  </span>;
}

function publicAsset(path){
  if(!path)return null;
  const base=(import.meta.env?.BASE_URL||'./');
  return `${base}${String(path).replace(/^\//,'')}`;
}

export function PlayerFace({player,team,size=84,className=''}){
  if(!player)return <span className={`player-face placeholder ${className}`} style={{width:size,height:size}}>?</span>;
  const elite=player.faceAssetTier==='elite';
  const src=publicAsset(player.faceAsset||player.baseFaceAsset);
  return <span className={`player-face ${elite?'elite-face':''} face-${player.faceBodyType||'fit'} ${className}`} style={{width:size,height:size,'--face-team':team?.primary||'#15253b','--face-team2':team?.secondary||'#243d5b'}} title={`${player.name} · ${player.position} · ${player.identityProfile||'American'}`}>
    {src?<img src={src} alt={`${player.name} portrait`} loading="lazy" draggable="false"/>:<span className="player-face-fallback">{player.position}</span>}
  </span>;
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
