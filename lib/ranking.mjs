export function affinityProfile(signals, now=Date.now()) {
 const category={},creator={},seen={};
 for(const s of signals){const decay=Math.pow(.5,Math.max(0,now-Number(s.updatedAt||now))/(14*86400000));const weight=(s.liked?5:0)+Math.min(2,Number(s.seconds||0)/20)+Math.min(2,Number(s.completions||0));category[s.category]=(category[s.category]||0)+weight*decay;creator[s.channel]=(creator[s.channel]||0)+weight*decay;seen[s.id]=Number(s.seconds||0);}
 return {category,creator,seen};
}
export function rankClips(clips,mode,stats={},signals=[],now=Date.now()){
 const profile=affinityProfile(signals,now);
 const score=c=>{const s=stats[c.id]||{};const likes=Math.max(0,Number(s.likes||0));const external=Math.log1p(Math.max(0,Number(c.externalLikes||0)))*.15;const age=Math.max(0,(now-(s.addedAt||Date.parse(c.createdAt)||now))/3600000);const hot=(likes+external)/Math.pow(2+age,1.25);
 if(mode==='top')return likes;
 if(mode==='date')return Date.parse(c.createdAt)||0;
 if(mode==='view')return c.views||0;
 if(mode==='hot')return hot;
 return 2*Math.log1p(profile.category[c.category]||0)+Math.log1p(profile.creator[c.channel]||0)+Math.log1p(likes)*.4+external+(profile.seen[c.id]?-.7:.6)+hot*.1;};
 const sorted=[...clips].sort((a,b)=>score(b)-score(a));
 if(mode!=='for-you')return sorted;
 // Avoid creator monopolies and reserve every fifth slot for exploration.
 const result=[],remaining=[...sorted];while(remaining.length){let i=result.length%5===4?remaining.findIndex(c=>!profile.seen[c.id]&&!result.slice(-4).some(r=>r.channel===c.channel)):-1;if(i<0)i=remaining.findIndex(c=>result.length<2||!result.slice(-2).every(r=>r.channel===c.channel));if(i<0)i=0;result.push(remaining.splice(i,1)[0]);}return result;
}
