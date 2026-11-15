import {dedupeSearchClips} from './creator-search.mjs';

/** Fetch metadata until every continuation ends. No ranking is exposed mid-collection. */
export async function collectCreatorClips({loadPage,signal,onProgress=()=>{}}){
  const clips=new Map(),sources=new Map(),errors=new Set(),links=new Map(),tokens=new Set(),sourceCursors=new Set();
  let cursor=null,pages=0,webConnected=false,coverage='';
  const checkAbort=()=>{if(signal?.aborted)throw new DOMException('Collection cancelled.','AbortError');};
  do{
    checkAbort();
    const page=await loadPage(cursor,signal);
    checkAbort();pages++;
    for(const clip of page.clips||[]){const old=clips.get(clip.id);clips.set(clip.id,old?dedupeSearchClips([old,clip])[0]:clip);}
    for(const source of page.sources||[]){
      const key=source.provider+':'+source.channel,old=sources.get(key);
      const blocked=old&&['cached','unavailable','incomplete'].includes(old.status);
      sources.set(key,{...source,status:blocked?old.status:source.status,count:(old?.count||0)+(source.count||0),pages:(old?.pages||0)+1});
    }
    for(const error of page.errors||[])errors.add(error);
    for(const link of page.links||[])links.set(link.url,link);
    webConnected ||= !!page.webConnected;coverage=page.coverage||coverage;
    cursor=page.nextCursor||null;
    if(cursor){
      if(tokens.has(cursor))throw Error('A source repeated its page cursor. Collection is incomplete; retry the search.');
      tokens.add(cursor);
      // Our cursor also advances the catalog offset: detect upstream cycles independently.
      let state;try{state=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(cursor),c=>c.charCodeAt(0))));}catch{}
      for(const source of state?.sources||[]){
        const key=JSON.stringify([source.provider,source.channel,source.cursor]);
        if(sourceCursors.has(key))throw Error('A source stopped advancing its clip pages. Collection is incomplete; retry the search.');
        sourceCursors.add(key);
      }
    }
    onProgress({clips:clips.size,pages});
  }while(cursor);
  const allSources=[...sources.values()];
  return {clips:[...clips.values()],sources:allSources,links:[...links.values()],errors:[...errors],pages,webConnected,coverage,
    complete:!allSources.some(s=>['cached','unavailable','incomplete'].includes(s.status)),nextCursor:null};
}
