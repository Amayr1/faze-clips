import type {ScheduleMember} from './schedule-directory.mjs';
export type StreamEvent={id:string;memberId:string;provider:string;title:string;start:string;end:string|null;category:string;recurring:boolean;cancelled:boolean;url:string};
export type ScheduledMember=ScheduleMember & {channelUrl:string;scheduleUrl:string;status:string;live:boolean|null;liveTitle?:string;checkedAt?:string;source?:string;events:StreamEvent[];vacation:{start_time:string;end_time:string}|null};
export type ScheduleResponse={mode:string;start:string;checkedAt:string;connected:{twitch:boolean;youtube:boolean;publicCalendars:boolean};roster:{source:string;checkedAt:string;status:string}|null;members:ScheduledMember[]};
export class ScheduleError extends Error{status:number;}
export function scheduleWindow(params:URLSearchParams,now?:number):{mode:string;start:string;from:number;to:number};
export function createScheduleService(options:{env?:{TWITCH_CLIENT_ID?:string;TWITCH_CLIENT_SECRET?:string;YOUTUBE_API_KEY?:string;FAZE_TWITCH_CHANNELS?:string};snapshot:{members:ScheduleMember[];source:string;checkedAt:string};identities?:Record<string,string>;fetcher?:typeof fetch;now?:()=>number}):{get(params:URLSearchParams):Promise<ScheduleResponse>};
