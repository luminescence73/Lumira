import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { commandDefinitions } from './command-schema.js';

const marker = '📚 **Lumira Commands**';
const excluded = new Set(['lumira-admin','lumira-control','lumira-channels','lumira-members','lumira-personality','lumira-copy']);
const hidden = {
  'lumira-lorebook': new Set(['review','reject','approve','remove']),
  'lumira-event': new Set(['schedule']),
  'lumira-studio': new Set(['dashboard']),
};
const groups = [
  ['📖 Lore & memories', ['lumira-lorebook','lumira-memory']],
  ['💬 Chat & privacy', ['lumira','lumira-forget','lumira-privacy']],
  ['📸 Scrapbook & profiles', ['lumira-scrapbook','lumira-profile','lumira-ego']],
  ['🎮 Games & fun', ['lumira-play']],
  ['🎨 Creative studio', ['lumira-studio']],
  ['🌙 Community', ['lumira-vibe','lumira-event']],
];
export function memberCommandPages() {
  const definitions = new Map(commandDefinitions().filter(c=>!excluded.has(c.name)).map(c=>[c.name,c]));
  const pages=[];
  for (const [heading,names] of groups) {
    const lines=[heading];
    for (const name of names) {
      const command=definitions.get(name);
      if (!command) continue;
      const options=command.options?.filter(o=>!hidden[name]?.has(o.name))||[];
      if (!options.length) lines.push('**/'+name+'**: '+command.description);
      else for(const sub of options)lines.push('**/'+name+' '+sub.name+'**: '+sub.description);
    }
    if (lines.length>1) pages.push(lines.join('\n'));
  }
  return pages.map((page,index)=>(index===0?marker+'\nUse these slash commands in LumiVibe. Some features require opt-in, permissions, or daily limits.\n\n':'')+page);
}
export async function publishMemberCommands(guild) {
  const channel=guild.channels.cache.find(c=>c.name==='lumira-commands'&&c.type===ChannelType.GuildText);
  if(!channel){console.warn('Lumira command directory: #lumira-commands not found');return;}
  const me=await guild.members.fetchMe();
  const perms=channel.permissionsFor(me);
  if(!perms?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory])) {
    console.warn('Lumira command directory: missing channel permissions');return;
  }
  const pages=memberCommandPages();
  const recent=await channel.messages.fetch({limit:100});
  const owned=[...recent.values()].filter(m=>m.author.id===guild.client.user.id&&(m.content.startsWith(marker)||m.content.startsWith('📖 Lore & memories')||m.content.startsWith('💬 Chat & privacy')||m.content.startsWith('📸 Scrapbook & profiles')||m.content.startsWith('🎮 Games & fun')||m.content.startsWith('🎨 Creative studio')||m.content.startsWith('🌙 Community'))).sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
  for(let index=0;index<pages.length;index++){
    if(owned[index]){if(owned[index].content!==pages[index])await owned[index].edit({content:pages[index],allowedMentions:{parse:[]}});}
    else await channel.send({content:pages[index],allowedMentions:{parse:[]}});
  }
  for(const extra of owned.slice(pages.length))await extra.delete();
  console.log('Lumira member command directory refreshed in #lumira-commands');
}
