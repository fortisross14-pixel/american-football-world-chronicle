// Main-thread client for the simulation worker, with a synchronous fallback.
import { simulateWeeks, simulateToPostseason, simulateToSeasonEnd, beginOffseason, advanceOffseasonStage, startNextSeason } from './sim/season.js';

const SYNC={week:u=>simulateWeeks(u,1),four:u=>simulateWeeks(u,4),toPostseason:simulateToPostseason,toSeasonEnd:simulateToSeasonEnd,offseason:beginOffseason,stage:advanceOffseasonStage,next:startNextSeason};
let worker=null,broken=false,seq=0;const pending=new Map();
function getWorker(){
  if(broken||typeof Worker==='undefined')return null;
  if(worker)return worker;
  try{
    worker=new Worker(new URL('./sim/worker.js',import.meta.url),{type:'module'});
    worker.onmessage=e=>{const {id,ok,universe,error}=e.data||{};const p=pending.get(id);if(!p)return;pending.delete(id);ok?p.resolve(universe):p.reject(new Error(error));};
    worker.onerror=err=>{console.warn('Simulation worker failed; falling back to main thread',err);broken=true;for(const [,p] of pending)p.fallback();pending.clear();try{worker.terminate()}catch{}worker=null;};
    return worker;
  }catch(err){console.warn('Simulation worker unavailable',err);broken=true;return null;}
}
export function runSimulation(mode,universe){
  const sync=()=>SYNC[mode](universe);
  const w=getWorker();
  if(!w)return Promise.resolve().then(sync);
  return new Promise((resolve,reject)=>{
    const id=++seq;
    pending.set(id,{resolve,reject:err=>{console.warn('Worker simulation error; retrying on main thread',err);try{resolve(sync())}catch(e){reject(e)}},fallback:()=>{try{resolve(sync())}catch(e){reject(e)}}});
    try{w.postMessage({id,mode,universe});}catch(err){pending.delete(id);broken=true;try{resolve(sync())}catch(e){reject(e)}}
  });
}
