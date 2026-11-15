import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../public/data/faze-schedule-roster.json' with {type:'json'};
import {parseActiveRoster,linkMembers,FEATURED_STREAMERS} from '../lib/schedule-directory.mjs';
import {createScheduleService,scheduleWindow} from '../lib/schedule-service.mjs';
import {dayKey,weekStart,calendarFile} from '../lib/schedule-time.mjs';
import {parseTwitchCalendar} from '../lib/twitch-calendar.mjs';
const now=()=>Date.parse('2026-11-15T18:00:00Z');
const params=(mode='featured')=>new URLSearchParams({mode,start:'2026-11-16'});
const response=(data,status=200)=>Response.json(data,{status});
test('active roster excludes alumni, validates structure, and leaves unknown channels unlinked',()=>{
 const html='<script>var P=[["FaZe Former","Alumnus"]];var ACTIVE=[["CS",["FaZe One","Player"],["FaZe Two","Player"],["FaZe Three","Player"],["FaZe Four","Player"],["FaZe Five","Coach"]]];</script>';
 const members=parseActiveRoster(html);assert.equal(members.length,5);assert.ok(!members.some(m=>m.name.includes('Former')));
 assert.equal(linkMembers(members)[0].twitch,undefined);
 assert.equal(linkMembers(members,'{"faze-one":"one_real"}')[0].twitch,'one_real');
 assert.equal(linkMembers(members,'{"faze-one":"https://evil.test"}')[0].twitch,undefined);
 assert.throws(()=>parseActiveRoster('var ACTIVE=[["CS",["Someone","Player"]]];'));
 assert.equal(FEATURED_STREAMERS.length,12);assert.equal(new Set(FEATURED_STREAMERS.map(m=>m.id)).size,12);
});
test('schedule windows validate real dates, collection, and request range',()=>{
 const w=scheduleWindow(params(),now());assert.equal(w.to-w.from,9*86400000);
 for(const p of [new URLSearchParams({mode:'other'}),new URLSearchParams({start:'2026-02-30'}),new URLSearchParams({start:'2030-01-01'}),new URLSearchParams({start:'2026-11-16&evil'})])assert.throws(()=>scheduleWindow(p,now()));
});
test('unconfigured sources are distinct from an empty schedule and snapshot fallback is explicit',async()=>{
 let requests=0;const service=createScheduleService({snapshot,now,fetcher:async()=>{requests++;throw Error('Offline');}});
 const featured=await service.get(params());assert.equal(requests,0);assert.equal(featured.members.length,12);assert.ok(featured.members.every(m=>m.status==='not-connected'&&m.live===null&&m.events.length===0));
 const faze=await service.get(params('faze'));assert.equal(requests,1);assert.equal(faze.roster.status,'snapshot');assert.equal(faze.members.length,snapshot.members.length);assert.ok(faze.members.some(m=>m.status==='unlinked'));
});
test('Twitch schedules follow pages, distinguish live status, preserve cancellations and isolate source failures',async()=>{
 const calls=[];
 const fetcher=async input=>{
  const u=new URL(input);calls.push(u.pathname+u.search);
  if(u.hostname==='id.twitch.tv')return response({access_token:'private-token',expires_in:3600});
  if(u.pathname==='/helix/users')return response({data:[{id:'1',login:'stableronaldo'},{id:'2',login:'jasontheween'},{id:'3',login:'lacy'}]});
  if(u.pathname==='/helix/streams')return response({data:[{user_id:'1',title:'Live show'}]});
  if(u.pathname==='/helix/schedule'){
   if(u.searchParams.get('broadcaster_id')==='2')return response({},404);
   if(u.searchParams.get('broadcaster_id')==='3')return response({},503);
   const canceled=!!u.searchParams.get('after');
   return response({data:{segments:[{id:canceled?'second':'first',title:canceled?'Cancelled show':'Show',start_time:'2026-11-17T18:00:00Z',end_time:'2026-11-17T20:00:00Z',canceled_until:canceled?'2026-11-17T20:00:00Z':null,is_recurring:true,category:{name:'GTA V'}}],vacation:null},pagination:canceled?{}:{cursor:'next'}});
  }
  throw Error('Unexpected source '+u.pathname);
 };
 const service=createScheduleService({env:{TWITCH_CLIENT_ID:'client',TWITCH_CLIENT_SECRET:'secret'},snapshot,now,fetcher});
 const [first,second]=await Promise.all([service.get(params()),service.get(params())]);
 assert.deepEqual(first,second);const m=first.members[0];assert.equal(m.events.length,2);assert.equal(m.status,'ready');assert.equal(m.live,true);assert.equal(m.events[1].cancelled,true);
 assert.equal(first.members[1].status,'empty');assert.equal(first.members[1].live,false);assert.equal(first.members[2].status,'unavailable');assert.equal(first.members[3].status,'not-found');
 assert.ok(calls.some(c=>c.includes('after=next')));assert.equal(calls.filter(c=>c.startsWith('/oauth2/token')).length,1);
 assert.ok(!JSON.stringify(first).includes('private-token'));assert.ok(!JSON.stringify(first).includes('secret'));
});
test('a repeated Twitch schedule cursor exposes partial data instead of looping',async()=>{
 let pages=0;
 const service=createScheduleService({env:{TWITCH_CLIENT_ID:'a',TWITCH_CLIENT_SECRET:'b'},snapshot,now,fetcher:async input=>{
  const u=new URL(input);
  if(u.hostname==='id.twitch.tv')return response({access_token:'x',expires_in:3600});
  if(u.pathname==='/helix/users')return response({data:[{id:'1',login:'stableronaldo'}]});
  if(u.pathname==='/helix/streams')return response({data:[]});
  pages++;return response({data:{segments:[{id:'same',start_time:'2026-11-17T18:00:00Z',end_time:null,title:'Stream'}]},pagination:{cursor:'same'}});
 }});
 const data=await service.get(params());assert.equal(data.members[0].status,'partial');assert.equal(data.members[0].events.length,1);assert.equal(pages,2);
});
test('YouTube uses announced stream start times, pages upcoming results, and shares its hourly source cache',async()=>{
 let searchCalls=0;
 const service=createScheduleService({env:{YOUTUBE_API_KEY:'key'},snapshot,now,fetcher:async input=>{
  const u=new URL(input);
  if(u.pathname.endsWith('/search')){
   searchCalls++;
   if(u.searchParams.get('eventType')==='live')return response({items:[]});
   return response({items:[{id:{videoId:'abcdefghijk'}}],...(!u.searchParams.get('pageToken')?{nextPageToken:'next'}:{})});
  }
  return response({items:[{id:'abcdefghijk',snippet:{channelId:FEATURED_STREAMERS[11].youtube,title:'IRL stream',publishedAt:'2024-01-01T00:00:00Z',liveBroadcastContent:'upcoming'},liveStreamingDetails:{scheduledStartTime:'2026-11-18T15:00:00Z'}}]});
 }});
 const first=await service.get(params());const m=first.members[11];assert.equal(m.events.length,1);assert.equal(m.events[0].start,'2026-11-18T15:00:00Z');assert.equal(m.live,false);assert.equal(searchCalls,3);
 await service.get(new URLSearchParams({start:'2026-11-23'}));assert.equal(searchCalls,3);
});
test('time zones cross dates and DST correctly; calendar downloads retain UTC and fold Unicode safely',()=>{
 assert.equal(dayKey('2026-11-16T01:00:00Z','America/Chicago'),'2026-11-15');
 assert.equal(weekStart('2026-11-16T01:00:00Z','America/Chicago'),'2026-11-09');
 assert.equal(dayKey('2026-11-01T06:30:00Z','America/Chicago'),'2026-11-01');
 assert.equal(dayKey('2026-11-01T07:30:00Z','America/Chicago'),'2026-11-01');
 const event={id:'a',title:'Stream, hello; world\n'+'🔥'.repeat(50),start:'2026-11-17T18:00:00Z',end:null,url:'https://www.twitch.tv/zoomaa'};
 const text=calendarFile(event,{name:'ZooMaa'},now());assert.ok(text.includes('DTSTART:20261117T180000Z'));assert.ok(!text.includes('DTEND:'));assert.ok(text.includes('SUMMARY:ZooMaa'));assert.ok(text.includes('\\, hello\\; world\\n'));
 for(const line of text.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);
 assert.throws(()=>calendarFile({...event,cancelled:true},{name:'ZooMaa'}));
});
const calendar=(events,name='stableronaldo')=>['BEGIN:VCALENDAR','VERSION:2.0','NAME:'+name,...events,'END:VCALENDAR'].join('\r\n');
test('public Twitch calendars expand weekly recurrence across DST and honor excluded dates',()=>{
 const text=calendar(['BEGIN:VEVENT','UID:weekly','DTSTART;TZID=/America/Los_Angeles:20261025T110000','DTEND;TZID=/America/Los_Angeles:20261025T190000','RRULE:FREQ=WEEKLY;COUNT=3;BYDAY=SU','EXDATE;TZID=/America/Los_Angeles:20261108T110000','SUMMARY:Weekly show','END:VEVENT']);
 const member={id:'stableronaldo',twitch:'stableronaldo'},window={from:Date.parse('2026-10-24'),to:Date.parse('2026-11-09')};
 const result=parseTwitchCalendar(text,member,window);assert.equal(result.status,'ready');assert.deepEqual(result.events.map(e=>e.start),['2026-10-25T18:00:00.000Z','2026-11-01T19:00:00.000Z']);
 assert.equal(result.events[1].end,'2026-11-02T03:00:00.000Z');
 assert.throws(()=>parseTwitchCalendar(text,{id:'wrong',twitch:'wrong'},window));
 const invalid=parseTwitchCalendar(text.replaceAll('/America/Los_Angeles','/Invalid/TimeZone'),member,window);assert.equal(invalid.status,'partial');assert.equal(invalid.events.length,0);
});
test('calendar recurrence exceptions preserve changed times and cancellation instead of generating phantom streams',()=>{
 const text=calendar(['BEGIN:VEVENT','UID:weekly','DTSTART;TZID=/America/Los_Angeles:20261025T110000','DTEND;TZID=/America/Los_Angeles:20261025T190000','RRULE:FREQ=WEEKLY;COUNT=2;BYDAY=SU','SUMMARY:Weekly show','END:VEVENT','BEGIN:VEVENT','UID:weekly','RECURRENCE-ID;TZID=/America/Los_Angeles:20261101T110000','DTSTART;TZID=/America/Los_Angeles:20261101T120000','DTEND;TZID=/America/Los_Angeles:20261101T200000','STATUS:CANCELLED','SUMMARY:Cancelled show','END:VEVENT']);
 const result=parseTwitchCalendar(text,{id:'stableronaldo',twitch:'stableronaldo'},{from:Date.parse('2026-10-24'),to:Date.parse('2026-11-09')});
 assert.equal(result.events.length,2);assert.equal(result.events[1].start,'2026-11-01T20:00:00.000Z');assert.equal(result.events[1].cancelled,true);
});
test('confirmed channel IDs enable public Twitch schedules without credentials or runtime third-party lookups',async()=>{
 let calls=0;const service=createScheduleService({snapshot,now,identities:{stableronaldo:'246450563'},fetcher:async input=>{
  assert.equal(new URL(input).hostname,'api.twitch.tv');calls++;
  return new Response(calendar(['BEGIN:VEVENT','UID:stream','DTSTART:20261117T180000Z','DTEND:20261117T210000Z','SUMMARY:Announced stream','END:VEVENT']));
 }});
 const data=await service.get(params()),member=data.members[0];assert.equal(data.connected.twitch,false);assert.equal(data.connected.publicCalendars,true);assert.equal(member.status,'ready');assert.equal(member.events.length,1);assert.equal(member.live,null);
 await service.get(new URLSearchParams({start:'2026-11-23'}));assert.equal(calls,1);
});
