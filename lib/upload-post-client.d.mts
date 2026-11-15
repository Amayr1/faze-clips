export class PublishingError extends Error {status:number;constructor(status:number);}
export function uploadPostRequest(apiKey:string|undefined,path:string,body?:any,options?:{fetcher?:typeof fetch;idempotencyKey?:string}):Promise<any>;
