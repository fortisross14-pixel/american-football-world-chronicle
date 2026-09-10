import { ELITE_FACE_ASSETS, BASE_FACE_ASSETS, faceAssetMeta } from './faceAssets.js';
const PROFILES = {
  'African American': {
    weight: 44,
    first: ['A.J.','Amari','Andre','Antoine','Bryce','Cam','Cameron','Darius','Darnell','DeAndre','DeShawn','Devin','Donovan','Elijah','Isaiah','Jabari','Jalen','Jamal','Javon','Jayden','Jaylen','Jordan','Kendrick','Khalil','Lamar','Malik','Marcus','Marshawn','Micah','Miles','Quentin','Rashad','Rome','Tariq','Terrence','Trevon','Tyrese','Xavier','Zaire','Zion','Keon','Keenan','Desmond','Dante','Myles','Troy'],
    last: ['Banks','Booker','Brooks','Brown','Bryant','Carter','Clay','Coleman','Davis','Fields','Foster','Freeman','Gaines','Green','Hall','Harris','Hawkins','Hayes','Hill','Jackson','Jefferson','Johnson','Jones','King','Lewis','Marshall','McCall','Mitchell','Moore','Morgan','Parker','Reed','Richardson','Robinson','Scott','Simmons','Smith','Taylor','Thomas','Turner','Walker','Ward','Washington','White','Williams','Wilson','Wright','Young'],
    skin: ['#4f2f25','#5a3628','#68402e','#754a34','#84563c','#936349','#6d4431'],
    hair: ['fade','short-curls','buzz','twists','braids','waves','shaved','high-top']
  },
  'Anglo American': {
    weight: 24,
    first: ['Aaron','Adam','Austin','Blake','Brady','Caleb','Carter','Chase','Cole','Colton','Connor','Cooper','Derek','Drew','Ethan','Evan','Garrett','Grant','Hunter','Jack','Jake','Jared','Logan','Luke','Mason','Nate','Noah','Owen','Parker','Preston','Ryan','Sam','Tanner','Thomas','Trent','Trevor','Tyler','Wesley','Wyatt','Zach','Bennett','Gavin','Landon'],
    last: ['Anderson','Baker','Bennett','Bishop','Bradford','Brady','Clark','Cooper','Dalton','Dawson','Edwards','Evans','Fisher','Foster','Gray','Griffin','Harper','Harrison','Henderson','Hughes','James','Kingston','Long','Manning','Miller','Montgomery','Nelson','Parker','Peterson','Phillips','Porter','Price','Reynolds','Roberts','Rogers','Russell','Sanders','Sutton','Thompson','Turner','Walker','Ward','Watson','White','Williams','Wilson','Wood'],
    skin: ['#e2b18d','#d89d78','#efc2a1','#c98b68','#f0c7a8','#d5a17f'],
    hair: ['crop','side-part','buzz','messy','crew','shaved','wavy','short-curls']
  },
  'Latino': {
    weight: 10,
    first: ['Adrian','Alejandro','Andres','Antonio','Carlos','Cristian','Diego','Emilio','Esteban','Gabriel','Hector','Isaac','Javier','Joaquin','Julian','Leo','Lorenzo','Luis','Marco','Mateo','Miguel','Nico','Rafael','Ramon','Santiago','Sebastian','Tomas','Victor','Xavier','Mateo','Dario','Enrique','Felix','Ivan'],
    last: ['Alvarez','Castillo','Cruz','Delgado','Diaz','Dominguez','Flores','Garcia','Gomez','Gonzalez','Gutierrez','Herrera','Jimenez','Lopez','Marquez','Martinez','Mendoza','Morales','Navarro','Ortega','Ortiz','Ramirez','Reyes','Rivera','Rodriguez','Rojas','Romero','Salazar','Sanchez','Santos','Serrano','Torres','Valdez','Vargas','Vega'],
    skin: ['#b97750','#c7865d','#a96c49','#d2966b','#8f5b42','#c27b54'],
    hair: ['fade','crop','side-part','buzz','wavy','short-curls','shaved']
  },
  'Italian American': {
    weight: 6,
    first: ['Anthony','Carlo','Dante','Dominic','Enzo','Fabio','Frankie','Gino','Luca','Marco','Matteo','Nico','Paolo','Rocco','Roman','Sal','Tony','Vincent','Vito','Leo','Gianni','Massimo'],
    last: ['Barone','Bianchi','Caruso','Conti','DeLuca','DeMarco','Esposito','Ferraro','Fontana','Gallo','Lombardi','Mancini','Marino','Moretti','Ricci','Rizzo','Romano','Russo','Santoro','Vitale','Bellini','Costa','D Angelo','Giordano'],
    skin: ['#d59a73','#c88963','#e1aa83','#b97957','#dba17d'],
    hair: ['side-part','wavy','crop','buzz','messy','short-curls']
  },
  'Irish American': {
    weight: 5,
    first: ['Aidan','Brendan','Brian','Cian','Colin','Connor','Declan','Finn','Jack','Kevin','Liam','Nolan','Patrick','Riley','Ronan','Sean','Shane','Brady','Kieran','Owen'],
    last: ['Brady','Brennan','Burke','Callahan','Casey','Collins','Connelly','Donovan','Doyle','Fitzgerald','Flynn','Gallagher','Kelly','Kennedy','McBride','McCarthy','McConnell','McDermott','McKenna','Murphy','O Brien','Quinn','Reilly','Sullivan','Walsh'],
    skin: ['#edc2a6','#dfab8d','#f3ccb2','#d99f83','#e8b79a'],
    hair: ['crop','side-part','buzz','messy','crew','wavy']
  },
  'German American': {
    weight: 5,
    first: ['Adam','Ben','Caleb','Derek','Eric','Evan','Grant','Henry','Jacob','Kurt','Luke','Mason','Noah','Ryan','Tyler','Wes','Zach','Cole','Trent','Logan'],
    last: ['Bauer','Becker','Fischer','Frank','Hartman','Hoffman','Keller','Klein','Kramer','Meyer','Miller','Mueller','Schmidt','Schneider','Schultz','Stein','Wagner','Weber','Werner','Zimmer','Krause','Koch','Brandt'],
    skin: ['#e8b997','#f0c7aa','#dba786','#ecc2a4','#d09a78'],
    hair: ['crop','crew','side-part','buzz','shaved','wavy']
  },
  'Mixed American': {
    weight: 6,
    first: ['Adrian','Ashton','Avery','Cameron','Christian','Dylan','Eli','Jordan','Kai','Micah','Miles','Nico','Noah','Roman','Sage','Theo','Tristan','Victor','Zane','Julian','Mason','Jalen','Luca'],
    last: ['Allen','Bailey','Bennett','Campbell','Clark','Coleman','Cooper','Diaz','Edwards','Garcia','Gray','Harris','Jackson','James','Lee','Lewis','Martin','Morris','Parker','Reed','Reyes','Ross','Sanchez','Scott','Taylor','Thomas','Walker','Ward','Young'],
    skin: ['#8b5b43','#a76e50','#c18460','#d6a07b','#77503e','#b57b58'],
    hair: ['fade','short-curls','wavy','crop','buzz','twists','shaved']
  }
};

