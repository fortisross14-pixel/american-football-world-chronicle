import { NFL_TEAMS, UFL_TEAMS } from '../data/teams.js';
import { COLLEGES } from '../data/colleges.js';
import { FIRST_NAMES, LAST_NAMES, STAFF_FIRST, STAFF_LAST } from '../data/names.js';
import { makeRng, hashSeed } from './rng.js';

export const RARITIES = ['Common','Uncommon','Rare','Epic','Legend','Generational'];
export const RARITY_META = {
  Common:{score:58,color:'#E5E7EB'}, Uncommon:{score:66,color:'#3DDC84'}, Rare:{score:75,color:'#4EA1FF'},
  Epic:{score:84,color:'#B96CFF'}, Legend:{score:92,color:'#F3C94D'}, Generational:{score:98,color:'#FF334F'}
};
export const POSITIONS = ['QB','HB','FB','WR','TE','OT','OG','C','EDGE','DT','LB','CB','S','K','P'];
export const NFL_ROSTER = ['QB','QB','HB','HB','FB','WR','WR','WR','TE','OT','OT','OG','OG','C','EDGE','EDGE','DT','DT','LB','LB','CB','CB','S','K','P'];
export const UFL_ROSTER = ['QB','HB','WR','WR','TE','OT','OG','C','EDGE','DT','LB','LB','CB','S','K','P','WR','CB'];

const PATHS = {
  'Early Meteor': {desc:'Explodes early, peaks fast, then declines sharply.', peak:2, rise:1.5, decline:2.3, years:[7,10]},
  'Sustainable Prime': {desc:'Steady climb into a long, reliable prime.', peak:5, rise:1.0, decline:0.9, years:[10,14]},
  'Late Bloomer': {desc:'Needs patience; best football arrives unusually late.', peak:7, rise:0.65, decline:0.8, years:[10,14]},
  'Iron Career': {desc:'Small annual swings and unusual longevity.', peak:6, rise:0.7, decline:0.45, years:[12,14]},
  'Volatile Star': {desc:'Huge peaks and frustrating dips.', peak:4, rise:1.0, decline:1.2, years:[8,12]},
  'Short Fuse': {desc:'NFL-ready immediately but likely to fade or leave early.', peak:2, rise:1.2, decline:2.6, years:[7,9]},
  'Classic Arc': {desc:'Normal development, prime and decline.', peak:5, rise:0.9, decline:1.25, years:[9,12]},
  'Slow Burn': {desc:'Modest start, long growth curve, late stability.', peak:7, rise:0.55, decline:0.7, years:[11,14]}
};
export const DEVELOPMENT_PATHS = PATHS;

const collegePosWeights = [['QB',12],['WR',16],['HB',10],['TE',5],['OT',8],['OG',5],['C',3],['EDGE',9],['DT',6],['LB',8],['CB',10],['S',6],['K',1],['P',1]];

function uniqueName(rng, used, staff=false){
  const a=staff?STAFF_FIRST:FIRST_NAMES, b=staff?STAFF_LAST:LAST_NAMES;
  for(let tries=0;tries<20;tries++){
    const name=`${rng.pick(a)} ${rng.pick(b)}`;
    if(!used.has(name)){ used.add(name); return name; }
  }
  const name=`${rng.pick(a)} ${rng.pick(b)} ${rng.int(2,99)}`; used.add(name); return name;
}

function positionRarityWeight(pos, rarity){
  if(rarity==='Generational') return ({QB:12,WR:5.5,HB:4.5,CB:2.2,EDGE:2,TE:1.1,LB:.8,S:.7,OT:.5,DT:.35,OG:.12,C:.08,K:.02,P:.02,FB:.05})[pos]||.2;
  if(rarity==='Legend') return ({QB:7,WR:4,HB:3.2,CB:2.4,EDGE:2.4,TE:1.5,LB:1.4,S:1.2,OT:1,DT:.9,OG:.6,C:.5,K:.25,P:.2,FB:.3})[pos]||1;
  if(rarity==='Epic') return ({QB:3.2,WR:2.3,HB:2,CB:1.9,EDGE:1.9,TE:1.4,LB:1.5,S:1.4,OT:1.2,DT:1.1,OG:.8,C:.7,K:.4,P:.35,FB:.4})[pos]||1;
  return 1;
}

