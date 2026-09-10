const DB_NAME='afwc-world-chronicle';
const DB_VERSION=1;
const STORE='universeSaves';

function openDb(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB unavailable'));return;}
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Could not open save database'));
  });
}

async function withStore(mode,fn){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let value;try{value=fn(store,resolve,reject);}catch(err){reject(err);return;}tx.onerror=()=>reject(tx.error||new Error('Save transaction failed'));if(value!==undefined)resolve(value);});}finally{db.close();}
}

export async function saveUniverse(key,universe,label=''){
  const record={key,label:label||key,updatedAt:Date.now(),year:universe?.year||1,phase:universe?.phase||'Unknown',week:universe?.seasonState?.week||0,postseasonRound:universe?.postseasonState?.roundIndex||0,offseasonStage:universe?.offseasonState?.stageIndex??null,seedText:universe?.seedText||'',data:universe};
  try{await withStore('readwrite',(store,resolve,reject)=>{const r=store.put(record);r.onsuccess=()=>resolve(true);r.onerror=()=>reject(r.error);});return true;}catch(err){
    console.warn('IndexedDB save failed',err);
    try{const compact=JSON.stringify(record);localStorage.setItem(`afwc-fallback-${key}`,compact);return true;}catch(fallbackErr){console.warn('Fallback save failed',fallbackErr);return false;}
  }
}

export async function loadUniverse(key){
  try{return await withStore('readonly',(store,resolve,reject)=>{const r=store.get(key);r.onsuccess=()=>resolve(r.result?.data||null);r.onerror=()=>reject(r.error);});}catch(err){
    console.warn('IndexedDB load failed',err);
    try{const raw=localStorage.getItem(`afwc-fallback-${key}`);return raw?JSON.parse(raw).data:null;}catch{return null;}
  }
}

export async function saveMeta(key){
  try{return await withStore('readonly',(store,resolve,reject)=>{const r=store.get(key);r.onsuccess=()=>{const x=r.result;resolve(x?{key:x.key,label:x.label,updatedAt:x.updatedAt,year:x.year,phase:x.phase,week:x.week||0,postseasonRound:x.postseasonRound||0,offseasonStage:x.offseasonStage??null,seedText:x.seedText}:null)};r.onerror=()=>reject(r.error);});}catch{
    try{const raw=localStorage.getItem(`afwc-fallback-${key}`);if(!raw)return null;const x=JSON.parse(raw);return{key:x.key,label:x.label,updatedAt:x.updatedAt,year:x.year,phase:x.phase,week:x.week||0,postseasonRound:x.postseasonRound||0,offseasonStage:x.offseasonStage??null,seedText:x.seedText};}catch{return null;}
  }
}

export async function deleteUniverse(key){
  try{await withStore('readwrite',(store,resolve,reject)=>{const r=store.delete(key);r.onsuccess=()=>resolve(true);r.onerror=()=>reject(r.error);});}catch{}
  try{localStorage.removeItem(`afwc-fallback-${key}`);}catch{}
}
