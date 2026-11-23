import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';
import { jokes,histories,deleteJoke,deleteHistory } from './lore.js';
import { loreEntries,proposeLore,pendingLore,reviewLore,approveLore,rejectLore,deleteSocialLore } from './social-lore.js';
const safe={parse:[]};

function reviewCard(entry,owner=false){
 const status=entry.members.every(m=>entry.approved.includes(m))?'Ready for Lumi':'Waiting for participant consent';
 const controls=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('lumira:lore:approve:'+entry.id).setLabel('Approve').setStyle(ButtonStyle.Success).setDisabled(owner&&status!=='Ready for Lumi'),
  new ButtonBuilder().setCustomId('lumira:lore:dismiss:'+entry.id).setLabel(owner?'Reject':'Dismiss').setStyle(ButtonStyle.Danger));
 return {content:'📖 **'+entry.title+'** · '+entry.kind+'\n'+entry.text+'\n\nSubmitted by <@'+entry.author+'>\n'+(owner?status:'Your approval is requested'),components:[controls],allowedMentions:safe};
}
async function showReviewCards(i,entries,heading,owner=false){
 if(!entries.length)return i.reply({content:'No pending lore to review. 💙',flags:MessageFlags.Ephemeral});
 await i.reply({content:heading+' ('+entries.length+')\nEach submission is shown separately with its own buttons.',flags:MessageFlags.Ephemeral});
 for(const entry of entries.slice(0,10))await i.followUp({...reviewCard(entry,owner),flags:MessageFlags.Ephemeral});
 if(entries.length>10)await i.followUp({content:'Showing the first 10. Review these, then run the command again for more.',flags:MessageFlags.Ephemeral});
}
export async function socialLoreButton(i){
 if(!i.inGuild()||i.guildId!==LUMIVIBE_GUILD_ID)return i.reply({content:'LumiVibe only.',flags:MessageFlags.Ephemeral});
 const [, ,action,id]=i.customId.split(':');
 const owner=i.guild.ownerId===i.user.id;
 if(!['approve','dismiss'].includes(action)||!id)return i.reply({content:'Invalid review button.',flags:MessageFlags.Ephemeral});
 try{
  const entry=(owner?reviewLore(i.guildId):pendingLore(i.guildId,i.user.id)).find(e=>e.id===id);
  if(!entry)return i.reply({content:'This entry is no longer awaiting your review.',flags:MessageFlags.Ephemeral});
  if(action==='dismiss'){
   if(owner)await rejectLore(i.guildId,id);
   else await deleteSocialLore(i.guildId,id,i.user.id);
   return i.update({content:'❌ '+(owner?'Rejected':'Dismissed')+': '+entry.title,components:[],allowedMentions:safe});
  }
  const published=await approveLore(i.guildId,id,i.user.id,owner);
  return i.update({content:published?'✅ Published: '+entry.title:'✅ Your consent was saved. Waiting for Lumi: '+entry.title,components:[],allowedMentions:safe});
 }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral})}
}

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
   return showReviewCards(i,reviewLore(i.guildId),'📬 **Lumi’s lore approval queue**',true);
  }
  if(sub==='reject'){
   if(!owner)throw Error('Only Lumi can reject lore');
   await rejectLore(i.guildId,i.options.getString('id'));
   return i.reply({content:'Lore rejected.',flags:MessageFlags.Ephemeral});
  }
  if(sub==='pending'){
   return showReviewCards(i,pendingLore(i.guildId,i.user.id),'📬 **Your pending lore requests**');
  }
  if(sub==='approve'){
   const published=await approveLore(i.guildId,i.options.getString('id'),i.user.id,owner);
   return i.reply({content:published?'Approved and published to the lorebook. 💙':'Your consent is saved. Waiting for Lumi’s approval.',flags:MessageFlags.Ephemeral});
  }
  if(sub==='remove'){
   const mod=owner;
   const id=i.options.getString('id');
   const legacy=id.match(/^legacy-(joke|history)-([0-9]+)$/);
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
  return i.reply({content:'📬 Submitted for Lumi’s approval.'+(members.length>1?' Your friend will also need to approve their participation using the pending review buttons.':''),flags:MessageFlags.Ephemeral,allowedMentions:safe});
 }catch(e){return i.reply({content:e.message,flags:MessageFlags.Ephemeral,allowedMentions:safe})}
}
