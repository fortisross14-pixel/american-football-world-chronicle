// Simulation worker (v1.0): runs the heavy universe transitions off the main thread so the
// interface stays responsive while a season, a postseason or an offseason stage is simulated.
import { simulateWeeks, simulateToPostseason, simulateToSeasonEnd, beginOffseason, advanceOffseasonStage, startNextSeason, skipNextTopLevelClone } from './season.js';

const MODES={
  week:u=>simulateWeeks(u,1),
  four:u=>simulateWeeks(u,4),
  toPostseason:u=>simulateToPostseason(u),
  toSeasonEnd:u=>simulateToSeasonEnd(u),
  offseason:u=>beginOffseason(u),
  stage:u=>advanceOffseasonStage(u),
  next:u=>startNextSeason(u)
};
self.onmessage=e=>{
  const {id,mode,universe}=e.data||{};
  try{
    const fn=MODES[mode];if(!fn)throw new Error(`Unknown simulation mode ${mode}`);
    skipNextTopLevelClone();
    const out=fn(universe);
    self.postMessage({id,ok:true,universe:out});
  }catch(err){self.postMessage({id,ok:false,error:String(err&&err.stack||err)});}
};
