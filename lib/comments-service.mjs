import {cleanReel} from './reel-validation.mjs';
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const commentId=new RegExp('^'+UUID+'$');
export class CommentError extends Error {constructor(status,message){super(message);this.status=status;}}
export function validateClipId(value){
 if(typeof value!=='string'||!(new RegExp('^upload:'+UUID+'$').test(value)||/^twitch:[\w-]{5,150}$/.test(value)||/^youtube:[\w-]{11}$/.test(value)||/^clip_[A-Za-z0-9]{12,40}$/.test(value)))throw new CommentError(400,'Choose a valid clip.');
 return value;
}
export function validateComment(value){
 if(typeof value!=='string'||!value.trim()||value.trim().length>1000)throw new CommentError(400,'Write a comment between 1 and 1,000 characters.');
 return value.trim();
}
export async function readCommentJson(request){
 const reader=request.body?.getReader();if(!reader)throw new CommentError(400,'Write a comment first.');
 const chunks=[];let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();throw new CommentError(413,'Comment request is too large.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new CommentError(400,'Send a valid comment.');}
}
function decodeBefore(value){
 if(!value)return null;
 try{if(value.length>200)throw Error();const c=JSON.parse(atob(value));if(!Number.isSafeInteger(c.at)||c.at<0||!commentId.test(c.id))throw Error();return c;}catch{throw new CommentError(400,'Reload the comment thread to continue.');}
}
export function createCommentService({database,now=Date.now,uuid=()=>crypto.randomUUID()}){
 return {
  async list(clipId,userId='',before){
   validateClipId(clipId);const cursor=decodeBefore(before);
   const args=[clipId];if(cursor)args.push(cursor.at,cursor.at,cursor.id);
   const rows=await database().prepare('SELECT id,owner,author,body,created_at AS createdAt FROM comments WHERE clip_id=?'+(cursor?' AND (created_at<? OR (created_at=? AND id<?))':'')+' ORDER BY created_at DESC,id DESC LIMIT 21').bind(...args).all();
   const total=await database().prepare('SELECT COUNT(*) AS n FROM comments WHERE clip_id=?').bind(clipId).first();
   const page=rows.results.slice(0,20),last=page.at(-1);
   return {comments:page.map(({owner,...c})=>({...c,mine:owner===userId})),total:total?.n||0,nextCursor:rows.results.length>20?btoa(JSON.stringify({at:last.createdAt,id:last.id})):null};
  },
  async add(user,clip,text){
   if(!user?.userId)throw new CommentError(401,'Sign in to comment.');
   const body=validateComment(text);let id;
   if(clip?.provider==='upload'){
    id=validateClipId(clip.id);
    if(!id.startsWith('upload:')||!await database().prepare('SELECT id FROM posts WHERE id=?').bind(id.slice(7)).first())throw new CommentError(404,'Clip not found.');
   }else{
    const parsed=cleanReel(clip);id=validateClipId(parsed.id);
    if(clip.id&&clip.id!==id)throw new CommentError(400,'Clip identity does not match its source.');
   }
   const createdAt=now(),cid=uuid(),author=(user.fullName||'Player').trim().slice(0,80)||'Player';
   const args=[cid,id,user.userId,author,body,createdAt,user.userId,createdAt-60000];
   const upload=id.startsWith('upload:');if(upload)args.push(id.slice(7));
   const r=await database().prepare('INSERT INTO comments(id,clip_id,owner,author,body,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM comments WHERE owner=? AND created_at>?)<8'+(upload?' AND EXISTS(SELECT 1 FROM posts WHERE id=?)':'')).bind(...args).run();
   if(!r.meta.changes)throw new CommentError(429,'You can post up to 8 comments per minute. Try again shortly.');
   return {id:cid,author,body,createdAt,mine:true};
  },
  async remove(userId,id){
   if(!commentId.test(id||''))throw new CommentError(400,'Choose a valid comment.');
   const r=await database().prepare('DELETE FROM comments WHERE id=? AND owner=?').bind(id,userId).run();
   return !!r.meta.changes;
  }
 };
}
