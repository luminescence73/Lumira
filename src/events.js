import {promises as fs} from 'node:fs';
import path from 'node:path';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','events.json');let db={},queue=Promise.resolve();
export async function loadEvents(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}console.log('Lumira events ready')}
const state=g=>db[g]||(db[g]={events:[]});
async function save(){const data=JSON.stringify(db);queue=queue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',data,{mode:0o600});await fs.rename(file+'.tmp',file)});await queue}
export async function schedule(g,channel,title,when){if(!Number.isFinite(when)||when<Date.now()+60000||when>Date.now()+90*86400000)throw Error('Choose a time 1 minute to 90 days in the future');const s=state(g);if(s.events.filter(e=>!e.sent).length>=10)throw Error('Maximum 10 pending events');s.events.push({channel,title:title.slice(0,80),when,sent:false});await save()}
export function upcoming(g){return state(g).events.filter(e=>!e.sent&&e.when>Date.now()).sort((a,b)=>a.when-b.when).slice(0,10)}
export async function dueEvents(){const due=[];for(const [g,s] of Object.entries(db)){for(const e of s.events||[]){if(!e.sent&&e.when<=Date.now()){e.sent=true;due.push({g,...e})}}s.events=(s.events||[]).filter(e=>e.when>Date.now()-7*86400000)}if(due.length)await save();return due}