function assignRarityTargets(slots,rng){
  const targets = {Generational:3, Legend:12, Epic:20, Rare:50, Uncommon:80};
  const available = new Set(slots.map((_,i)=>i));
  const assigned = Array(slots.length).fill('Common');
  for(const rarity of ['Generational','Legend','Epic','Rare','Uncommon']){
    for(let n=0;n<targets[rarity];n++){
      const choices=[];
      let total=0;
      for(const i of available){
        const s=slots[i];
        let w=positionRarityWeight(s.position,rarity);
        if(rarity!=='Uncommon'){
          w*=s.league==='NFL'?4.5:s.league==='COLLEGE'?2.6:.45;
          if(s.league==='COLLEGE') w*=0.15+Math.pow((s.programPrestige||70)/100,6)*4.2;
        }
        total+=w; choices.push([i,total]);
      }
      let roll=rng()*total, pick=choices[choices.length-1][0];
      for(const [i,cum] of choices){ if(roll<=cum){pick=i;break;} }
      assigned[pick]=rarity; available.delete(pick);
    }
  }
  return assigned;
}

function choosePath(rng, rarity){
  let options=Object.keys(PATHS).map(x=>[x,1]);
  if(rarity==='Generational') options=options.map(([x,w])=>[x,w*(['Sustainable Prime','Iron Career','Slow Burn'].includes(x)?2.2:1)]);
  if(rarity==='Legend') options=options.map(([x,w])=>[x,w*(['Sustainable Prime','Classic Arc','Late Bloomer'].includes(x)?1.7:1)]);
  return rng.weighted(options);
}

function buildScoutDistribution(rng,trueRarity, prestige=70, position='QB'){
  const t=RARITIES.indexOf(trueRarity);
  // Public scouting is correlated with truth, but deliberately noisy enough to create major misses.
  const scoutNoise = rng.normal(0, 1.05) + (prestige-75)/110;
  const center=Math.max(0,Math.min(5,t+scoutNoise));
  const sigma = rng.range(.72,1.18);
  const raw=RARITIES.map((r,i)=>Math.exp(-Math.pow(i-center,2)/(2*sigma*sigma)) * (i===5 && !['QB','WR','HB','CB','EDGE'].includes(position)?.35:1));
  const total=raw.reduce((a,b)=>a+b,0);
  let vals=raw.map(v=>Math.round(v/total*100));
  let diff=100-vals.reduce((a,b)=>a+b,0);
  while(diff!==0){
    const idx=diff>0?vals.indexOf(Math.max(...vals)):vals.indexOf(Math.max(...vals));
    vals[idx]+=diff>0?1:-1; diff+=diff>0?-1:1;
  }
  const probs={}; RARITIES.forEach((r,i)=>{ if(vals[i]>0) probs[r]=vals[i]; });
  const expected=vals.reduce((s,v,i)=>s+v*i,0)/100;
  const label = expected>=4.45?'Legend / Generational':expected>=3.45?'Epic / Legend':expected>=2.45?'Rare / Epic':expected>=1.45?'Uncommon / Rare':'Common / Uncommon';
  return { probs, label, expectedTier:expected };
}