function positionProfileWeights(position){
  const blackHeavy=['HB','WR','EDGE','CB','S','LB'];
  const whiteHeavy=['K','P','OT','OG','C','TE','QB'];
  return Object.entries(PROFILES).map(([name,p])=>{
    let w=p.weight;
    if(blackHeavy.includes(position)&&name==='African American')w*=1.38;
    if(whiteHeavy.includes(position)&&['Anglo American','Irish American','German American','Italian American'].includes(name))w*=1.18;
    if(['K','P'].includes(position)&&name==='African American')w*=.55;
    if(position==='QB'&&name==='African American')w*=.86;
    if(['QB','WR','CB'].includes(position)&&name==='Latino')w*=1.12;
    return[name,w];
  });
}

export function chooseIdentityProfile(rng,position){return rng.weighted(positionProfileWeights(position));}

function usageCount(used,index){const counts=new Map();for(const full of used){const bits=String(full).replace(/\s+\d+$/,'').split(' '),key=index===0?bits[0]:bits.slice(1).join(' ');counts.set(key,(counts.get(key)||0)+1);}return counts;}

export function generatePlayerIdentity(rng,used,position){
  const firstUse=usageCount(used,0),lastUse=usageCount(used,1),population=Math.max(1,used.size),firstCap=Math.max(9,Math.ceil(population/80)),lastCap=Math.max(8,Math.ceil(population/105));
  const weighted=positionProfileWeights(position),total=weighted.reduce((sum,[,w])=>sum+w,0);
  for(let tries=0;tries<120;tries++){
    // Deliberately use exactly two simulation RNG draws per attempt, matching the old
    // first-name + surname generator so identity depth does not perturb football balance.
    const r1=rng(),r2=rng();let cursor=r1*total,profile=weighted[weighted.length-1][0];
    for(const[name,w]of weighted){cursor-=w;if(cursor<=0){profile=name;break}}
    const p=PROFILES[profile];
    const first=p.first[Math.floor((((r1*997.123)%1)+1)%1*p.first.length)];
    const last=p.last[Math.floor(r2*p.last.length)];
    const full=`${first} ${last}`;
    if(used.has(full))continue;
    if((firstUse.get(first)||0)>=firstCap&&r1>.12)continue;
    if((lastUse.get(last)||0)>=lastCap&&r2>.08)continue;
    used.add(full);return{name:full,identityProfile:profile};
  }
  const profile=weighted[Math.floor(rng()*weighted.length)][0],p=PROFILES[profile];let suffix=2,full=`${p.first[Math.floor(rng()*p.first.length)]} ${p.last[Math.floor(rng()*p.last.length)]}`;while(used.has(full))full=`${p.first[Math.floor(rng()*p.first.length)]} ${p.last[Math.floor(rng()*p.last.length)]} ${suffix++}`;used.add(full);return{name:full,identityProfile:profile};
}


