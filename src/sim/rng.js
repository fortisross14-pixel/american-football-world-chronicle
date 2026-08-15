export function makeRng(seed=123456789){
  let s = seed >>> 0;
  const next = () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (min,max)=>Math.floor(next()*(max-min+1))+min;
  next.pick = arr=>arr[Math.floor(next()*arr.length)];
  next.bool = p=>next()<p;
  next.range = (min,max)=>min+(max-min)*next();
  next.normal = (mean=0, sd=1)=>{
    const u=Math.max(next(),1e-9), v=Math.max(next(),1e-9);
    return mean + sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  };
  next.shuffle = arr=>{
    const a=[...arr];
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(next()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  };
  next.weighted = pairs=>{
    const total=pairs.reduce((s,[,w])=>s+w,0);
    let r=next()*total;
    for(const [value,w] of pairs){ r-=w; if(r<=0) return value; }
    return pairs[pairs.length-1][0];
  };
  next.state = ()=>s >>> 0;
  return next;
}

export function hashSeed(text='chronicle'){
  let h=2166136261;
  for(let i=0;i<text.length;i++){ h^=text.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
