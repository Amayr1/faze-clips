import { database, bucket, writer, failure } from "@/lib/community";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {isSpotlight} from '@/lib/faze-experience.mjs';
import {normalizeSourceVideo,normalizeStreamUrl} from '@/lib/stream-links.mjs';
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser(); const params = new URL(request.url).searchParams;
    const mine = params.get("mine") === "1";
    if (mine && !user) return Response.json({posts:[], signedIn:false});
    const sort = params.get("sort") || "hot";
    const order = sort === "new" ? "p.created_at DESC" : sort === "top" ? "votes DESC, p.created_at DESC" : "(COUNT(l.user_id)+1.0)/((MAX(0, (? - p.created_at)/3600000.0)+2)*(MAX(0, (? - p.created_at)/3600000.0)+2)) DESC";
    const args: (string|number)[] = [user?.userId || ""];
    if(mine) args.push(user!.userId);
    if(sort !== "new" && sort !== "top") args.push(Date.now(),Date.now());
    const rows = await database().prepare(`SELECT p.id,p.author,p.title,p.description,p.game,p.created_at as createdAt,p.media_key as mediaKey,p.stream_url as streamUrl,p.source_url as sourceVideoUrl,p.challenge_id as challengeId,COUNT(l.user_id) as votes,MAX(CASE WHEN l.user_id=? THEN 1 ELSE 0 END) as liked FROM posts p LEFT JOIN likes l ON l.post_id=p.id ${mine ? "WHERE p.owner=?" : ""} GROUP BY p.id ORDER BY ${order} LIMIT 100`).bind(...args).all();
    return Response.json({posts:rows.results,signedIn:!!user}, {headers:{"Cache-Control":"no-store"}});
  } catch(e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const user = await writer(request);
    if(Number(request.headers.get("content-length")||0)>26*1024*1024) throw new Error("Keep your clip under 25 MB.");
    if(!request.body) throw new Error("Choose a clip first.");
    let received=0;
    const bounded=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){received+=chunk.byteLength;if(received>26*1024*1024)throw new Error("Keep your clip under 25 MB.");controller.enqueue(chunk);}}));
    const form = await new Response(bounded,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
    const file = form.get("video");
    const title = String(form.get("title")||"").trim(); const description = String(form.get("description")||"").trim(); const game=String(form.get("game")||"");const streamUrl=normalizeStreamUrl(form.get('streamUrl')||'');const sourceVideoUrl=normalizeSourceVideo(form.get('sourceVideoUrl')||'');const challengeId=String(form.get('challengeId')||'');if(!isSpotlight(challengeId))throw Error('Choose a valid community spotlight.');
    if(title.length<3 || title.length>100 || description.length>1000) throw new Error("Use a title of 3–100 characters and a caption under 1,000 characters.");
    if(!game.trim() || game.length>80) throw new Error("Choose a game.");
    if(!(file instanceof File) || file.size<16 || file.size>25*1024*1024 || !["video/mp4","video/webm","video/quicktime"].includes(file.type)) throw new Error("Choose an MP4, WebM or MOV video under 25 MB.");
    const head=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const webm=head[0]===0x1a&&head[1]===0x45&&head[2]===0xdf&&head[3]===0xa3;
    const mp4=String.fromCharCode(...head.slice(4,8))==="ftyp";
    if((file.type==="video/webm"&&!webm)||(file.type!=="video/webm"&&!mp4)) throw new Error("The file does not match a supported video format.");
    const count=await database().prepare("SELECT COUNT(*) as n FROM posts WHERE owner=? AND created_at>?").bind(user.userId,Date.now()-86400000).first<{n:number}>();
    if((count?.n||0)>=20) throw new Error("You can post up to 20 clips per day.");
    const id=crypto.randomUUID();const key=`${id}.${webm?"webm":file.type==="video/quicktime"?"mov":"mp4"}`;
    await bucket().put(key,file.stream(),{httpMetadata:{contentType:file.type}});
    try { await database().prepare("INSERT INTO posts(id,owner,author,title,description,game,media_key,stream_url,source_url,challenge_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(id,user.userId,user.fullName || "Player",title,description,game,key,streamUrl||null,sourceVideoUrl||null,challengeId||null,Date.now()).run(); }
    catch(e){await bucket().delete(key);throw e;}
    return Response.json({id},{status:201});
  } catch(e){return failure(e);}
}
export async function DELETE(request: Request) {
  try { const user=await writer(request);const id=new URL(request.url).searchParams.get("id")||"";
    const post=await database().prepare("SELECT media_key FROM posts WHERE id=? AND owner=?").bind(id,user.userId).first<{media_key:string}>();
    if(!post) return Response.json({error:"Clip not found."},{status:404});
    await database().batch([database().prepare("DELETE FROM likes WHERE post_id=?").bind(id),database().prepare("DELETE FROM comments WHERE clip_id=?").bind("upload:"+id),database().prepare("DELETE FROM posts WHERE id=? AND owner=?").bind(id,user.userId)]);
    await bucket().delete(post.media_key);return Response.json({ok:true});
  }catch(e){return failure(e);}
}
