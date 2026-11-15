export function dayKey(value:string|number|Date,zone:string):string;
export function shiftDay(key:string,days:number):string;
export function weekStart(value:string|number|Date,zone:string):string;
export function calendarFile(event:{id:string;title:string;start:string;end?:string|null;url:string;cancelled?:boolean},member:{name:string},now?:number):string;
