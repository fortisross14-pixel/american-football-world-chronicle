import React,{useEffect,useMemo,useState} from 'react';
import { createUniverse, RARITIES, rarityCounts } from './sim/generate.js';
import { simulateYear, getStandings, getRoster, findTeam, findPlayer, getTeamStrength } from './sim/season.js';
import { TeamMark,RarityPill,ProbabilityStrip,Metric,Panel,Segmented,Empty } from './components/ui.jsx';

const NAV=['Home','NFL','College','UFL','Players','Market','Draft','ESPN','Records','Universe'];
const money=n=>`$${Number(n||0).toFixed(1)}M`;
const num=n=>Number(n||0).toLocaleString();
const statLine=p=>{
  const s=p?.stats?.seasons?.at(-1)||{};
  if(p.position==='QB') return `${num(s.passYards)} YDS · ${s.passTD||0} TD · ${s.interceptions||0} INT`;
  if(['HB','FB'].includes(p.position)) return `${num(s.rushYards)} RUSH · ${s.rushTD||0} TD`;
  if(['WR','TE'].includes(p.position)) return `${num(s.recYards)} REC YDS · ${s.recTD||0} TD`;
  return `${s.tackles||0} TKL · ${s.sacks||0} SCK · ${s.defInterceptions||0} INT`;
};

function SaveHub({universe,setUniverse}){
  const [seed,setSeed]=useState('Gridiron-1');
  const save=(slot)=>{localStorage.setItem(`afwc-save-${slot}`,JSON.stringify(universe));localStorage.setItem('afwc-active-slot',String(slot));};
  const load=slot=>{const raw=localStorage.getItem(`afwc-save-${slot}`);if(raw)setUniverse(JSON.parse(raw));};
  const fresh=()=>setUniverse(createUniverse(seed||`Gridiron-${Date.now()}`));
  return <Panel title="Universe saves" eyebrow="LOCAL DYNASTY ARCHIVE" action={<button className="small-btn" onClick={fresh}>New universe</button>}>
    <div className="save-row">{[1,2,3].map(slot=>{const raw=localStorage.getItem(`afwc-save-${slot}`);let label='Empty';if(raw){try{const x=JSON.parse(raw);label=`Year ${x.year} · ${x.seedText}`;}catch{}}return <div className="save-card" key={slot}><b>Slot {slot}</b><span>{label}</span><div><button onClick={()=>save(slot)}>Save</button><button disabled={!raw} onClick={()=>load(slot)}>Load</button></div></div>})}</div>
    <div className="seed-row"><input value={seed} onChange={e=>setSeed(e.target.value)} placeholder="Universe seed"/><button onClick={fresh}>Generate from seed</button></div>
  </Panel>
}

function Header({universe,onSim,simulating}){
  const latest=universe.seasonHistory[0];
  return <header className="topbar">
    <div className="brand"><div className="brand-ball">W</div><div><strong>WORLD CHRONICLE</strong><span>AMERICAN FOOTBALL</span></div></div>
    <div className="season-chip"><span>UNIVERSE</span><b>YEAR {universe.year}</b><small>{universe.phase}</small></div>
    <button className="advance" onClick={onSim} disabled={simulating}>{simulating?'SIMULATING…':`SIMULATE YEAR ${universe.year}`}<span>›</span></button>
    {latest&&<div className="champ-mini">Last champion <b>{findTeam(universe,latest.nflChampionId)?.name}</b></div>}
  </header>
}

