"use client";
import {ArrowUpRight} from 'lucide-react';
import {streamerPage,normalizeSourceVideo} from '@/lib/stream-links.mjs';
export default function StreamerLink({clip}:{clip:any}){const url=streamerPage(clip);return url?<a className="button outline streamer-link" href={url} target="_blank" rel="noopener noreferrer">Stream page <ArrowUpRight size={15}/></a>:null;}
export function FullVideoLink({clip}:{clip:any}){let url;try{url=normalizeSourceVideo(clip.sourceVideoUrl,clip.provider||'kick');}catch{return null;}return url?<a className="button lime full-video-link" onClick={()=>{if(clip.id)void fetch("/api/fans",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"event",kind:"full_video_open",item:clip.id}),keepalive:true}).then(r=>{if(r.ok)window.dispatchEvent(new Event("faze-pulse"));}).catch(()=>{});}} href={url} target="_blank" rel="noopener noreferrer">Watch the full story <ArrowUpRight size={15}/></a>:null;}
