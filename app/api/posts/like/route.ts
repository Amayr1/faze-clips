import { database, writer, failure } from "@/lib/community";
export async function POST(request: Request) { try {
  const user=await writer(request);const {id,liked}=await request.json() as {id:unknown;liked:unknown};
  if(typeof id!=="string"||typeof liked!=="boolean"||id.length>50) throw new Error("Invalid post.");
  const post=await database().prepare("SELECT id FROM posts WHERE id=?").bind(id).first();
  if(!post) return Response.json({error:"Clip not found."},{status:404});
  if(liked) await database().prepare("INSERT OR IGNORE INTO likes(post_id,user_id) VALUES(?,?)").bind(id,user.userId).run();
  else await database().prepare("DELETE FROM likes WHERE post_id=? AND user_id=?").bind(id,user.userId).run();
  const count=await database().prepare("SELECT COUNT(*) as votes FROM likes WHERE post_id=?").bind(id).first();
  return Response.json(count);
}catch(e){return failure(e);} }