function Home({u,openTeam,openPlayer}){
  const nfl=getStandings(u,'NFL'), college=getStandings(u,'COLLEGE'); const latest=u.seasonHistory[0];
  const topNews=u.news.slice(0,5);
  const leaders=useMemo(()=>u.players.filter(p=>!p.retired&&p.stats.seasons.length).sort((a,b)=>(b.stats.seasons.at(-1)?.passYards||b.stats.seasons.at(-1)?.rushYards||b.stats.seasons.at(-1)?.recYards||0)-(a.stats.seasons.at(-1)?.passYards||a.stats.seasons.at(-1)?.rushYards||a.stats.seasons.at(-1)?.recYards||0)).slice(0,4),[u]);
  return <div className="page">
    <div className="hero-grid">
      <div className="hero-copy"><div className="eyebrow">THE LIVING FOOTBALL UNIVERSE</div><h1>Every season leaves a scar.</h1><p>College prospects arrive as uncertainty. Careers reveal themselves. Franchises rise, overspend, rebuild and fall. History keeps the important parts.</p><div className="hero-stats"><Metric label="NFL" value="32 teams"/><Metric label="College" value={`${u.teams.college.length} programs`}/><Metric label="UFL" value="8 teams"/><Metric label="Tracked players" value={num(u.players.filter(p=>!p.retired).length)}/></div></div>
      <div className="hero-card"><div className="scorebug"><span>YEAR {Math.max(1,u.year-1)} FINAL</span><b>{latest?'CHAMPIONS CROWNED':'UNIVERSE READY'}</b></div>{latest?<><ChampionRow label="NFL" team={findTeam(u,latest.nflChampionId)} onClick={openTeam}/><ChampionRow label="COLLEGE" team={findTeam(u,latest.collegeChampionId)} onClick={openTeam}/><ChampionRow label="UFL" team={findTeam(u,latest.uflChampionId)} onClick={openTeam}/></>:<div className="start-state">Simulate Year 1 to create the first chapter.</div>}</div>
    </div>
    <div className="two-col">
      <Panel title="Top stories" eyebrow="ESPN · CHRONICLE WIRE"><div className="news-stack">{topNews.map(n=><button className="news-item" key={n.id} onClick={()=>n.playerId?openPlayer(n.playerId):n.teamId?openTeam(n.teamId):null}><span className={`news-type ${n.importance>=85?'hot':''}`}>{n.type}</span><div><b>{n.title}</b><p>{n.body}</p></div><time>Y{n.year}</time></button>)}</div></Panel>
      <Panel title="NFL pulse" eyebrow="POWER TABLE"><table><thead><tr><th>#</th><th>Team</th><th>W-L</th><th>PF</th><th>STR</th></tr></thead><tbody>{nfl.slice(0,7).map((t,i)=><tr key={t.id} onClick={()=>openTeam(t.id)}><td>{i+1}</td><td><div className="team-cell"><TeamMark team={t} size={28}/><b>{t.name}</b></div></td><td>{t.current.wins}-{t.current.losses}</td><td>{t.current.pf}</td><td>{getTeamStrength(u,t.id)}</td></tr>)}</tbody></table></Panel>
    </div>
    <div className="three-col"><Panel title="College top 5" eyebrow="PROGRAM RANKINGS">{college.slice(0,5).map((t,i)=><button className="rank-row" key={t.id} onClick={()=>openTeam(t.id)}><strong>{i+1}</strong><TeamMark team={t} size={30}/><span><b>{t.name}</b><small>{t.conference}</small></span><em>{t.current.wins}-{t.current.losses}</em></button>)}</Panel>
    <Panel title="Players to know" eyebrow="LATEST SEASON">{leaders.map(p=><button className="player-row" key={p.id} onClick={()=>openPlayer(p.id)}><span className="pos">{p.position}</span><span><b>{p.name}</b><small>{findTeam(u,p.teamId)?.name||'Free Agent'} · {statLine(p)}</small></span>{p.revealed?<RarityPill rarity={p.trueRarity} compact/>:<span className="mystery-tag">SCOUT</span>}</button>)}</Panel>
    <Panel title="The God View" eyebrow="DRAFT UNCERTAINTY"><p className="explain">College careers hide their true tier and future arc. Teams draft from probability bands. After the draft, this screen tells you who was actually lucky.</p><div className="god-key"><span>PUBLIC</span><b>Epic 65% · Legend 25% · Generational 10%</b><span>POST-DRAFT</span><b>Generational · Slow Burn · 14 years</b></div></Panel></div>
  </div>
}

function ChampionRow({label,team,onClick}){return <button className="champ-row" onClick={()=>team&&onClick(team.id)}><span>{label}</span><TeamMark team={team}/><b>{team?.name}</b><i>CHAMPION</i></button>}

