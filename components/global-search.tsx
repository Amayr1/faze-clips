"use client";
import {useState,useRef,useEffect} from 'react';
import {Search,LoaderCircle,ArrowUpRight,X} from 'lucide-react';
import {collectCreatorClips} from '@/lib/collect-creator-clips.mjs';
import type {SocialClip} from './reel-social';
type Props={sort:string;time:string;onResults:(clips:SocialClip[],q:string,fresh:boolean)=>void;onBusy:(busy:boolean)=>void};
export default function GlobalSearch({sort,time,onResults,onBusy}:Props){
 const[q,setQ]=useState(''),[busy,setBusy]=useState(false),[data,setData]=useState<any>(null),[error,setError]=useState(''),[progress,setProgress]=useState({clips:0,pages:0});
 const controller=useRef<AbortController|null>(null),callback=useRef(onResults),busyCallback=useRef(onBusy);
 callback.current=onResults;busyCallback.current=onBusy;
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function search(query:string){
  controller.current?.abort();const c=new AbortController();controller.current=c;
  setData(null);setError('');setProgress({clips:0,pages:0});setBusy(true);busyCallback.current(true);
  callback.current([],query,true);
  try{
   const collection=await collectCreatorClips({
    signal:c.signal,onProgress:p=>{if(!c.signal.aborted)setProgress(p);},
    loadPage:async(cursor,signal)=>{
     // Collect the same all-time source inventory regardless of the selected display sort.
     const params=new URLSearchParams({q:query,sort:'view',time:'all'});
     if(cursor)params.set('cursor',cursor);
     const r=await fetch('/api/search?'+params,{signal}),d=await r.json() as any;
     if(!r.ok)throw Error(d.error||'Search is unavailable.');
     return d;
    }
   });
   if(c.signal.aborted)return;
   setData({...collection,query});
   // A failed source must not produce a partial ranking labeled as the full collection.
   if(collection.complete)callback.current(collection.clips,query,false);
   else setError('Collection is incomplete because a source could not return all its pages. Retry to collect the full results before ranking.');
  }catch(err){if(!c.signal.aborted)setError(err instanceof Error?err.message:'Search failed.');}
  finally{if(!c.signal.aborted){setBusy(false);busyCallback.current(false);}}
 }
 function clear(){controller.current?.abort();setBusy(false);busyCallback.current(false);setQ('');setData(null);setError('');setProgress({clips:0,pages:0});callback.current([],'',true);}
 return <div className="global-search">
  <form onSubmit={e=>{e.preventDefault();if(q.trim().length>=2)void search(q.trim());}}>
   <Search size={20}/><input id="creator-search-input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search a creator, @username, or clip…" aria-label="Search any streamer or clip" minLength={2} maxLength={100}/>
   <button className="button lime" disabled={busy} type="submit">{busy?<LoaderCircle size={15} className="spin"/>:'Search'}</button>
   {(data||busy||error)&&<button className="icon-button" type="button" aria-label={busy?'Cancel creator search':'Clear discovery search'} onClick={clear}><X size={17}/></button>}
  </form>
  <p>Collect every available creator clip first. Then sort the complete collection by views, FaZe likes or date.</p>
  {busy&&<p role="status">Collecting all available pages… {progress.clips.toLocaleString()} clips found across {progress.pages.toLocaleString()} pages. Results will be ranked when collection finishes.</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  {data&&<div className="global-search-results" aria-live="polite">
   <strong>{data.complete?'Collection complete':'Collection incomplete'} · {data.clips.length.toLocaleString()} clips for “{data.query}”</strong>
   {data.complete&&<p>All pages from available sources collected. {sort==='view'?'Most source views first.':sort==='date'?'Newest first.':sort==='top'?'Most FaZe likes first.':sort==='hot'?'Ranked by FaZe engagement and recency.':'Personalized from your activity.'} {time!=='all'?'The selected time range filters this complete collection.':''}</p>}
   <p>{data.coverage}</p>
   <p>{data.sources?.map((s:any)=>s.provider.charAt(0).toUpperCase()+s.provider.slice(1)+' / '+s.channel+': '+s.status.replaceAll('-',' ')).join(' · ')}</p>
   {data.errors?.map((message:string)=><p key={message}>{message}</p>)}
   {!data.complete&&<button className="button outline" disabled={busy} onClick={()=>void search(data.query)}>Retry full collection</button>}
   <div className="search-engine-links">
    <a href={'https://www.google.com/search?q='+encodeURIComponent(data.query+' streamer clips')} target="_blank" rel="noreferrer">Search the web <ArrowUpRight size={12}/></a>
    <a href={'https://www.youtube.com/results?search_query='+encodeURIComponent(data.query+' clips')} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={12}/></a>
    <a href={'https://www.twitch.tv/search?term='+encodeURIComponent(data.query)} target="_blank" rel="noreferrer">Twitch <ArrowUpRight size={12}/></a>
   </div>
   {data.links?.length>0&&<details><summary>More source results</summary>{data.links.map((x:any)=><a className="web-result" key={x.url} href={x.url} target="_blank" rel="noreferrer"><strong>{x.title}</strong><span>{x.description}</span></a>)}</details>}
  </div>}
 </div>;
}
