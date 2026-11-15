import ICAL from 'ical.js';
const formats=new Map();
function wallParts(value,zone){
 let formatter=formats.get(zone);if(!formatter){formatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});formats.set(zone,formatter);}
 return Object.fromEntries(formatter.formatToParts(new Date(value)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function wallStamp(parts){return Date.UTC(parts.year,parts.month-1,parts.day,parts.hour||0,parts.minute||0,parts.second||0);}
function utcTime(value,tzid){
 if(value.isDate)throw Error('Date-only schedule unsupported');
 if(value.zone?.tzid==='UTC')return value.toUnixTime()*1000;
 const zone=String(tzid||'').replace(/^\//,'');
 if(!zone||zone==='floating')throw Error('Missing calendar time zone');
 const target=wallStamp(value);let guess=target;
 for(let i=0;i<4;i++){const diff=target-wallStamp(wallParts(guess,zone));if(diff===0)break;guess+=diff;}
 if(wallStamp(wallParts(guess,zone))!==target)throw Error('Nonexistent local stream time');
 // A repeated fall-back wall time resolves to its first occurrence, as in RFC 5545.
 if(wallStamp(wallParts(guess-3600000,zone))===target)guess-=3600000;
 return guess;
}
export function parseTwitchCalendar(text,member,window){
 if(typeof text!=='string'||text.length>2000000||!text.includes('BEGIN:VCALENDAR'))throw Error('Invalid calendar');
 const component=new ICAL.Component(ICAL.parse(text));
 const name=String(component.getFirstPropertyValue('x-wr-calname')||component.getFirstPropertyValue('name')||'');
 if(name.toLowerCase()!==member.twitch.toLowerCase())throw Error('Calendar channel identity did not match');
 const components=component.getAllSubcomponents('vevent');if(components.length>1000)throw Error('Calendar too large');
 const events=[];let partial=false;
 for(const child of components){
  if(child.hasProperty('recurrence-id'))continue;
  try{
   const exceptions=components.filter(c=>c.hasProperty('recurrence-id')&&c.getFirstPropertyValue('uid')===child.getFirstPropertyValue('uid'));
   const event=new ICAL.Event(child,{strictExceptions:true,exceptions});
   if(!event.uid||!event.startDate)throw Error('Incomplete event');
   // Twitch schedules recur weekly; reject unexpectedly expensive recurrence frequencies.
   const rules=child.getAllProperties('rrule');
   if(rules.some(r=>!['WEEKLY','DAILY','MONTHLY','YEARLY'].includes(r.getFirstValue().freq)))throw Error('Unsupported calendar recurrence');
   const iterator=event.iterator();let count=0,occurrence;
   while((occurrence=iterator.next())){
    if(++count>20000){partial=true;break;}
    const details=event.getOccurrenceDetails(occurrence),item=details.item;
    const startProperty=item.component.getFirstProperty('dtstart')||child.getFirstProperty('dtstart');
    const endProperty=item.component.getFirstProperty('dtend')||child.getFirstProperty('dtend');
    const start=utcTime(details.startDate,startProperty.getParameter('tzid'));
    const end=endProperty?utcTime(details.endDate,endProperty.getParameter('tzid')||startProperty.getParameter('tzid')):null;
    if(start>=window.to)break;
    if(start<window.from&&(end===null||end<=window.from))continue;
    events.push({id:'twitch-calendar:'+event.uid+':'+occurrence.toString(),memberId:member.id,provider:'twitch',title:String(item.summary||'Scheduled stream').slice(0,250),start:new Date(start).toISOString(),end:end!==null&&end>start?new Date(end).toISOString():null,category:String(item.component.getFirstPropertyValue('categories')||''),recurring:event.isRecurring(),cancelled:String(item.component.getFirstPropertyValue('status')||'').toUpperCase()==='CANCELLED',url:'https://www.twitch.tv/'+member.twitch});
    if(!event.isRecurring())break;
   }
  }catch{partial=true;}
 }
 return {status:partial?'partial':events.length?'ready':'empty',events,vacation:null,source:'twitch-calendar'};
}
