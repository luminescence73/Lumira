import { jsonStore } from './json-store.js';
const store=jsonStore('social-lore.json');
let db={};
const norm=s=>String(s||'').trim().replace(/\s+/g,' ');
const state=g=>db[g]||(db[g]={entries:[],requests:[]});
export async function loadSocialLore(){db=await store.load()}
export function loreEntries(g,{term='',kind='',memberId=''}={}){
 const q=norm(term).toLowerCase();
 return state(g).entries.filter(e=>(!kind||e.kind===kind)&&(!memberId||e.members.includes(memberId))&&(!q||(e.title+' '+e.text).toLowerCase().includes(q))).slice(-30).reverse();
}
export function socialLoreContext(g,memberId){
 return loreEntries(g,{memberId}).slice(0,4).map(e=>e.kind+': '+e.title+' — '+e.text.slice(0,180)).join('\n');
}
export async function proposeLore(g,{kind,title,text,author,members=[]}){
 if(!['joke','bond','moment','history'].includes(kind))throw Error('Unknown lore type');
 title=norm(title);text=norm(text);
 if(title.length<3||title.length>70||text.length<8||text.length>400)throw Error('Title 3–70 characters and description 8–400 characters required');
 const ids=[...new Set(members.filter(Boolean))];
 if(ids.length>2)throw Error('At most two people per entry');
 if(kind==='bond'&&ids.length!==2)throw Error('Friendship entries require two members');
 if(state(g).entries.some(e=>e.kind===kind&&e.title.toLowerCase()===title.toLowerCase()))throw Error('That entry already exists');
 const entry={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),kind,title,text,author,members:ids,at:Date.now()};
 // Every submission waits for explicit owner approval.
 state(g).requests.push({...entry,approved:[author]});
 state(g).requests=state(g).requests.slice(-150);
 await store.save(db);return {entry,pending:true};
}
export function reviewLore(g){return state(g).requests.slice().reverse()}
export async function rejectLore(g,id){const s=state(g);if(!s.requests.some(e=>e.id===id))throw Error('Entry not found');s.requests=s.requests.filter(e=>e.id!==id);await store.save(db)}
export function pendingLore(g,user){return state(g).requests.filter(e=>e.members.includes(user)&&!e.approved.includes(user))}
export async function approveLore(g,id,user,owner=false){
 const s=state(g),r=s.requests.find(e=>e.id===id);
 if(!r)throw Error('No pending entry with that ID');
 if(owner){
  if(!r.members.every(m=>r.approved.includes(m)))throw Error('Waiting for participant approval');
  s.requests=s.requests.filter(e=>e.id!==id);delete r.approved;s.entries.push(r);s.entries=s.entries.slice(-150);await store.save(db);return true;
 }
 if(!r.members.includes(user)||r.approved.includes(user))throw Error('No pending entry for you');
 r.approved.push(user);
 
 await store.save(db);return false;
}
export async function deleteSocialLore(g,id,user,moderator=false){
 const s=state(g);const e=[...s.entries,...s.requests].find(x=>x.id===id);
 if(!e)throw Error('Entry not found');
 if(!moderator&&e.author!==user&&!e.members.includes(user))throw Error('Only a participant or moderator may remove this');
 s.entries=s.entries.filter(x=>x.id!==id);s.requests=s.requests.filter(x=>x.id!==id);await store.save(db);
}