export function createPlayer(slot, rarity, rng, usedNames, id){
  const base=RARITY_META[rarity].score + Math.round(rng.normal(0,2.7));
  const path=choosePath(rng,rarity); const p=PATHS[path];
  const careerYears=rng.int(p.years[0],p.years[1]);
  const isCollege=slot.league==='COLLEGE';
  const collegeYear=isCollege?slot.collegeYear:null;
  const proYear=isCollege?0:rng.int(1,Math.min(8,careerYears));
  const age=isCollege?17+collegeYear:21+proYear+rng.int(0,2);
  const collegeId=isCollege?slot.teamId:rng.bool(.87)?rng.pick(COLLEGES).id:null;
  const current = Math.max(45,Math.min(99,base + (isCollege?-rng.int(3,10):rng.int(-3,3))));
  const salaryBase={QB:2.5,WR:1.6,HB:1.0,TE:1.0,OT:1.35,OG:.9,C:.86,EDGE:1.5,DT:1.15,LB:1.05,CB:1.4,S:1.0,K:.38,P:.32,FB:.4}[slot.position]||.85;
  const valueFactor={Common:.35,Uncommon:.55,Rare:.9,Epic:1.5,Legend:2.2,Generational:3}[rarity];
  const contractYears=isCollege?0:rng.int(1,Math.min(5,Math.max(1,careerYears-proYear)));
  return {
    id:`P${id}`, name:uniqueName(rng,usedNames), position:slot.position, league:slot.league, teamId:slot.teamId,
    collegeId, collegeYear, proYear, age, trueRarity:rarity, revealed:!isCollege,
    scouting:isCollege?buildScoutDistribution(rng,rarity,slot.programPrestige,slot.position):null,
    developmentPath:path, careerYears, retired:false, drafted:false, draftYear:null, draftRound:null, draftPick:null,
    overall:current, peakOverall:current, potential:Math.max(current,Math.min(99,base+rng.int(1,7))),
    stats:{career:{},seasons:[]}, awards:[], championships:0, mvpWins:0,
    contract:isCollege?null:{years:contractYears, annual:Math.round(6.0*salaryBase*valueFactor*rng.range(.8,1.25)*10)/10},
    personality:rng.pick(['Loyal','Ambitious','Quiet','Competitive','Mercurial','Team-first','Confident','Pragmatic']),
    traits:[], publicDraftGrade:null
  };
}

export function staffMember(rng, usedNames, role, teamId){
  const rarity=rng.weighted([['Common',50],['Uncommon',27],['Rare',14],['Epic',6],['Legend',2.6],['Generational',.4]]);
  const score=RARITY_META[rarity].score+rng.int(-4,4);
  return {id:`S-${teamId}-${role}`,name:uniqueName(rng,usedNames,true),role,teamId,rarity,age:rng.int(35,67),overall:Math.max(45,Math.min(99,score)),
    yearsCareer:rng.int(1,18),careerLength:rng.int(8,25),style: role==='OC'?rng.pick(['West Coast','Vertical','Spread','Power Run','Balanced','Air Raid']):role==='DC'?rng.pick(['Zone','Man Coverage','Blitz Heavy','Run Stop','Turnover Hunting','Balanced']):role==='HC'?rng.pick(['Offensive Guru','Defensive Mastermind','Players Coach','Tactical','Development Specialist']):rng.pick(['Aggressive','Patient','Analytical','Traditionalist']),
    ratings:{negotiation:rng.int(45,95),development:rng.int(45,95),offense:rng.int(45,95),defense:rng.int(45,95),leadership:rng.int(45,95)}};
}

function initialSlots(rng){
  const slots=[];
  NFL_TEAMS.forEach(t=>NFL_ROSTER.forEach(position=>slots.push({league:'NFL',teamId:t.id,position})));
  UFL_TEAMS.forEach(t=>UFL_ROSTER.forEach(position=>slots.push({league:'UFL',teamId:t.id,position})));
  COLLEGES.forEach(program=>{
    const count=rng.bool(.5)?5:6;
    const years=rng.shuffle([1,2,3,4, rng.int(1,4), rng.int(1,4)]).slice(0,count);
    years.forEach(collegeYear=>slots.push({league:'COLLEGE',teamId:program.id,position:rng.weighted(collegePosWeights),collegeYear,programPrestige:program.prestige}));
  });
  return slots;
}

