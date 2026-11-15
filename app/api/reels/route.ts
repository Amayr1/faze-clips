import {database,writer,failure} from '@/lib/community';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {cleanReel} from '@/lib/reel-validation.mjs';
export async function GET(){try{
 const user=await getChatGPTUser();
 const rows=await database().prepare("SELECT r.id,r.data,r.added_at AS addedAt,COUNT(l.user_id) AS likes,MAX(CASE WHEN l.user_id=? THEN 1 ELSE 0 END) AS liked FROM reels r LEFT JOIN likes l ON l.post_id='reel:'||r.id GROUP BY r.id ORDER BY likes DESC,r.added_at DESC LIMIT 300").bind(user?.userId||'').all<{id:string;data:string;addedAt:number;likes:number;liked:number}>();
 const uploads=await database().prepare("SELECT p.*,COUNT(l.user_id) AS votes,MAX(CASE WHEN l.user_id=? THEN 1 ELSE 0 END) AS liked FROM posts p LEFT JOIN likes l ON l.post_id=p.id GROUP BY p.id ORDER BY votes DESC,p.created_at DESC LIMIT 300").bind(user?.userId||'').all<any>();
 const metrics=await database().prepare('SELECT post_id,SUM(external_likes) AS likes,SUM(external_views) AS views,MAX(synced_at) AS syncedAt FROM publications WHERE synced_at IS NOT NULL GROUP BY post_id').all<any>();
 const uploadClips=uploads.results.map(p=>({id:'upload:'+p.id,provider:'upload',streamUrl:p.stream_url||'',sourceVideoUrl:p.source_url||'',challengeId:p.challenge_id||null,title:p.title,description:p.description,channel:'creator:'+p.author,channelName:p.author,category:p.game,videoUrl:'/api/media/'+p.media_key,thumbnail:'/upload-cover.svg',url:'/#clip='+p.id,duration:0,views:0,createdAt:new Date(p.created_at).toISOString(),addedAt:p.created_at,likes:p.votes,liked:!!p.liked,externalLikes:metrics.results.find(m=>m.post_id===p.id)?.likes||0,externalViews:metrics.results.find(m=>m.post_id===p.id)?.views||0,externalSyncedAt:metrics.results.find(m=>m.post_id===p.id)?.syncedAt||null}));
 return Response.json({signedIn:!!user,reels:[...uploadClips,...rows.results.map(r=>({...JSON.parse(r.data),addedAt:r.addedAt,likes:r.likes,liked:!!r.liked}))]},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const user=await writer(request);
 if(Number(request.headers.get('content-length')||0)>10000)throw Error('Reel data is too large.');
 const body=await request.json() as {clip:unknown;liked?:boolean;publish?:boolean};
 if(typeof body.liked!=='boolean'&&body.publish!==true)throw Error('Choose a reel action.');
 const input=body.clip as any;
 if(input?.provider==='upload'){const id=String(input.id||'').replace('upload:','');const p=await database().prepare('SELECT id FROM posts WHERE id=?').bind(id).first();if(!p)throw Error('Clip not found.');if(typeof body.liked!=='boolean')throw Error('Invalid like.');if(body.liked)await database().prepare('INSERT OR IGNORE INTO likes(post_id,user_id) VALUES(?,?)').bind(id,user.userId).run();else await database().prepare('DELETE FROM likes WHERE post_id=? AND user_id=?').bind(id,user.userId).run();const count=await database().prepare('SELECT COUNT(*) AS likes FROM likes WHERE post_id=?').bind(id).first();return Response.json({...count,id:input.id,liked:body.liked,clip:input});}
 const clip=cleanReel(body.clip);
 const existing=await database().prepare('SELECT id FROM reels WHERE id=?').bind(clip.id).first();
 if(!existing){const count=await database().prepare("SELECT COUNT(*) AS n FROM reels WHERE added_at>?").bind(Date.now()-60000).first<{n:number}>();if((count?.n||0)>120)throw Error('Too many new reels. Try again in a minute.');}
 const statements=[database().prepare('INSERT OR IGNORE INTO reels(id,data,added_at) VALUES(?,?,?)').bind(clip.id,JSON.stringify(clip),Date.now())];
 if(typeof body.liked==='boolean')statements.push(body.liked?database().prepare('INSERT OR IGNORE INTO likes(post_id,user_id) VALUES(?,?)').bind('reel:'+clip.id,user.userId):database().prepare('DELETE FROM likes WHERE post_id=? AND user_id=?').bind('reel:'+clip.id,user.userId));
 await database().batch(statements);
 const count=await database().prepare('SELECT COUNT(*) AS likes FROM likes WHERE post_id=?').bind('reel:'+clip.id).first();
 return Response.json({...count,id:clip.id,liked:body.liked===true,clip});
}catch(e){return failure(e);}}
