export const PROVIDER:'upload-post';
export function createPublisherService(dependencies:{database:()=>any;bucket:()=>any;configured:()=>boolean;request:(path:string,body?:any,idempotencyKey?:string)=>Promise<any>}):{
 linkedAccounts(userId:string):Promise<{platform:string;name:string}[]>;
 linkSession(userId:string,origin:string):Promise<string>;
 dispatchPost(userId:string,postId:string,targets:string[],caption:string,origin:string):Promise<{status:string}>;
 syncPublications(userId:string):Promise<{ok:boolean;checked:number;unavailable:number}>;
};