function initTeams(rng, staffNames){
  const nfl=NFL_TEAMS.map(t=>{ const owner=staffMember(rng,staffNames,'OWNER',t.id); return ({ ...t, popularity:rng.int(68,98), prestige:rng.int(62,96), capLimit:Math.round(126+(owner.overall-60)*.38), capUsed:0, owner, gm:staffMember(rng,staffNames,'GM',t.id), hc:staffMember(rng,staffNames,'HC',t.id), oc:staffMember(rng,staffNames,'OC',t.id), dc:staffMember(rng,staffNames,'DC',t.id), history:{championships:0,playoffs:0,seasons:[]}, current:{wins:0,losses:0,pf:0,pa:0,yards:0}, draftPicks:[1,2,3], dynastyPressure:0 }); });
  const ufl=UFL_TEAMS.map(t=>({ ...t, popularity:rng.int(42,74), prestige:rng.int(40,68), capLimit:38, capUsed:0, owner:staffMember(rng,staffNames,'OWNER',t.id), gm:staffMember(rng,staffNames,'GM',t.id), hc:staffMember(rng,staffNames,'HC',t.id), oc:staffMember(rng,staffNames,'OC',t.id), dc:staffMember(rng,staffNames,'DC',t.id), history:{championships:0,playoffs:0,seasons:[]}, current:{wins:0,losses:0,pf:0,pa:0,yards:0}, dynastyPressure:0 }));
  const college=COLLEGES.map(p=>({ ...p, hc:staffMember(rng,staffNames,'HC',p.id), oc:staffMember(rng,staffNames,'OC',p.id), dc:staffMember(rng,staffNames,'DC',p.id), history:{championships:0,playoffs:0,heismans:0,seasons:[]}, current:{wins:0,losses:0,pf:0,pa:0,yards:0} }));
  return {nfl,ufl,college};
}

export function createUniverse(seedText='Gridiron-1'){
  const seed=typeof seedText==='number'?seedText:hashSeed(seedText); const rng=makeRng(seed);
  const usedPlayers=new Set(), staffNames=new Set();
  const teams=initTeams(rng,staffNames);
  const slots=initialSlots(rng); const rarities=assignRarityTargets(slots,rng);
  const players=slots.map((slot,i)=>createPlayer(slot,rarities[i],rng,usedPlayers,i+1));
  // Cap accounting and sensible initial contracts.
  teams.nfl.forEach(t=>{ const roster=players.filter(p=>p.teamId===t.id); t.capUsed=Math.round(roster.reduce((s,p)=>s+(p.contract?.annual||0),0)*10)/10; });
  teams.ufl.forEach(t=>{ const roster=players.filter(p=>p.teamId===t.id); t.capUsed=Math.round(roster.reduce((s,p)=>s+Math.min(2,p.contract?.annual||.4),0)*10)/10; });
  const universe={version:'0.1.0',seed,seedText:String(seedText),year:1,phase:'Preseason',rngState:rng.state(),teams,players,freeAgents:[],transactions:[],news:[],records:[],draftHistory:[],seasonHistory:[],currentGames:[],lastDraftReveal:[],settings:{godView:true},meta:{nextPlayerId:players.length+1,nextNewsId:1}};
  universe.news.push({id:'N0',year:1,type:'UNIVERSE',importance:100,title:'A new football universe begins',body:`Year 1 opens with ${teams.nfl.length} NFL teams, ${teams.ufl.length} UFL teams and ${teams.college.length} college programs.`,teamId:null,playerId:null});
  return universe;
}

export function prospectPublicView(player){
  if(player.league!=='COLLEGE' || player.revealed) return player;
  const {trueRarity,developmentPath,careerYears,potential,...publicPlayer}=player;
  return {...publicPlayer,trueRarity:null,developmentPath:null,careerYears:null,potential:null};
}

export function rarityCounts(players){
  return RARITIES.reduce((acc,r)=>({...acc,[r]:players.filter(p=>!p.retired&&p.trueRarity===r).length}),{});
}
