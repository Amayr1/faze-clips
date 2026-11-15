export class CommentError extends Error {status:number;constructor(status:number,message:string);}
export function validateClipId(value:unknown):string;
export function validateComment(value:unknown):string;
export function readCommentJson(request:Request):Promise<any>;
export function createCommentService(options:{database:()=>any;now?:()=>number;uuid?:()=>string}):{
 list(clipId:string,userId?:string,before?:string|null):Promise<any>;
 add(user:{userId:string;fullName?:string|null},clip:any,text:unknown):Promise<any>;
 remove(userId:string,id:string):Promise<boolean>;
};
