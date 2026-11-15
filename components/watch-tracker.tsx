"use client";
import {useEffect,useRef} from 'react';

// Count actual native playback only. Embedded players do not expose watch time.
export default function WatchTracker({clip}:{clip:any}){
 const marker=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  let seconds=0,last:number|null=null,completion=false,completionSent=false,disposed=false;
  const read=()=>{
   const video=marker.current?.closest('[role="dialog"]')?.querySelector('video');
   if(!video||document.hidden||video.paused||video.seeking||video.readyState<2){last=null;return;}
   if(last!==null){const delta=video.currentTime-last;if(delta>0&&delta<3)seconds+=delta;}
   last=video.currentTime;
   if(Number.isFinite(video.duration)&&video.duration>0&&video.currentTime/video.duration>.9)completion=true;
  };
  const flush=()=>{
   const amount=Math.floor(seconds);
   if(amount<1)return;
   const completed=completion&&!completionSent;
   seconds-=amount;if(completed)completionSent=true;
   void fetch('/api/recommendations',{
    method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
    body:JSON.stringify({clip,seconds:amount,completed}),
   }).then(response=>{
    if(!response.ok)throw Error('Watch progress was not saved.');
    window.dispatchEvent(new Event('faze-history-updated'));
   }).catch(()=>{if(!disposed){seconds+=amount;if(completed)completionSent=false;}});
  };
  const hidden=()=>{if(document.hidden){flush();last=null;}};
  const sample=setInterval(read,1000),save=setInterval(flush,15000);
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('pagehide',flush);
  return()=>{
   clearInterval(sample);clearInterval(save);
   document.removeEventListener('visibilitychange',hidden);
   window.removeEventListener('pagehide',flush);
   flush();disposed=true;
  };
 },[clip.id]);
 return <span hidden ref={marker}/>;
}
