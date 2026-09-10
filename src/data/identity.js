import { ELITE_FACE_ASSETS, BASE_FACE_ASSETS } from './faceAssets.js';
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

function simpleHash(text){let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
export function faceBodyType(position){return THICK_POSITIONS.has(position)?'thick':NORMAL_POSITIONS.has(position)?'normal':'fit';}
export function isVisibleElite(player){return !!player&&ELITE_RARITIES.has(player.trueRarity)&&(player.league!=='COLLEGE'||player.revealed||player.drafted);}
function pickBase(player){return BASE_FACE_ASSETS[simpleHash(`${player.id}|${player.name}|base`)%BASE_FACE_ASSETS.length];}
function validElite(path,cat){return !!path&&ELITE_FACE_ASSETS[cat].includes(path);}

// Assign a persistent raster portrait to every player. Elite players use the position/body pool
// and avoid simultaneous duplicate portraits whenever the pool has room. Hidden college prospects
// deliberately use a base portrait so artwork cannot reveal their sealed rarity before the draft.
export function assignUniverseFaceAssets(players=[]){
  const activeUsed={normal:new Set(),fit:new Set(),thick:new Set()},preserved=new Set();
  const visibleElite=players.filter(p=>isVisibleElite(p)&&!p.retired).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
  // Preserve already-assigned active faces first so a player's identity never changes unnecessarily.
  for(const p of visibleElite){const cat=faceBodyType(p.position);if(validElite(p.eliteFaceAsset,cat)&&!activeUsed[cat].has(p.eliteFaceAsset)){activeUsed[cat].add(p.eliteFaceAsset);preserved.add(p.id);p.faceAsset=p.eliteFaceAsset;p.faceAssetTier='elite';p.faceBodyType=cat;}}
  for(const p of visibleElite){const cat=faceBodyType(p.position);if(preserved.has(p.id))continue;const pool=ELITE_FACE_ASSETS[cat],start=simpleHash(`${p.id}|${p.name}|${cat}`)%pool.length;let chosen=null;for(let i=0;i<pool.length;i++){const path=pool[(start+i)%pool.length];if(!activeUsed[cat].has(path)){chosen=path;break;}}chosen=chosen||pool[start];p.eliteFaceAsset=chosen;p.faceAsset=chosen;p.faceAssetTier='elite';p.faceBodyType=cat;activeUsed[cat].add(chosen);}
  for(const p of players){
    if(isVisibleElite(p)){if(!p.retired)continue;const cat=faceBodyType(p.position);if(!validElite(p.eliteFaceAsset,cat)){const pool=ELITE_FACE_ASSETS[cat];p.eliteFaceAsset=pool[simpleHash(`${p.id}|${p.name}|retired|${cat}`)%pool.length];}p.faceAsset=p.eliteFaceAsset;p.faceAssetTier='elite';p.faceBodyType=cat;continue;}
    if(!p.baseFaceAsset||!BASE_FACE_ASSETS.includes(p.baseFaceAsset))p.baseFaceAsset=pickBase(p);
    p.faceAsset=p.baseFaceAsset;p.faceAssetTier='base';p.faceBodyType=faceBodyType(p.position);
  }
  return players;
}

export function initialFaceAssignment(player){
  if(!player)return null;
  player.baseFaceAsset=pickBase(player);
  player.faceAsset=player.baseFaceAsset;player.faceAssetTier='base';player.faceBodyType=faceBodyType(player.position);
  if(isVisibleElite(player)){const cat=faceBodyType(player.position),pool=ELITE_FACE_ASSETS[cat];player.eliteFaceAsset=pool[simpleHash(`${player.id}|${player.name}|${cat}`)%pool.length];player.faceAsset=player.eliteFaceAsset;player.faceAssetTier='elite';}
  return player;
}

export function inferIdentityProfile(name){
  const full=String(name||'');
  for(const [profile,p] of Object.entries(PROFILES)){if(p.last.some(x=>full.endsWith(` ${x}`))||p.first.some(x=>full.startsWith(`${x} `)))return profile;}
  return 'Mixed American';
}
export function ensurePlayerIdentity(player){
  if(!player)return player;
  if(!player.identityProfile)player.identityProfile=inferIdentityProfile(player.name);
  // Migrate procedural v0.7A profiles by keeping the player's name/background and assigning a raster asset.
  if(!player.faceAsset)initialFaceAssignment(player);
  return player;
}

export { PROFILES as PLAYER_IDENTITY_PROFILES };
