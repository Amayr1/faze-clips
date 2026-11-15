export const TIMELINE_URL:string;
export const STORE_URL:string;
export const SPOTLIGHT:{id:string;title:string;subtitle:string;description:string};
export const ERAS:{id:string;year:string;label:string;title:string;description:string;context:string;videoId:string;videoTitle:string;date:string;tag:string;audience:string}[];
export function archiveClip(era:any):any;
export function isSpotlight(value:unknown):boolean;
