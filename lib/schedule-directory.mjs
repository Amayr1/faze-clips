export const ROSTER_URL='https://fazeclan.com/pages/people';
export const FEATURED_STREAMERS=[
 {id:'stableronaldo',name:'Stable Ronaldo',game:'Variety',twitch:'stableronaldo'},
 {id:'jasontheween',name:'JasonTheWeen',game:'IRL / Variety',twitch:'jasontheween'},
 {id:'lacy',name:'Lacy',game:'Fortnite / Variety',twitch:'lacy'},
 {id:'silky',name:'Silky',game:'IRL / Variety',twitch:'silky'},
 {id:'kaicenat',name:'Kai Cenat',game:'Variety',twitch:'kaicenat'},
 {id:'caseoh',name:'CaseOh',game:'Variety',twitch:'caseoh_'},
 {id:'jynxzi',name:'Jynxzi',game:'Rainbow Six Siege',twitch:'jynxzi'},
 {id:'tarik',name:'tarik',game:'VALORANT',twitch:'tarik'},
 {id:'shroud',name:'shroud',game:'FPS / Variety',twitch:'shroud'},
 {id:'summit1g',name:'summit1g',game:'GTA / Variety',twitch:'summit1g'},
 {id:'xqc',name:'xQc',game:'Variety',twitch:'xqc',alternateUrl:'https://kick.com/xqc'},
 {id:'ishowspeed',name:'IShowSpeed',game:'IRL / Football',youtube:'UCWsDFcIhY2DBi3GB5uykGXA'},
];
// Only channels with an established identity are seeded. Similar names are not proof of identity.
const FAZE_CHANNELS={
 'faze-zoomaa':'zoomaa','faze-handyy':'handyy','faze-sparg0':'sparg0','faze-twistzz':'twistzz','faze-karrigan':'karrigango',
 'faze-broky':'brokycs','faze-frozen':'actuallyfrozen','faze-jcobbb':'1jcobbb','faze-neo':'neog5',
 'faze-fexx':'fexx29','faze-gustav':'gustavqq','faze-vard':'vardfps',
 'faze-cyber':'cyberzerar6','faze-soulz1':'souulz','faze-kds':'kdsr6',
};
export function parseActiveRoster(html){
 const raw=html.match(/var\s+ACTIVE\s*=\s*(\[[\s\S]*?\]);/)?.[1];
 const groups=JSON.parse(raw||'null');
 if(!Array.isArray(groups)||!groups.length)throw Error('Active directory unavailable');
 const members=groups.flatMap(group=>{
  if(!Array.isArray(group)||typeof group[0]!=='string')throw Error('Invalid directory');
  return group.slice(1).map(person=>{
   if(!Array.isArray(person)||typeof person[0]!=='string'||!/^FaZe\s+\S/.test(person[0])||person[0].length>100||typeof person[1]!=='string')throw Error('Invalid member');
   return {id:'faze-'+person[0].replace(/^FaZe\s+/i,'').toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:person[0],game:group[0],role:person[1].slice(0,200)};
  });
 });
 if(members.length<5||members.length>300||new Set(members.map(m=>m.id)).size!==members.length)throw Error('Incomplete directory');
 return members;
}
export function linkMembers(members,overrides=''){
 let mapping={};try{const value=JSON.parse(overrides);if(value&&typeof value==='object'&&!Array.isArray(value))mapping=value;}catch{}
 return members.map(m=>{const handle=mapping[m.id]||FAZE_CHANNELS[m.id];return {...m,...(typeof handle==='string'&&/^[a-z0-9_]{1,25}$/.test(handle)?{twitch:handle}:{})};});
}
export function memberChannel(member){return member.twitch?'https://www.twitch.tv/'+member.twitch:member.youtube?'https://www.youtube.com/channel/'+member.youtube+'/streams':'';}
export function memberSchedule(member){return member.twitch?memberChannel(member)+'/schedule':memberChannel(member);}