function LeaguePage({u,league,openTeam,openPlayer}){
  const [tab,setTab]=useState('Standings'); const teams=getStandings(u,league); const isCollege=league==='COLLEGE';
  const players=u.players.filter(p=>!p.retired&&p.league===league);
  return <div className="page"><div className="page-title"><div><div className="eyebrow">COMPETITION</div><h1>{isCollege?'College Football':league}</h1><p>{isCollege?'100-program feeder universe with hidden prospect truth.':league==='NFL'?'32 franchises · salary cap · three-round draft · the top of the universe.':'Eight-team development league and second-chance engine.'}</p></div><Segmented value={tab} onChange={setTab} items={['Standings','Games','Stats','Teams','History',...(isCollege?['Prospects']:[])]}/></div>
  {tab==='Standings'&&<Panel title={isCollege?'Program rankings':'Standings'} eyebrow={`YEAR ${Math.max(1,u.year-1)} · ${league}`}><table><thead><tr><th>#</th><th>Team</th>{league==='NFL'&&<><th>Conf.</th><th>Div.</th></>}<th>W-L</th><th>PF</th><th>PA</th><th>Diff</th><th>Strength</th></tr></thead><tbody>{teams.map((t,i)=><tr key={t.id} onClick={()=>openTeam(t.id)}><td>{i+1}</td><td><div className="team-cell"><TeamMark team={t} size={28}/><b>{t.name}</b></div></td>{league==='NFL'&&<><td>{t.conference}</td><td>{t.division}</td></>}<td>{t.current.wins}-{t.current.losses}</td><td>{t.current.pf}</td><td>{t.current.pa}</td><td className={(t.current.pf-t.current.pa)>=0?'positive':'negative'}>{t.current.pf-t.current.pa>=0?'+':''}{t.current.pf-t.current.pa}</td><td>{getTeamStrength(u,t.id)}</td></tr>)}</tbody></table></Panel>}
  {tab==='Games'&&<GamesTable u={u} league={league} openTeam={openTeam}/>} 
  {tab==='Stats'&&<StatsTable u={u} players={players} openPlayer={openPlayer}/>} 
  {tab==='Teams'&&<div className="team-grid">{teams.map(t=><button className="team-card" key={t.id} style={{'--accent':t.primary}} onClick={()=>openTeam(t.id)}><TeamMark team={t} size={44}/><span><b>{t.name}</b><small>{isCollege?t.conference:`${t.current.wins}-${t.current.losses} · ${getTeamStrength(u,t.id)} STR`}</small></span>{isCollege&&<em>{t.prestige} PRESTIGE</em>}</button>)}</div>}
  {tab==='History'&&<LeagueHistory u={u} league={league} openTeam={openTeam} openPlayer={openPlayer}/>} 
  {tab==='Prospects'&&<Prospects u={u} openPlayer={openPlayer}/>}</div>
}

function GamesTable({u,league,openTeam}){
  const games=u.currentGames.filter(g=>g.league===league).slice().sort((a,b)=>b.round-a.round).slice(0,80);
  return <Panel title="Current-season games" eyebrow="GAME DETAIL RETAINED UNTIL NEXT YEAR"><table><thead><tr><th>Stage</th><th>Round</th><th>Away</th><th>Score</th><th>Home</th><th>Yards</th></tr></thead><tbody>{games.map(g=>{const h=findTeam(u,g.homeId),a=findTeam(u,g.awayId);return <tr key={g.id}><td>{g.stage}</td><td>{g.round}</td><td onClick={()=>openTeam(a.id)}><b>{a.name}</b></td><td><b>{g.awayScore}–{g.homeScore}</b></td><td onClick={()=>openTeam(h.id)}><b>{h.name}</b></td><td>{g.awayBox.passYards+g.awayBox.rushYards}–{g.homeBox.passYards+g.homeBox.rushYards}</td></tr>})}{!games.length&&<tr><td colSpan="6"><Empty>No games yet. Simulate Year 1.</Empty></td></tr>}</tbody></table></Panel>
}

function LeagueHistory({u,league,openTeam,openPlayer}){
  const rows=u.seasonHistory.map(y=>({year:y.year,championId:league==='NFL'?y.nflChampionId:league==='UFL'?y.uflChampionId:y.collegeChampionId,mvpId:league==='NFL'?y.nflMvpId:league==='UFL'?y.uflMvpId:y.heismanId}));
  return <Panel title="Competition history" eyebrow="PERMANENT YEARBOOK"><table><thead><tr><th>Year</th><th>Champion</th><th>{league==='COLLEGE'?'Heisman':'MVP'}</th></tr></thead><tbody>{rows.map(r=><tr key={r.year}><td>Year {r.year}</td><td onClick={()=>r.championId&&openTeam(r.championId)}><b>{findTeam(u,r.championId)?.name||'—'}</b></td><td onClick={()=>r.mvpId&&openPlayer(r.mvpId)}><b>{findPlayer(u,r.mvpId)?.name||'—'}</b></td></tr>)}{!rows.length&&<tr><td colSpan="3"><Empty>No completed seasons yet.</Empty></td></tr>}</tbody></table></Panel>
}

function StatsTable({u,players,openPlayer}){
  const [category,setCategory]=useState('Passing');
  const sorted=[...players].sort((a,b)=>{const s=x=>x.stats.seasons.at(-1)||{};return category==='Passing'?(s(b).passYards||0)-(s(a).passYards||0):category==='Rushing'?(s(b).rushYards||0)-(s(a).rushYards||0):category==='Receiving'?(s(b).recYards||0)-(s(a).recYards||0):category==='Sacks'?(s(b).sacks||0)-(s(a).sacks||0):(s(b).tackles||0)-(s(a).tackles||0)}).slice(0,30);
  return <Panel title={`${category} leaders`} eyebrow="STATISTICS" action={<Segmented value={category} onChange={setCategory} items={['Passing','Rushing','Receiving','Sacks','Tackles']}/>}><table><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Pos</th><th>{category}</th><th>TD / INT</th></tr></thead><tbody>{sorted.map((p,i)=>{const s=p.stats.seasons.at(-1)||{};const value=category==='Passing'?s.passYards:category==='Rushing'?s.rushYards:category==='Receiving'?s.recYards:category==='Sacks'?s.sacks:s.tackles;return <tr key={p.id} onClick={()=>openPlayer(p.id)}><td>{i+1}</td><td><b>{p.name}</b></td><td>{findTeam(u,p.teamId)?.name||'—'}</td><td>{p.position}</td><td>{num(value||0)}</td><td>{category==='Passing'?`${s.passTD||0} / ${s.interceptions||0}`:`${(s.rushTD||0)+(s.recTD||0)} TD`}</td></tr>})}</tbody></table></Panel>
}

function Prospects({u,openPlayer}){
  const prospects=u.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&!p.revealed).sort((a,b)=>(b.scouting?.expectedTier||0)-(a.scouting?.expectedTier||0)).slice(0,80);
  return <Panel title="Draft radar" eyebrow="TRUE TALENT SEALED"><table><thead><tr><th>#</th><th>Prospect</th><th>School</th><th>Class</th><th>Public range</th><th>Probability band</th></tr></thead><tbody>{prospects.map((p,i)=><tr key={p.id} onClick={()=>openPlayer(p.id)}><td>{i+1}</td><td><div><b>{p.name}</b><small className="block">{p.position}</small></div></td><td>{findTeam(u,p.teamId)?.name}</td><td>{['','FR','SO','JR','SR'][p.collegeYear]}</td><td>{p.scouting?.label}</td><td className="prob-cell"><ProbabilityStrip probs={p.scouting?.probs}/></td></tr>)}</tbody></table></Panel>
}

