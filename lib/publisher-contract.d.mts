export const NETWORKS: readonly ['instagram','tiktok','youtube','facebook'];
export function publishForm(post:any,targets:string[],video:Blob,caption:string,origin:string,username:string,requestId:string):FormData;
export function publicationResult(data:any,platform:string):{status:string;url:string|null;message:string|null};
export function extractMetrics(data:any,platform:string):{likes:number|null;views:number|null};
export function connectedAccounts(profile:any):{platform:string;name:string}[];
export function linkingUrl(value:string):string;
