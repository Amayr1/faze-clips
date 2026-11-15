import assert from 'node:assert/strict';
import {collectCreatorClips} from '../lib/collect-creator-clips.mjs';
import {mergeSearchClips} from '../lib/creator-search.mjs';
const base='http://127.0.0.1:5173';
async function search(params){const r=await fetch(base+'/api/search?'+new URLSearchParams(params));const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));assert.equal(r.headers.get('cache-control'),'no-store');return d;}
const first=await search({q:'saab'});
assert.equal(first.sort,'view');assert.ok(first.clips.length>0);
assert.ok(first.clips.every(c=>c.channel==='saab'||c.channelName.toLowerCase()==='saab'),'creator search excludes unrelated title mentions');
for(let i=1;i<first.clips.length;i++)assert.ok(first.clips[i-1].views>=first.clips[i].views,'numeric descending source views');
if(first.nextCursor){
 const second=await search({q:'saab',sort:'view',time:'all',cursor:first.nextCursor});
 assert.ok(second.clips.length>0);
 assert.ok(second.clips.some(c=>!first.clips.some(p=>p.id===c.id)),'continuation retrieves new creator clips');
 const invalid=await fetch(base+'/api/search?'+new URLSearchParams({q:'saab',sort:'date',cursor:first.nextCursor}));assert.equal(invalid.status,400);
}
const displayName=await search({q:'FaZe Rain'});
assert.ok(displayName.clips.length>0);assert.ok(displayName.clips.every(c=>c.channel==='fazerain'));
const newest=await search({q:'saab',sort:'date'});
for(let i=1;i<newest.clips.length;i++)assert.ok((Date.parse(newest.clips[i-1].createdAt)||0)>=(Date.parse(newest.clips[i].createdAt)||0));
const top=await search({q:'saab',sort:'top'});for(let i=1;i<top.clips.length;i++)assert.ok(top.clips[i-1].likes>=top.clips[i].likes);
assert.equal((await fetch(base+'/api/search?q=saab&sort=invalid')).status,400);
console.log('Passed: creator identity, source views, native continuation, cursor/sort isolation, display names, newest, first-party likes and no-store responses.');

const full=await collectCreatorClips({loadPage:cursor=>search({q:'FaZe Rain',sort:'view',time:'all',...(cursor?{cursor}:{})})});
assert.equal(full.complete,true);assert.ok(full.clips.length>=displayName.clips.length);assert.equal(full.nextCursor,null);
const ranked=mergeSearchClips(full.clips,'view');for(let i=1;i<ranked.length;i++)assert.ok(ranked[i-1].views>=ranked[i].views);
console.log('Passed: complete live creator collection before final sorting ('+full.clips.length+' clips, '+full.pages+' pages).');
