import {database,writer,failure} from '@/lib/community';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {createCommentService,CommentError,readCommentJson} from '@/lib/comments-service.mjs';
const comments=createCommentService({database});
function error(e:unknown){return e instanceof CommentError?Response.json({error:e.message},{status:e.status}):failure(e);}
export async function GET(request:Request){try{
 const p=new URL(request.url).searchParams,user=await getChatGPTUser();
 return Response.json({...await comments.list(p.get('clipId')||'',user?.userId,p.get('before')),signedIn:!!user},{headers:{'Cache-Control':'no-store'}});
}catch(e){return error(e);}}
export async function POST(request:Request){try{
 const user=await writer(request),body=await readCommentJson(request),comment=await comments.add(user,body.clip,body.body);
 return Response.json({comment},{status:201,headers:{'Cache-Control':'no-store'}});
}catch(e){return error(e);}}
export async function DELETE(request:Request){try{
 const user=await writer(request),id=new URL(request.url).searchParams.get('id')||'';
 if(!await comments.remove(user.userId,id))return Response.json({error:'Comment not found.'},{status:404});
 return Response.json({ok:true});
}catch(e){return error(e);}}