function PlayersPage({u,openPlayer}){
  const [q,setQ]=useState('');const [league,setLeague]=useState('NFL');const [pos,setPos]=useState('ALL');
  let list=u.players.filter(p=>!p.retired&&(league==='ALL'||p.league===league)&&(pos==='ALL'||p.position===pos)&&(!q||p.name.toLowerCase().includes(q.toLowerCase())));
  list=list.sort((a,b)=>league==='COLLEGE'&&!a.revealed&&!b.revealed?(b.scouting?.expectedTier||0)-(a.scouting?.expectedTier||0):b.overall-a.overall).slice(0,150);
  return <div className="page"><div className="page-title"><div><div className="eyebrow">DATABASE</div><h1>Players</h1><p>Search the living universe. College truth stays sealed until draft night.</p></div></div><div className="filters"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search player…"/><Segmented value={league} onChange={setLeague} items={['NFL','COLLEGE','UFL','ALL']}/><select value={pos} onChange={e=>setPos(e.target.value)}><option>ALL</option>{['QB','HB','WR','TE','OT','EDGE','DT','LB','CB','S','K','P'].map(x=><option key={x}>{x}</option>)}</select></div>
  <Panel title={`${list.length} players`} eyebrow="VISIBLE DATABASE"><table><thead><tr><th>Player</th><th>Pos</th><th>Team</th><th>Age</th><th>Talent view</th><th>Latest</th></tr></thead><tbody>{list.map(p=><tr key={p.id} onClick={()=>openPlayer(p.id)}><td><b>{p.name}</b></td><td>{p.position}</td><td>{findTeam(u,p.teamId)?.name||'Free Agent'}</td><td>{p.age}</td><td>{p.revealed?<RarityPill rarity={p.trueRarity} compact/>:<span className="scout-inline">{p.scouting?.label}</span>}</td><td>{p.stats.seasons.length?statLine(p):'No completed season'}</td></tr>)}</tbody></table></Panel></div>
}

