export function identity(value:any):string;
export function creatorNames(query:string,catalog?:any[]):string[];
export function searchOptions(params:URLSearchParams):{query:string;sort:string;time:string};
export function mergeSearchClips(clips:any[],sort?:string,now?:number):any[];
export function dedupeSearchClips(clips:any[]):any[];
export function decodeSearchCursor(value:string|null,options:any):{sources:{provider:string;channel:string;cursor:string}[];offset:number;creatorOnly?:boolean}|null;
export function encodeSearchCursor(options:any,sources:any[],offset:number,creatorOnly?:boolean):string;
