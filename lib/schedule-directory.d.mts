export type ScheduleMember={id:string;name:string;game:string;role?:string;twitch?:string;youtube?:string;alternateUrl?:string};
export const ROSTER_URL:string;
export const FEATURED_STREAMERS:ScheduleMember[];
export function parseActiveRoster(html:string):ScheduleMember[];
export function linkMembers(members:ScheduleMember[],overrides?:string):ScheduleMember[];
export function memberChannel(member:ScheduleMember):string;
export function memberSchedule(member:ScheduleMember):string;
