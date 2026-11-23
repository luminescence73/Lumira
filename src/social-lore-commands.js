import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';
import { loreEntries,proposeLore,pendingLore,approveLore,deleteSocialLore } from './social-lore.js';
const safe={parse:[]};

function reviewCard(entry){
 return {content:'📖 **'+({joke:'Inside Joke',bond:'Friendship Dynamic',moment:'Server Moment'}[entry.kind]||'Lore')+' awaiting review**\n**'+entry.title+'**\n'+entry.text+'\n\nSubmitted by <@'+entry.author+'>',
 components:[new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('lumira:lore:approve:'+entry.id).setLabel('Approve').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('lumira:lore:dismiss:'+entry.id).setLabel('Dismiss').setStyle(ButtonStyle.Danger))],
 allowedMentions:safe};
}
export async function socialLoreButton(i){
 if(!i.inGuild()||i.guildId!==LUMIVIBE_GUILD_ID)return i.reply({content:'LumiVibe only.',flags:MessageFlags.Ephemeral});
 const [, ,action,id]=i.customId.split(':');
 if(!['approve','dismiss'].includes(action)||!id)return i.reply({content:'Invalid lore review.',flags:MessageFlags.Ephemeral});
 try{
  const entry=pendingLore(i.guildId,i.user.id).find(e=>e.id===id);
  if(!entry)return i.reply({content:'This review is no longer pending for you.',flags:MessageFlags.Ephemeral});
  if(action==='approve'){
   const published=await approveLore(i.guildId,id,i.user.id);
   return i.update({content:published?'✅ Approved and added to the lorebook: '+entry.title:'✅ Your approval was recorded: '+entry.title,components:[],allowedMentions:safe});
  }
  await deleteSocialLore(i.guildId,id,i.user.id);
  return i.update({content:'❌ Dismissed: '+entry.title,components:[],allowedMentions:safe});
 }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral})}
}
export async function socialLoreCommand(i){
 if(!i.inGuild()||i.guildId!==LUMIVIBE_GUILD_ID)return i.reply({content:'LumiVibe only.',flags:MessageFlags.Ephemeral});
 const sub=i.options.getSubcommand();
 try{
  if(sub==='browse'||sub==='search'){
   const entries=loreEntries(i.guildId,{term:i.options.getString('query')||''});
   return i.reply({content:entries.length?'📖 **LumiVibe Lorebook**\n'+entries.slice(0,10).map(e=>'**'+e.title+'** ['+e.kind+'] ('+e.id+')\n'+e.text).join('\n\n'):'No matching approved lore yet.',flags:MessageFlags.Ephemeral,allowedMentions:safe});
  }
  if(sub==='pending'){
   const entries=pendingLore(i.guildId,i.user.id);
   if(!entries.length)return i.reply({content:'No entries awaiting your approval. 💙',flags:MessageFlags.Ephemeral});
   await i.reply({content:'📬 **Pending lore reviews** ('+entries.length+')\nEach submission has its own buttons below.',flags:MessageFlags.Ephemeral});
   for(const entry of entries.slice(0,10))await i.followUp({...reviewCard(entry),flags:MessageFlags.Ephemeral});
   if(entries.length>10)await i.followUp({content:'Showing 10 reviews. Run /lumira-lorebook pending again after reviewing.',flags:MessageFlags.Ephemeral});
   return;
  }
  if(sub==='approve'){
   const published=await approveLore(i.guildId,i.options.getString('id'),i.user.id);
   return i.reply({content:published?'Approved and published to the lorebook. 💙':'Approved. Waiting for the other participant.',flags:MessageFlags.Ephemeral});
  }
  if(sub==='remove'){
   const mod=i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)||i.guild.ownerId===i.user.id;
   await deleteSocialLore(i.guildId,i.options.getString('id'),i.user.id,mod);
   return i.reply({content:'Lore entry removed. 💙',flags:MessageFlags.Ephemeral});
  }
  const kind=sub==='bond'?'bond':sub==='joke'?'joke':'moment';
  const peer=i.options.getUser('friend');
  if(peer?.bot||peer?.id===i.user.id)throw Error('Choose another human member');
  const members=kind==='bond'?[i.user.id,peer?.id].filter(Boolean):peer?[i.user.id,peer.id]:[i.user.id];
  const {entry,pending}=await proposeLore(i.guildId,{kind,title:i.options.getString('title'),text:i.options.getString('description'),author:i.user.id,members});
  return i.reply({content:pending?'Saved as a private proposal. Your friend must use /lumira-lorebook pending and approve with ID '+entry.id+' before it appears.':'Added to the LumiVibe Lorebook! 💙',flags:MessageFlags.Ephemeral,allowedMentions:safe});
 }catch(e){return i.reply({content:e.message,flags:MessageFlags.Ephemeral,allowedMentions:safe})}
}
