// Curated raster face library. Generated assets are bundled under public/faces.
// Elite pools are position/body-archetype based; base faces are intentionally reusable.
// v0.72 adds appearance/style metadata so names and portraits can be aligned without
// making the match simulation depend on identity-generation choices.

const p3=n=>String(n).padStart(3,'0');
const paths=(folder,prefix,ids)=>ids.map(n=>`/faces/${folder}/${prefix}-${p3(n)}.png`);

const NORMAL_IDS=Array.from({length:59},(_,i)=>i+1); // normal-060 is intentionally excluded (bad crop)
const FIT_IDS=Array.from({length:85},(_,i)=>i+1).filter(n=>![30,72].includes(n)); // invalid UI crops excluded
const THICK_IDS=Array.from({length:68},(_,i)=>i+1);
const BASE_IDS=Array.from({length:24},(_,i)=>i+1);

export const ELITE_FACE_ASSETS={
  normal:paths('elite/normal','normal',NORMAL_IDS),
  fit:paths('elite/fit','fit',FIT_IDS),
  thick:paths('elite/thick','thick',THICK_IDS)
};
export const BASE_FACE_ASSETS=paths('base','base',BASE_IDS);

const META={};
const normalPath=n=>`/faces/elite/normal/normal-${p3(n)}.png`;
const fitPath=n=>`/faces/elite/fit/fit-${p3(n)}.png`;
const thickPath=n=>`/faces/elite/thick/thick-${p3(n)}.png`;
const basePath=n=>`/faces/base/base-${p3(n)}.png`;
function put(path,bodyType,appearanceGroups,extra={}){META[path]=Object.freeze({bodyType,appearanceGroups:Object.freeze([...appearanceGroups]),...extra});}
function tagIds(ids,pathFn,body,groups,extra={}){for(const id of ids)put(pathFn(id),body,groups,extra);}

// These are broad visual compatibility tags, not asserted ethnicity. They exist only so
// a clearly Latino-coded name does not routinely receive an obviously mismatched portrait,
// and likewise for strongly African-American / Anglo-coded names.
const normalBlack=[7,8,10,11,17,21,27,34,35,36,41,42,45,48,51,54,55,56,57];
const normalLatino=[20,37,40,44,47,50,53];
for(const id of NORMAL_IDS){
  if(normalBlack.includes(id))put(normalPath(id),'normal',['black','mixed']);
  else if(normalLatino.includes(id))put(normalPath(id),'normal',['latino','mixed','white']);
  else put(normalPath(id),'normal',['white','mixed']);
}

const fitBlack=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,33,39,49,50,53,54,57,58,60,65,66,67,68,70,75,76,79,83,85];
const fitLatino=[31,34,35,37,40,42,45,47,52,55,59,71,73,74,78,80,81,84];
for(const id of FIT_IDS){
  if(fitBlack.includes(id))put(fitPath(id),'fit',['black','mixed']);
  else if(fitLatino.includes(id))put(fitPath(id),'fit',['latino','mixed','white']);
  else put(fitPath(id),'fit',['white','mixed']);
}

const thickBlack=[1,3,5,6,7,8,10,11,12,14,15,18,21,22,23,24,29,30,31,32,35,37,40,41,43,44,50,51,59,60,63,64,67,68];
const thickLatino=[27,28,33,34,36,42,46,47,49,52,53,54,55,65];
const thickHeavy=new Set([...Array.from({length:23},(_,i)=>i+1),25,29,30,31,32,35,37,40,43,45,48,50,...Array.from({length:13},(_,i)=>56+i)]);
const thickBeard=new Set([1,2,3,7,8,9,12,13,14,15,16,17,18,19,20,21,22,23,25,30,31,32,35,40,43,45,48,56,57,58,59,60,61,62,63,64,65,67,68]);
const thickLongHair=new Set([5,10,11,29,31,34,61,65]);
const thickBald=new Set([20,23,25,38,39,50,58,60,62]);
for(const id of THICK_IDS){
  const groups=thickBlack.includes(id)?['black','mixed']:thickLatino.includes(id)?['latino','mixed','white']:['white','mixed'];
  const facialHair=thickBeard.has(id)?(id===57||id===58||id===62||id===68?'heavyBeard':'beard'):'none';
  const hair=thickLongHair.has(id)?'long':thickBald.has(id)?'bald':'short';
  put(thickPath(id),'thick',groups,{build:thickHeavy.has(id)?'heavy':'regular',facialHair,hair,vibe:thickHeavy.has(id)?'rugged':'classic'});
}

const baseBlack=[2,3,6,8,11,12,13,14,15,19,20,21,22,23,24];
const baseLatino=[4,5,9,16,17,18];
for(const id of BASE_IDS){
  if(baseBlack.includes(id))put(basePath(id),'base',['black','mixed']);
  else if(baseLatino.includes(id))put(basePath(id),'base',['latino','white','mixed']);
  else put(basePath(id),'base',['white','mixed']);
}

export const FACE_ASSET_META=Object.freeze(META);
export const faceAssetMeta=path=>FACE_ASSET_META[path]||null;

export const FACE_ASSET_COUNTS=Object.freeze({
  normal:ELITE_FACE_ASSETS.normal.length,
  fit:ELITE_FACE_ASSETS.fit.length,
  thick:ELITE_FACE_ASSETS.thick.length,
  elite:ELITE_FACE_ASSETS.normal.length+ELITE_FACE_ASSETS.fit.length+ELITE_FACE_ASSETS.thick.length,
  base:BASE_FACE_ASSETS.length
});
