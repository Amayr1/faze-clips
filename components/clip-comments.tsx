"use client";
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {MessageCircle,RefreshCw,Send,Trash2,LoaderCircle} from 'lucide-react';
type Comment={id:string;author:string;body:string;createdAt:number;mine:boolean};
export default function ClipComments({clip}:{clip:any}){
 const [comments,setComments]=useState<Comment[]>([]),[total,setTotal]=useState(0),[cursor,setCursor]=useState<string|null>(null),[signedIn,setSignedIn]=useState<boolean|null>(null),[draft,setDraft]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const reader=useRef<AbortController|null>(null),field=useId(),clipId=clip.id;
 const load=useCallback(async(before?:string)=>{
  reader.current?.abort();const c=new AbortController();reader.current=c;setLoading(true);setError('');
  try{
   const p=new URLSearchParams({clipId});if(before)p.set('before',before);
   const r=await fetch('/api/comments?'+p,{signal:c.signal}),d=await r.json() as any;
   if(!r.ok)throw Error(d.error||'Could not load comments.');
   if(c.signal.aborted)return;
   setComments(old=>before?[...new Map([...old,...d.comments].map((x:Comment)=>[x.id,x])).values()]:d.comments);setTotal(d.total);setCursor(d.nextCursor);setSignedIn(d.signedIn);
  }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'Could not load comments.');}
  finally{if(!c.signal.aborted)setLoading(false);}
 },[clipId]);
 useEffect(()=>{void load();return()=>reader.current?.abort();},[load]);
 async function post(){
  setBusy(true);setError('');setStatus('');
  try{
   const r=await fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clip,body:draft})}),d=await r.json() as any;
   if(r.status===401)setSignedIn(false);if(!r.ok)throw Error(d.error||'Could not post comment.');
   setComments(old=>[d.comment,...old]);setTotal(n=>n+1);setDraft('');setStatus('Comment posted.');window.dispatchEvent(new Event('faze-pulse'));
  }catch(e){setError(e instanceof Error?e.message:'Could not post comment.');}finally{setBusy(false);}
 }
 async function remove(id:string){
  setBusy(true);setError('');setStatus('');
  try{
   const r=await fetch('/api/comments?id='+encodeURIComponent(id),{method:'DELETE'}),d=await r.json() as any;
   if(!r.ok)throw Error(d.error||'Could not delete comment.');
   setComments(old=>old.filter(c=>c.id!==id));setTotal(n=>Math.max(0,n-1));setStatus('Comment deleted.');window.dispatchEvent(new Event('faze-pulse'));
  }catch(e){setError(e instanceof Error?e.message:'Could not delete comment.');}finally{setBusy(false);}
 }
 return <section className="clip-comments" aria-label={'Comments on '+clip.title}>
  <div className="comments-heading"><h3><MessageCircle size={19}/> THE CHAT <span>{total}</span></h3><button className="text-button" disabled={busy||loading} onClick={()=>void load()} aria-label="Refresh comments"><RefreshCw size={13}/> Refresh</button></div>
  {signedIn===true&&<form onSubmit={e=>{e.preventDefault();void post();}}><label htmlFor={field}>Add to the conversation</label><textarea id={field} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="That moment deserves a reaction…" rows={3} maxLength={1000} required disabled={busy} aria-describedby={field+'-count'}/><div className="comment-form-actions"><small id={field+'-count'}>{draft.length}/1,000</small><button className="button lime" disabled={busy||loading||!draft.trim()} type="submit">{busy?<LoaderCircle className="spin" size={14}/>:<Send size={14}/>} Post comment</button></div></form>}
  {signedIn===false&&<p className="comment-signin"><a href={'/signin-with-chatgpt?return_to='+encodeURIComponent(clip.provider==='upload'?'/#clip='+clipId.slice(7):'/#feed')} target="_top">Sign in to join the conversation ↗</a></p>}
  {error&&<p className="form-error" role="alert">{error}</p>}{status&&<p className="comment-status" role="status">{status}</p>}
  {loading&&<p className="comments-loading" role="status"><LoaderCircle size={14} className="spin"/> Loading comments…</p>}
  {!loading&&!error&&!comments.length&&<p className="comments-empty">Be the first to call out the moment.</p>}
  <div className="comment-list">{comments.map(c=><article className="clip-comment" key={c.id}><span className="comment-avatar" aria-hidden="true">{c.author.slice(0,2).toUpperCase()}</span><div className="comment-content"><div className="comment-byline"><strong>{c.author}</strong><time dateTime={new Date(c.createdAt).toISOString()}>{new Date(c.createdAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time>{c.mine&&<button className="comment-delete" disabled={busy} onClick={()=>void remove(c.id)} aria-label={'Delete your comment: '+c.body.slice(0,40)}><Trash2 size={12}/> Delete</button>}</div><p>{c.body}</p></div></article>)}</div>
  {cursor&&<button className="text-button older-comments" disabled={loading||busy} onClick={()=>void load(cursor)}>Load older comments</button>}
 </section>;
}