function Market({u,openPlayer,openTeam}){
  const [tab,setTab]=useState('Cap');
  const nfl=[...u.teams.nfl].sort((a,b)=>(b.capLimit-b.capUsed)-(a.capLimit-a.capUsed));
  const expiring=u.players.filter(p=>!p.retired&&p.league==='NFL'&&p.contract?.years===1).sort((a,b)=>b.overall-a.overall).slice(0,80);
  const free=u.players.filter(p=>!p.retired&&!p.teamId&&p.league!=='COLLEGE').sort((a,b)=>b.overall-a.overall).slice(0,80);
  const prospects=u.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&!p.revealed&&p.collegeYear>=3).sort((a,b)=>(b.scouting?.expectedTier||0)-(a.scouting?.expectedTier||0)).slice(0,80);
  const likelyRetire=u.players.filter(p=>!p.retired&&p.league!=='COLLEGE'&&(p.proYear||0)>=p.careerYears-1).sort((a,b)=>b.overall-a.overall).slice(0,80);
  const freshmen=u.players.filter(p=>!p.retired&&p.league==='COLLEGE'&&p.collegeYear===1&&!p.stats.seasons.length).sort((a,b)=>(b.scouting?.expectedTier||0)-(a.scouting?.expectedTier||0)).slice(0,80);
  const moves=u.news.filter(n=>['BLOCKBUSTER','FREE AGENCY','RENEWAL','RETIREMENT','COACHING'].includes(n.type)).slice(0,100);
  return <div className="page"><div className="page-title"><div><div className="eyebrow">ROSTER ECONOMY</div><h1>Market</h1><p>Cap room, contract pressure, draft supply and movement across the football ecosystem.</p></div><Segmented value={tab} onChange={setTab} items={['Cap','Contracts','Transactions','Draft Board','Retiring','New Class']}/></div>
  {tab==='Cap'&&<Panel title="Salary cap" eyebrow="NFL · TRACKED ROSTER CAP"><table><thead><tr><th>Team</th><th>Limit</th><th>Used</th><th>Room</th><th>Load</th></tr></thead><tbody>{nfl.map(t=>{const pct=t.capUsed/t.capLimit;return <tr key={t.id} onClick={()=>openTeam(t.id)}><td><div className="team-cell"><TeamMark team={t} size={26}/><b>{t.name}</b></div></td><td>{money(t.capLimit)}</td><td>{money(t.capUsed)}</td><td>{money(t.capLimit-t.capUsed)}</td><td><div className="capbar"><span style={{width:`${Math.min(100,pct*100)}%`}}/></div></td></tr>})}</tbody></table></Panel>}
  {tab==='Contracts'&&<div className="two-col"><Panel title="Final contract year" eyebrow="NFL"><div className="scroll-list">{expiring.map(p=><button className="player-row" key={p.id} onClick={()=>openPlayer(p.id)}><span className="pos">{p.position}</span><span><b>{p.name}</b><small>{findTeam(u,p.teamId)?.name} · {money(p.contract.annual)}</small></span><RarityPill rarity={p.trueRarity} compact/></button>)}</div></Panel><Panel title="Unattached players" eyebrow="FREE AGENTS"><div className="scroll-list">{free.map(p=><button className="player-row" key={p.id} onClick={()=>openPlayer(p.id)}><span className="pos">{p.position}</span><span><b>{p.name}</b><small>{p.age} years old</small></span><RarityPill rarity={p.trueRarity} compact/></button>)}{!free.length&&<Empty>No tracked free agents right now.</Empty>}</div></Panel></div>}
  {tab==='Transactions'&&<Panel title="Recent market activity" eyebrow="TRADES · SIGNINGS · STAFF"><div className="news-stack">{moves.map(n=><button className="news-item" key={n.id} onClick={()=>n.playerId?openPlayer(n.playerId):n.teamId?openTeam(n.teamId):null}><span className={`news-type ${n.importance>=85?'hot':''}`}>{n.type}</span><div><b>{n.title}</b><p>{n.body}</p></div><time>Y{n.year}</time></button>)}{!moves.length&&<Empty>No market events yet.</Empty>}</div></Panel>}
  {tab==='Draft Board'&&<Panel title="Next draft radar" eyebrow="PUBLIC INFORMATION ONLY"><table><thead><tr><th>#</th><th>Prospect</th><th>School</th><th>Class</th><th>Public range</th><th>Probability</th></tr></thead><tbody>{prospects.map((p,i)=><tr key={p.id} onClick={()=>openPlayer(p.id)}><td>{i+1}</td><td><b>{p.name}</b> · {p.position}</td><td>{findTeam(u,p.teamId)?.name}</td><td>{['','FR','SO','JR','SR'][p.collegeYear]}</td><td>{p.scouting?.label}</td><td className="prob-cell"><ProbabilityStrip probs={p.scouting?.probs}/></td></tr>)}</tbody></table></Panel>}
  {tab==='Retiring'&&<Panel title="Career-end watch" eyebrow="GOD VIEW · LIKELY FINAL PRO YEAR"><table><thead><tr><th>Player</th><th>Team</th><th>Pos</th><th>Tier</th><th>Pro Year</th><th>Scripted Career</th></tr></thead><tbody>{likelyRetire.map(p=><tr key={p.id} onClick={()=>openPlayer(p.id)}><td><b>{p.name}</b></td><td>{findTeam(u,p.teamId)?.name||'—'}</td><td>{p.position}</td><td><RarityPill rarity={p.trueRarity} compact/></td><td>{p.proYear}</td><td>{p.careerYears}</td></tr>)}</tbody></table></Panel>}
  {tab==='New Class'&&<Panel title="New Year 1 college players" eyebrow="THE ONLY ENTRY POINT FOR NEW PLAYERS"><table><thead><tr><th>Player</th><th>Position</th><th>Program</th><th>Public range</th><th>Probability band</th></tr></thead><tbody>{freshmen.map(p=><tr key={p.id} onClick={()=>openPlayer(p.id)}><td><b>{p.name}</b></td><td>{p.position}</td><td>{findTeam(u,p.teamId)?.name}</td><td>{p.scouting?.label}</td><td className="prob-cell"><ProbabilityStrip probs={p.scouting?.probs}/></td></tr>)}{!freshmen.length&&<tr><td colSpan="5"><Empty>The first new class appears after Year 1.</Empty></td></tr>}</tbody></table></Panel>}</div>
}

