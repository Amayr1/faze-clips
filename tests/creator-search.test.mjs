import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorNames,searchOptions,mergeSearchClips,encodeSearchCursor,decodeSearchCursor} from '../lib/creator-search.mjs';
const catalog=[{channel:'fazerain',channelName:'FaZe Rain'},{channel:'stableronaldo',channelName:'StableRonaldo'}];
test('creator lookup accepts display names, handles, creator URLs and any new username',()=>{
 assert.deepEqual(creatorNames('FaZe Rain',catalog),['fazerain']);
 assert.deepEqual(creatorNames('@StableRonaldo',catalog),['stableronaldo']);
 assert.deepEqual(creatorNames('FaZe Rain clips',catalog),['fazerain']);
 assert.deepEqual(creatorNames('https://kick.com/new_creator'),['new_creator']);
 assert.deepEqual(creatorNames('AnyNewStreamer'),['anynewstreamer']);
 assert.deepEqual(creatorNames('Speed',catalog),['ishowspeed']);
});
test('search defaults to source views and validates sort and time',()=>{
 assert.deepEqual(searchOptions(new URLSearchParams('q=creator')),{query:'creator',sort:'view',time:'all'});
 assert.throws(()=>searchOptions(new URLSearchParams('q=creator&sort=invalid')));
 assert.throws(()=>searchOptions(new URLSearchParams('q=creator&time=invalid')));
});
test('merging source pages keeps API totals, sorts numerically and removes duplicates',()=>{
 const clips=mergeSearchClips([{id:'a',views:1000,createdAt:'2026-11-01'},{id:'b',views:99},{id:'c',views:400},{id:'a',views:0,title:'saved metadata',createdAt:''},{id:'d',views:0}]);
 assert.deepEqual(clips.map(c=>c.id),['a','c','b','d']);assert.equal(clips[0].views,1000);assert.equal(clips[0].createdAt,'2026-11-01');
 const appended=mergeSearchClips([...clips,{id:'e',views:3000},{id:'a',views:1050}]);assert.equal(appended[0].id,'e');assert.equal(appended[1].views,1050);
});
test('date and FaZe-like sorts remain separate from source views',()=>{
 const rows=[{id:'old',views:1000,likes:2,createdAt:'2026-01-01'},{id:'new',views:20,likes:8,createdAt:'2026-11-01'}];
 assert.deepEqual(mergeSearchClips(rows,'view').map(c=>c.id),['old','new']);
 assert.deepEqual(mergeSearchClips(rows,'date').map(c=>c.id),['new','old']);
 assert.deepEqual(mergeSearchClips(rows,'top').map(c=>c.id),['new','old']);
});
test('pagination binds query, sort and time, handles Unicode and rejects foreign source hosts',()=>{
 const options={query:'Créateur 🎮',sort:'view',time:'all'},sources=[{provider:'kick',channel:'creator',cursor:'abc+/='}];
 const token=encodeSearchCursor(options,sources,100);assert.deepEqual(decodeSearchCursor(token,options),{v:1,q:'créateur 🎮',sort:'view',time:'all',sources,offset:100});
 assert.throws(()=>decodeSearchCursor(token,{...options,sort:'date'}));
 assert.throws(()=>decodeSearchCursor(token,{...options,query:'different'}));
 assert.throws(()=>decodeSearchCursor(encodeSearchCursor(options,[{provider:'other',channel:'creator',cursor:'x'}],0),options));
 assert.throws(()=>decodeSearchCursor(encodeSearchCursor(options,sources,-1),options));
});