const NORMAL_POSITIONS=new Set(['QB','K','P']);
const THICK_POSITIONS=new Set(['OT','OG','C','DT']);
const ELITE_RARITIES=new Set(['Epic','Legend','Generational']);
export const FACE_IDENTITY_VERSION=2;

function simpleHash(text){let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
export function faceBodyType(position){return THICK_POSITIONS.has(position)?'thick':NORMAL_POSITIONS.has(position)?'normal':'fit';}
export function isVisibleElite(player){return !!player&&ELITE_RARITIES.has(player.trueRarity)&&(player.league!=='COLLEGE'||player.revealed||player.drafted);}
function validElite(path,cat){return !!path&&ELITE_FACE_ASSETS[cat].includes(path);}

const APPEARANCE_WEIGHTS={
  'African American':{black:100,mixed:72,latino:12,white:0},
  'Anglo American':{white:100,mixed:65,latino:22,black:0},
  'Irish American':{white:100,mixed:65,latino:18,black:0},
  'German American':{white:100,mixed:64,latino:18,black:0},
  'Italian American':{white:100,latino:82,mixed:68,black:0},
  'Latino':{latino:100,mixed:86,white:42,black:14},
  'Mixed American':{mixed:100,black:78,white:78,latino:78}
};
function appearanceFit(player,path){
  const meta=faceAssetMeta(path),weights=APPEARANCE_WEIGHTS[player.identityProfile]||APPEARANCE_WEIGHTS['Mixed American'];
  if(!meta)return 0;
  return Math.max(...(meta.appearanceGroups||['mixed']).map(g=>weights[g]??0));
}
function styleFit(player,path){
  const meta=faceAssetMeta(path);if(!meta)return 0;
  let score=0;
  // Linemen should look like linemen: broad/heavy faces and beard/rugged variation are favored,
  // while still leaving room for clean-shaven and younger-looking players.
  if(faceBodyType(player.position)==='thick'){
    if(meta.build==='heavy')score+=34;
    if(meta.facialHair==='beard')score+=9;
    if(meta.facialHair==='heavyBeard')score+=14;
    if(meta.hair==='long')score+=5;
  }
  return score;
}
function rankedCandidates(player,pool,salt='face'){
  return [...pool].sort((a,b)=>{
    const sa=appearanceFit(player,a)*20+styleFit(player,a)+(simpleHash(`${player.id}|${player.name}|${a}|${salt}`)%1000)/100;
    const sb=appearanceFit(player,b)*20+styleFit(player,b)+(simpleHash(`${player.id}|${player.name}|${b}|${salt}`)%1000)/100;
    return sb-sa;
  });
}
function pickBase(player){return rankedCandidates(player,BASE_FACE_ASSETS,'base')[0]||BASE_FACE_ASSETS[0];}
function pickElite(player,cat,used=new Set()){
  const ranked=rankedCandidates(player,ELITE_FACE_ASSETS[cat],cat);
  return ranked.find(path=>!used.has(path))||ranked[0]||ELITE_FACE_ASSETS[cat][0];
}
function stampFace(player,path,tier,cat){
  player.faceAsset=path;player.faceAssetTier=tier;player.faceBodyType=cat;player.faceIdentityVersion=FACE_IDENTITY_VERSION;
  const meta=faceAssetMeta(path);player.faceAppearanceGroups=meta?.appearanceGroups?[...meta.appearanceGroups]:['mixed'];
  return player;
}

// Assign a persistent raster portrait to every player. v0.72 aligns portraits to the
// player's name-background profile and position/body archetype. Active elite players avoid
// exact duplicate faces whenever the relevant body pool has room. Hidden college prospects
// deliberately keep base portraits so artwork cannot leak sealed rarity before the draft.
export function assignUniverseFaceAssets(players=[]){
  const activeUsed={normal:new Set(),fit:new Set(),thick:new Set()},preserved=new Set();
  const visibleElite=players.filter(p=>isVisibleElite(p)&&!p.retired).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
  // Preserve only portraits that were already assigned by the v0.72 identity-aware allocator.
  for(const p of visibleElite){
    const cat=faceBodyType(p.position),oldOkay=p.faceIdentityVersion===FACE_IDENTITY_VERSION&&validElite(p.eliteFaceAsset,cat);
    if(oldOkay&&!activeUsed[cat].has(p.eliteFaceAsset)){activeUsed[cat].add(p.eliteFaceAsset);preserved.add(p.id);stampFace(p,p.eliteFaceAsset,'elite',cat);}
  }
  for(const p of visibleElite){
    const cat=faceBodyType(p.position);if(preserved.has(p.id))continue;
    const chosen=pickElite(p,cat,activeUsed[cat]);p.eliteFaceAsset=chosen;activeUsed[cat].add(chosen);stampFace(p,chosen,'elite',cat);
  }
  for(const p of players){
    if(isVisibleElite(p)){
      if(!p.retired)continue;
      const cat=faceBodyType(p.position);
      if(p.faceIdentityVersion!==FACE_IDENTITY_VERSION||!validElite(p.eliteFaceAsset,cat))p.eliteFaceAsset=pickElite(p,cat,new Set());
      stampFace(p,p.eliteFaceAsset,'elite',cat);continue;
    }
    // Base portraits intentionally repeat; re-align once when migrating from v0.71.
    if(p.faceIdentityVersion!==FACE_IDENTITY_VERSION||!BASE_FACE_ASSETS.includes(p.baseFaceAsset))p.baseFaceAsset=pickBase(p);
    stampFace(p,p.baseFaceAsset,'base',faceBodyType(p.position));
  }
  return players;
}

export function initialFaceAssignment(player){
  if(!player)return null;
  player.baseFaceAsset=pickBase(player);stampFace(player,player.baseFaceAsset,'base',faceBodyType(player.position));
  if(isVisibleElite(player)){const cat=faceBodyType(player.position);player.eliteFaceAsset=pickElite(player,cat,new Set());stampFace(player,player.eliteFaceAsset,'elite',cat);}
  return player;
}

export function inferIdentityProfile(name){
  const full=String(name||'').trim(),bits=full.split(/\s+/),first=bits[0]||'',last=bits.slice(1).join(' ');
  let best='Mixed American',bestScore=-1;
  for(const [profile,p] of Object.entries(PROFILES)){
    let score=0;const firstHit=p.first.includes(first),lastHit=p.last.includes(last);
    if(firstHit)score+=6;if(lastHit)score+=4;if(firstHit&&lastHit)score+=3;
    // Distinctive heritage surnames should win ties over broad/common American surname pools.
    if(lastHit&&['Latino','Italian American','Irish American','German American'].includes(profile))score+=1;
    if(score>bestScore){best=profile;bestScore=score;}
  }
  return bestScore>0?best:'Mixed American';
}
export function ensurePlayerIdentity(player){
  if(!player)return player;
  if(!player.identityProfile)player.identityProfile=inferIdentityProfile(player.name);
  // assignUniverseFaceAssets performs the v0.71 -> v0.72 portrait-only migration so that
  // existing careers/names/results stay intact while portraits become identity-aligned.
  if(!player.faceAsset)initialFaceAssignment(player);
  return player;
}

export { PROFILES as PLAYER_IDENTITY_PROFILES };