function Draft({u,openPlayer,openTeam}){
  const reveals=u.lastDraftReveal||[];
  return <div className="page"><div className="page-title draft-title"><div><div className="eyebrow">GOD VIEW · POST-DRAFT TRUTH</div><h1>Draft Reveal</h1><p>The teams saw the probability band. You now see what they actually bought—including the future career script the AI still cannot see.</p></div><div className="reveal-legend"><span>PUBLIC SCOUTING</span><i>→</i><span>TRUE RARITY</span><i>→</i><span>CAREER ARC</span></div></div>
  {!reveals.length?<Panel title="No draft completed" eyebrow="YEAR 1"><Empty>Simulate the first season. The draft reveal will appear here immediately afterward.</Empty></Panel>:<Panel title={`Year ${reveals[0].year} NFL Draft`} eyebrow={`${reveals.length} PICKS REVEALED`}><div className="draft-list">{reveals.map(r=>{const p=findPlayer(u,r.playerId),team=findTeam(u,r.teamId),college=findTeam(u,r.collegeId);const delta=RARITIES.indexOf(r.actualRarity)-(r.scouting?.expectedTier||0);return <button key={r.playerId} className={`draft-row ${delta>1.15?'steal':delta<-.9?'bust':''}`} onClick={()=>openPlayer(r.playerId)}><strong className="pick">{r.pick}</strong><TeamMark team={team} size={34}/><div className="draft-name"><b>{p?.name}</b><small>{p?.position} · {college?.name}</small></div><div className="draft-scout"><span>{r.scouting?.label}</span><ProbabilityStrip probs={r.scouting?.probs}/></div><div className="truth"><RarityPill rarity={r.actualRarity}/><b>{r.developmentPath}</b><small>{r.careerYears} pro years scripted</small></div><em>{delta>1.15?'STEAL':delta<-.9?'BAD READ':'FAIR READ'}</em></button>})}</div></Panel>}</div>
}

function ESPN({u,openPlayer,openTeam}){return <div className="page"><div className="page-title"><div><div className="eyebrow">CHRONICLE WIRE</div><h1>ESPN</h1><p>The universe narrates itself: championships, awards, trades, draft shocks, coaching changes and records.</p></div></div><div className="news-grid">{u.news.map(n=><button className={`story ${n.importance>=90?'lead':''}`} key={n.id} onClick={()=>n.playerId?openPlayer(n.playerId):n.teamId?openTeam(n.teamId):null}><span>{n.type} · YEAR {n.year}</span><h3>{n.title}</h3><p>{n.body}</p><b>{n.importance>=90?'TOP STORY':'READ STORY'} ›</b></button>)}</div></div>}

function Records({u,openPlayer,openTeam}){
  const [league,setLeague]=useState('NFL'),[cat,setCat]=useState('Passing Yards');const cats=['Passing Yards','Rushing Yards','Receiving Yards','Sacks','Team Points','Team Yards'];
  const rows=u.records.filter(r=>r.league===league&&r.category===cat).sort((a,b)=>b.value-a.value);
  return <div className="page"><div className="page-title"><div><div className="eyebrow">ALMANAC</div><h1>Records</h1><p>Game details are disposable. Historical greatness is not.</p></div><Segmented value={league} onChange={setLeague} items={['NFL','COLLEGE','UFL']}/></div><Panel title={cat} eyebrow={`TOP 10 · ${league}`} action={<select value={cat} onChange={e=>setCat(e.target.value)}>{cats.map(x=><option key={x}>{x}</option>)}</select>}><table><thead><tr><th>#</th><th>Holder</th><th>Value</th><th>Year</th><th>Stage</th><th>Round</th></tr></thead><tbody>{rows.map((r,i)=>{const p=r.playerId?findPlayer(u,r.playerId):null,t=findTeam(u,r.teamId);return <tr key={`${r.gameId}-${i}`} onClick={()=>p?openPlayer(p.id):t&&openTeam(t.id)}><td>{i+1}</td><td><b>{p?.name||t?.name||'Unknown'}</b></td><td>{num(r.value)}</td><td>Year {r.year}</td><td>{r.stage}</td><td>{r.round}</td></tr>})}{!rows.length&&<tr><td colSpan="6"><Empty>Simulate a season to establish the first records.</Empty></td></tr>}</tbody></table></Panel></div>
}

