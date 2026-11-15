export class FanError extends Error{status:number;constructor(status:number,message:string);}
export function createFanService(options:{database:()=>any;now?:()=>number;uuid?:()=>string}):{
 profile(owner?:string):Promise<{audience:string;savedEras:string[]}>;
 audience(owner:string,audience:unknown):Promise<any>;
 era(owner:string,id:unknown,saved:unknown):Promise<any>;
 event(owner:string,kind:unknown,item:unknown):Promise<{ok:boolean;id:string}>;
 partnership(owner:string,values:any):Promise<{ok:boolean;id:string}>;
 pulse():Promise<any>;
 spotlight(userId?:string):Promise<any[]>;
};
