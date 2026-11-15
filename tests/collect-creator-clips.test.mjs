import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCreatorClips} from '../lib/collect-creator-clips.mjs';
import {mergeSearchClips,encodeSearchCursor} from '../lib/creator-search.mjs';

test('collection exhausts every page before returning the inventory to sort',async()=>{
 const calls=[],progress=[];
 const pages=[
  {clips:[{id:'a',views:99,likes:1,createdAt:'2026-01-01'}],nextCursor:'page2'},
  {clips:[{id:'b',views:101,likes:2,createdAt:'2026-02-01'},{id:'a',views:0}],nextCursor:'page3'},
  {clips:[{id:'last',views:9999,likes:30,createdAt:'2026-11-15'}],nextCursor:null}
 ];
 let finished=false;
 const promise=collectCreatorClips({loadPage:async cursor=>{calls.push(cursor);assert.equal(finished,false);return pages[calls.length-1];},onProgress:p=>progress.push(p)}).then(r=>{finished=true;return r;});
 assert.equal(finished,false);
 const result=await promise;
 assert.deepEqual(calls,[null,'page2','page3']);assert.equal(result.complete,true);assert.equal(result.pages,3);
 assert.deepEqual(progress.map(p=>p.clips),[1,2,3]);
 // Arrival order is not a premature ranking. The last page wins every final sort.
 assert.deepEqual(result.clips.map(c=>c.id),['a','b','last']);
 for(const mode of ['view','top','date'])assert.equal(mergeSearchClips(result.clips,mode)[0].id,'last');
 assert.equal(calls.length,3,'changing sort after collection needs no more source requests');
 assert.equal(result.clips.find(c=>c.id==='a').views,99);
});

test('collection has no arbitrary page or 150-clip cutoff',async()=>{
 let n=0;
 const result=await collectCreatorClips({loadPage:async()=>({clips:Array.from({length:10},(_,i)=>({id:'clip-'+(n*10+i),views:i})),nextCursor:++n<40?'page-'+n:null})});
 assert.equal(n,40);assert.equal(result.clips.length,400);assert.equal(result.complete,true);
});

test('failed or stale sources never get a complete ranking flag',async()=>{
 for(const status of ['unavailable','cached','incomplete']){
  const r=await collectCreatorClips({loadPage:async()=>({clips:[{id:'cached',views:10}],sources:[{provider:'kick',channel:'creator',status,count:1}],nextCursor:null})});
  assert.equal(r.complete,false);
 }
 const r=await collectCreatorClips({loadPage:async()=>({clips:[{id:'a'}],sources:[{provider:'kick',channel:'creator',status:'live',count:1},{provider:'twitch',channel:'creator',status:'not-connected',count:0}],nextCursor:null})});
 assert.equal(r.complete,true,'unconfigured sources are explicitly excluded from available-source coverage');
 assert.equal(r.sources.find(s=>s.provider==='twitch').status,'not-connected');
});

test('collection preserves source failures even if a later page reports that source live',async()=>{
 let n=0;
 const r=await collectCreatorClips({loadPage:async()=>({clips:[],sources:[{provider:'kick',channel:'creator',status:n?'live':'cached',count:1}],nextCursor:n++===0?'next':null})});
 assert.equal(r.complete,false);assert.equal(r.sources[0].count,2);assert.equal(r.sources[0].status,'cached');
});

test('network failures and aborts do not return an incomplete inventory as complete',async()=>{
 let n=0;
 await assert.rejects(collectCreatorClips({loadPage:async()=>{if(n++)throw Error('network interrupted');return {clips:[{id:'a'}],nextCursor:'next'};}}),/network interrupted/);
 const c=new AbortController();c.abort();let calls=0;
 await assert.rejects(collectCreatorClips({signal:c.signal,loadPage:async()=>{calls++;return {};}}),{name:'AbortError'});
 assert.equal(calls,0);
});

test('collection catches repeated source cursors even when catalog offsets keep increasing',async()=>{
 const options={query:'creator',sort:'view',time:'all'};let n=0;
 await assert.rejects(collectCreatorClips({loadPage:async()=>({clips:[],nextCursor:encodeSearchCursor(options,[{provider:'kick',channel:'creator',cursor:'stalled'}],100*(++n))})}),/stopped advancing/);
 assert.equal(n,2);
 await assert.rejects(collectCreatorClips({loadPage:async()=>({clips:[],nextCursor:'same'})}),/repeated/);
});