function Universe({u,setU}){
  const counts=rarityCounts(u.players); const target={Generational:3,Legend:'10–15',Epic:'~20',Rare:'~50',Uncommon:'~80'};
  return <div className="page"><div className="page-title"><div><div className="eyebrow">HISTORY ENGINE</div><h1>Universe</h1><p>Seeded, deterministic world state with a compact historical layer.</p></div></div><div className="rarity-board">{['Generational','Legend','Epic','Rare','Uncommon'].map(r=><div key={r}><RarityPill rarity={r}/><b>{counts[r]}</b><small>target {target[r]}</small></div>)}</div>
  <div className="two-col"><Panel title="Yearbook" eyebrow="CHAMPIONS & MVPs"><div className="yearbook">{u.seasonHistory.map(y=><div className="year-row" key={y.year}><strong>YEAR {y.year}</strong><span>NFL <b>{findTeam(u,y.nflChampionId)?.name}</b></span><span>College <b>{findTeam(u,y.collegeChampionId)?.name}</b></span><span>MVP <b>{findPlayer(u,y.nflMvpId)?.name}</b></span></div>)}{!u.seasonHistory.length&&<Empty>The yearbook is blank. That is about to change.</Empty>}</div></Panel><Panel title="Simulation invariants" eyebrow="BALANCE RULES"><ul className="invariants"><li><b>College-only spawning.</b> New players enter as Year 1 college players—never as unexplained 25-year-old professionals.</li><li><b>Hidden prospect truth.</b> True rarity, career path and career length remain sealed until draft resolution.</li><li><b>Elite employment floor.</b> Uncommon+ talent receives UFL fallback; Epic+ free agents trigger aggressive NFL cap-space behavior.</li><li><b>Anti-dynasty pressure.</b> Cap churn, contract expiry, staff poaching and repeat-award fatigue reduce permanent monopolies without hard scripting champions.</li><li><b>Stats first.</b> Passing/rushing/turnovers/sacks generate scoring, not the other way around.</li></ul></Panel></div><SaveHub universe={u} setUniverse={setU}/></div>
}

function TeamDrawer({u,id,onClose,openPlayer}){
  const team=findTeam(u,id); if(!team)return null; const roster=getRoster(u,id).sort((a,b)=>b.overall-a.overall); const isCollege=team.league==='COLLEGE';
  return <div className="drawer-shell" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className="drawer"><button className="close" onClick={onClose}>×</button><div className="team-hero" style={{'--accent':team.primary}}><TeamMark team={team} size={62}/><div><div className="eyebrow">{team.league} TEAM</div><h2>{team.name}</h2><p>{isCollege?team.conference:`${team.conference||''} ${team.division||''}`}</p></div></div><div className="drawer-metrics"><Metric label="Record" value={`${team.current.wins}-${team.current.losses}`}/><Metric label="Strength" value={getTeamStrength(u,id)}/><Metric label="Titles" value={team.history.championships}/>{!isCollege&&<Metric label="Cap room" value={money(team.capLimit-team.capUsed)}/>}</div>
  <h4>Staff</h4><div className="staff-grid">{[['GM',team.gm],['HC',team.hc],['OC',team.oc],['DC',team.dc]].filter(([,s])=>s).map(([role,s])=><div key={role}><span>{role}</span><b>{s.name}</b><small>{s.style} · {s.overall}</small><RarityPill rarity={s.rarity} compact/></div>)}</div>
  <h4>{isCollege?'Featured players':'Roster'}</h4><div className="drawer-list">{roster.map(p=><button key={p.id} onClick={()=>openPlayer(p.id)}><span className="pos">{p.position}</span><span><b>{p.name}</b><small>{isCollege&&!p.revealed?p.scouting?.label:`OVR ${p.overall} · age ${p.age}`}</small></span>{p.revealed?<RarityPill rarity={p.trueRarity} compact/>:<span className="mystery-tag">?</span>}</button>)}</div></aside></div>
}

