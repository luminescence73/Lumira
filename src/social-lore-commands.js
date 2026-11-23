import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';
import { jokes,histories,deleteJoke,deleteHistory } from './lore.js';
import { loreEntries,proposeLore,pendingLore,reviewLore,approveLore,rejectLore,deleteSocialLore } from './social-lore.js';
const safe={parse:[]};
export async function socialLoreCommand(i){
 if(!i.inGuild()||i.guildId!==LUMIVIBE_GUILD_ID)return i.reply({content:'LumiVibe only.',flags:MessageFlags.Ephemeral});
 const sub=i.options.getSubcommand();
 try{
  if(sub==='browse'||sub==='search'){
   const term=i.options.getString('query')||'';
   const legacy=[...jokes(i.guildId).map((e,n)=>({id:'legacy-joke-'+(n+1),kind:'joke',title:'Inside joke',text:e.text})),...histories(i.guildId).map((e,n)=>({id:'legacy-history-'+(n+1),kind:'history',title:'Server history',text:e.text}))].filter(e=>(e.title+' '+e.text).toLowerCase().includes(term.toLowerCase()));
   const entries=[...loreEntries(i.guildId,{term}),...legacy].slice(0,15);
   return i.reply({content:entries.length?'📖 **LumiVibe Lorebook**\n'+entries.slice(0,15).map(e=>'**'+e.title+'** ['+e.kind+'] ('+e.id+')\n'+e.text).join('\n\n'):'No matching approved lore yet.',flags:MessageFlags.Ephemeral,allowedMentions:safe});
  }
  const owner=i.guild.ownerId===i.user.id;
  if(sub==='review'){
   if(!owner)throw Error('Only Lumi can review all pending lore');
   const entries=reviewLore(i.guildId);
   return i.reply({content:entries.length?entries.slice(0,15).map(e=>e.id+' — '+e.title+' ['+e.kind+'] '+e.text+' | '+(e.members.every(m=>e.approved.includes(m))?'Ready for Lumi':'Waiting for participant')).join('\n').slice(0,1900):'No pending lore.',flags:MessageFlags.Ephemeral,allowedMentions:safe});
  }
  if(sub==='reject'){
   if(!owner)throw Error('Only Lumi can reject lore');
   await rejectLore(i.guildId,i.options.getString('id'));
   return i.reply({content:'Lore rejected.',flags:MessageFlags.Ephemeral});
  }
  if(sub==='pending'){
   const entries=pendingLore(i.guildId,i.user.id);
   return i.reply({content:entries.length?entries.map(e=>e.id+' — '+e.title+' ('+e.kind+')').join('\n'):'No entries awaiting your approval.',flags:MessageFlags.Ephemeral,allowedMentions:safe});
  }
  if(sub==='approve'){
   const published=await approveLore(i.guildId,i.options.getString('id'),i.user.id,owner);
   return i.reply({content:published?'Approved and published to the lorebook. 💙':'Your consent is saved. Waiting for Lumi’s approval.',flags:MessageFlags.Ephemeral});
  }
  if(sub==='remove'){
   const mod=owner;
   const id=i.options.getString('id');
   const legacy=id.match(/^legacy-(joke|history)-(\\d+)$/);
   if(legacy){
    if(!owner)throw Error('Only Lumi can remove legacy lore');
    if(legacy[1]==='joke')await deleteJoke(i.guildId,Number(legacy[2]));
    else await deleteHistory(i.guildId,Number(legacy[2]));
   }else await deleteSocialLore(i.guildId,id,i.user.id,mod);
   return i.reply({content:'Lore entry removed. 💙',flags:MessageFlags.Ephemeral});
  }
  const kind=['bond','joke','moment','history'].includes(sub)?sub:null;
  if(!kind)throw Error('Unknown lore command');
  const peer=i.options.getUser('friend');
  if(peer?.bot||peer?.id===i.user.id)throw Error('Choose another human member');
  const members=kind==='bond'?[i.user.id,peer?.id].filter(Boolean):peer?[i.user.id,peer.id]:[i.user.id];
  const {entry,pending}=await proposeLore(i.guildId,{kind,title:i.options.getString('title'),text:i.options.getString('description'),author:i.user.id,members});
  return i.reply({content:'Submitted for Lumi approval. ID: '+entry.id+(members.length>1?' Your friend must also approve their participation.':''),flags:MessageFlags.Ephemeral,allowedMentions:safe});
 }catch(e){return i.reply({content:e.message,flags:MessageFlags.Ephemeral,allowedMentions:safe})}
}
