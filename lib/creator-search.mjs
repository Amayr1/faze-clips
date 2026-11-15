const SORTS=new Set(['view','date','top','hot','for-you']),TIMES=new Set(['all','day','week','month']);
export const identity=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function creatorNames(query,catalog=[]){
  let q=query.trim().replace(/^@/,'');
  try{const url=new URL(q);if(['kick.com','www.kick.com','twitch.tv','www.twitch.tv','youtube.com','www.youtube.com'].includes(url.hostname))q=url.pathname.split('/').find(Boolean)?.replace(/^@/,'')||q;}catch{}
  const stripped=q.replace(/\s+(?:top\s+|best\s+)?clips?$/i,'');
  const norm=identity(stripped),names=new Set();
  for(const clip of catalog)if(identity(clip.channel)===norm||identity(clip.channelName)===norm)names.add(clip.channel);
  const aliases={speed:'ishowspeed',ronaldo:'stableronaldo',fazeronaldo:'stableronaldo'};
  if(aliases[norm])names.add(aliases[norm]);
  if(!names.size){const slug=stripped.toLowerCase().replace(/\s+/g,'');if(/^[a-z0-9][a-z0-9_-]{0,29}$/.test(slug))names.add(slug);}
  return [...names].filter(n=>/^[a-z0-9][a-z0-9_-]{0,29}$/.test(n)).slice(0,3);
}
export function searchOptions(params){
  const query=(params.get('q')||'').trim(),sort=params.get('sort')||'view',time=params.get('time')||'all';
  if(query.length<2||query.length>100)throw Error('Search with 2–100 characters.');
  if(!SORTS.has(sort)||!TIMES.has(time))throw Error('Choose a valid search sort and time range.');
  return {query,sort,time};
}
export function dedupeSearchClips(clips){
  const unique=new Map();
  for(const clip of clips){
    const previous=unique.get(clip.id);
    if(!previous){unique.set(clip.id,clip);continue;}
    // Imported metadata often has unknown source counts. It must not erase API totals.
    unique.set(clip.id,{...previous,...clip,views:Math.max(Number(previous.views)||0,Number(clip.views)||0),createdAt:clip.createdAt||previous.createdAt});
  }
  return [...unique.values()];
}
export function mergeSearchClips(clips,sort='view',now=Date.now()){
  const unique=dedupeSearchClips(clips);
  const count=(c,key)=>Math.max(0,Number(c[key])||0);
  const date=c=>Date.parse(c.createdAt)||0;
  const score=c=>sort==='date'?date(c):sort==='top'?count(c,'likes'):sort==='hot'?(count(c,'likes')+Math.log1p(count(c,'externalLikes'))*.15)/Math.pow(2+Math.max(0,(now-(c.addedAt||date(c)||now))/3600000),1.25):count(c,'views');
  return unique.sort((a,b)=>score(b)-score(a)||count(b,'views')-count(a,'views')||date(b)-date(a)||a.id.localeCompare(b.id));
}
export function decodeSearchCursor(value,options){
  if(!value)return null;
  try{
    if(value.length>24000)throw Error();
    const c=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0))));
    if(c.v!==1||c.q!==options.query.toLowerCase()||c.sort!==options.sort||c.time!==options.time||!Array.isArray(c.sources)||c.sources.length>6||!Number.isSafeInteger(c.offset)||c.offset<0||(c.creatorOnly!==undefined&&typeof c.creatorOnly!=='boolean'))throw Error();
    for(const s of c.sources)if(!['kick','twitch'].includes(s.provider)||!/^[a-z0-9][a-z0-9_-]{0,29}$/.test(s.channel)||typeof s.cursor!=='string'||s.cursor.length>2048)throw Error();
    return c;
  }catch{throw Error('This search page expired. Start the search again.');}
}
export function encodeSearchCursor(options,sources,offset,creatorOnly){
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({v:1,q:options.query.toLowerCase(),sort:options.sort,time:options.time,sources,offset,...(creatorOnly===undefined?{}:{creatorOnly})}))));
}
