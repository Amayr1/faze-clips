export function dayKey(value,zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function shiftDay(key,days){const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function weekStart(value,zone){const key=dayKey(value,zone),day=new Date(key+'T12:00:00Z').getUTCDay();return shiftDay(key,-((day+6)%7));}
const escapeIcal=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function calendarFile(event,member,now=Date.now()){
 if(event.cancelled||!Number.isFinite(Date.parse(event.start)))throw Error('Only announced streams can be added.');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FaZe Clips//Stream Schedule//EN','BEGIN:VEVENT','UID:'+escapeIcal(event.id)+'@faze-clips','DTSTAMP:'+stamp(now),'DTSTART:'+stamp(event.start)];
 if(event.end&&Date.parse(event.end)>Date.parse(event.start))lines.push('DTEND:'+stamp(event.end));
 lines.push('SUMMARY:'+escapeIcal(member.name+' — '+event.title),'DESCRIPTION:'+escapeIcal('Creator-announced stream. Times may change; check the source schedule.'),'URL:'+escapeIcal(event.url),'END:VEVENT','END:VCALENDAR');
 // RFC 5545 folding is in UTF-8 octets, including the continuation space.
 return lines.map(line=>{let folded='',part='',bytes=0;for(const c of line){const size=new TextEncoder().encode(c).length;if(bytes+size>75){folded+=part+'\r\n';part=' ';bytes=1;}part+=c;bytes+=size;}return folded+part;}).join('\r\n')+'\r\n';
}