function PlayerDrawer({u,id,onClose}){
  const p=findPlayer(u,id); if(!p)return null; const team=findTeam(u,p.teamId),college=findTeam(u,p.collegeId); const hidden=p.league==='COLLEGE'&&!p.revealed;
  return <div className="drawer-shell" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className="drawer player-drawer"><button className="close" onClick={onClose}>×</button><div className="player-hero"><div className="player-avatar">{p.position}</div><div><div className="eyebrow">{hidden?'COLLEGE PROSPECT · SEALED TRUTH':`${p.league} · ${p.position}`}</div><h2>{p.name}</h2><p>{team?.name||'Free Agent'}{college&&team?.id!==college.id?` · ${college.name}`:''}</p></div></div>
  {hidden?<><div className="sealed"><span>PUBLIC SCOUTING RANGE</span><h3>{p.scouting?.label}</h3><ProbabilityStrip probs={p.scouting?.probs}/><div className="prob-legend">{Object.entries(p.scouting?.probs||{}).map(([r,v])=><span key={r}><i style={{background:`var(--${r.toLowerCase()})`}}/>{r} {v}%</span>)}</div><p>True rarity, pro career length and development path are sealed until this player is drafted. The simulation AI sees the same uncertainty you do.</p></div><div className="drawer-metrics"><Metric label="Class" value={['','Freshman','Sophomore','Junior','Senior'][p.collegeYear]}/><Metric label="Age" value={p.age}/><Metric label="Position" value={p.position}/></div></>:<><div className="drawer-metrics"><Metric label="True tier" value={p.trueRarity}/><Metric label="OVR" value={p.overall}/><Metric label="Peak" value={p.peakOverall}/><Metric label="Career script" value={`${p.careerYears} yrs`}/></div><div className="truth-card"><RarityPill rarity={p.trueRarity}/><div><span>GOD VIEW CAREER ARC</span><h3>{p.developmentPath}</h3><p>This future path is visible to you only. Teams react to current ability and results, not the scripted future decline/peak.</p></div></div></>}
  <h4>Career</h4>{p.stats.seasons.length?<table className="mini-table"><thead><tr><th>Year</th><th>League</th><th>Team</th><th>Production</th></tr></thead><tbody>{p.stats.seasons.slice().reverse().map(s=><tr key={`${s.year}-${s.teamId}`}><td>{s.year}</td><td>{s.league}</td><td>{findTeam(u,s.teamId)?.id||s.teamId}</td><td>{p.position==='QB'?`${num(s.passYards)} PY / ${s.passTD} TD`:['WR','TE'].includes(p.position)?`${num(s.recYards)} REC / ${s.recTD} TD`:['HB','FB'].includes(p.position)?`${num(s.rushYards)} RUSH / ${s.rushTD} TD`:`${s.tackles||0} TKL / ${s.sacks||0} SCK`}</td></tr>)}</tbody></table>:<Empty>No completed season yet.</Empty>}
  {!!p.awards.length&&<><h4>Awards</h4><div className="award-list">{p.awards.slice().reverse().map((a,i)=><span key={i}><b>{a.name}</b> · Year {a.year}</span>)}</div></>}</aside></div>
}

export default function App(){
  const [u,setU]=useState(()=>{const raw=localStorage.getItem('afwc-autosave');if(raw){try{return JSON.parse(raw)}catch{}}return createUniverse('Gridiron-1')});
  const [nav,setNav]=useState('Home'),[teamId,setTeamId]=useState(null),[playerId,setPlayerId]=useState(null),[simulating,setSimulating]=useState(false);
  useEffect(()=>{localStorage.setItem('afwc-autosave',JSON.stringify(u));},[u]);
  const run=()=>{setSimulating(true);requestAnimationFrame(()=>setTimeout(()=>{try{setU(prev=>simulateYear(prev));setNav('Home');}finally{setSimulating(false)}},40));};
  const openTeam=id=>{setPlayerId(null);setTeamId(id)};const openPlayer=id=>{setTeamId(null);setPlayerId(id)};
  return <div className="app"><Header universe={u} onSim={run} simulating={simulating}/><nav className="main-nav">{NAV.map(n=><button className={nav===n?'active':''} onClick={()=>setNav(n)} key={n}>{n}</button>)}</nav><main>
    {nav==='Home'&&<Home u={u} openTeam={openTeam} openPlayer={openPlayer}/>} {nav==='NFL'&&<LeaguePage u={u} league="NFL" openTeam={openTeam} openPlayer={openPlayer}/>} {nav==='College'&&<LeaguePage u={u} league="COLLEGE" openTeam={openTeam} openPlayer={openPlayer}/>} {nav==='UFL'&&<LeaguePage u={u} league="UFL" openTeam={openTeam} openPlayer={openPlayer}/>} {nav==='Players'&&<PlayersPage u={u} openPlayer={openPlayer}/>} {nav==='Market'&&<Market u={u} openPlayer={openPlayer} openTeam={openTeam}/>} {nav==='Draft'&&<Draft u={u} openPlayer={openPlayer} openTeam={openTeam}/>} {nav==='ESPN'&&<ESPN u={u} openPlayer={openPlayer} openTeam={openTeam}/>} {nav==='Records'&&<Records u={u} openPlayer={openPlayer} openTeam={openTeam}/>} {nav==='Universe'&&<Universe u={u} setU={setU}/>} 
  </main>{teamId&&<TeamDrawer u={u} id={teamId} onClose={()=>setTeamId(null)} openPlayer={openPlayer}/>} {playerId&&<PlayerDrawer u={u} id={playerId} onClose={()=>setPlayerId(null)}/>} {simulating&&<div className="sim-overlay"><div className="sim-loader"><span/><b>SIMULATING YEAR {u.year}</b><small>~900 games · awards · contracts · draft · development</small></div></div>}</div>
}
