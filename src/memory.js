import { promises as fs } from 'node:fs';
import path from 'node:path';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','memories.json');
let records={};
let queue=Promise.resolve();
export async function loadMemories(){
 try{records=JSON.parse(await fs.readFile(file,'utf8'));if(!records||typeof records!=='object'||Array.isArray(records))throw Error('Invalid memory store');console.log('Opt-in memory store loaded')}catch(e){if(e.code==='ENOENT'){records={};console.log('Opt-in memory store initialized')}else{console.error('Memory store unavailable:',e.message);throw e}}
}
function id(guild,user){return guild+':'+user}
export function memoryStatus(guild,user){const r=records[id(guild,user)];return {enabled:r?.enabled===true,items:Array.isArray(r?.items)?r.items:[]}}
async function persist(){
 const data=JSON.stringify(records);
 queue=queue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,data,{mode:0o600});await fs.rename(tmp,file)});
 return queue;
}
export async function enableMemory(guild,user){const k=id(guild,user);records[k]={enabled:true,items:records[k]?.items||[]};await persist()}
export async function saveMemory(guild,user,note){const k=id(guild,user);if(records[k]?.enabled!==true)throw Error('Memory is not enabled');const items=records[k].items||[];if(items.length>=15)throw Error('Memory limit reached (15). Delete a memory first.');items.push(note);await persist()}
export async function removeMemory(guild,user,index){const k=id(guild,user);if(records[k]?.enabled!==true)throw Error('Memory is not enabled');if(!Number.isInteger(index)||index<1||index>records[k].items.length)throw Error('Memory number not found');records[k].items.splice(index-1,1);await persist()}
export async function disableMemory(guild,user){delete records[id(guild,user)];await persist()}
