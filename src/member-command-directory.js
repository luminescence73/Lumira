import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { commandDefinitions } from './command-schema.js';

const marker = '📚 **Lumira Commands**';
const footerMarker = 'Lumira • Member command directory';
const excluded = new Set(['lumira-admin','lumira-control','lumira-channels','lumira-members','lumira-personality','lumira-copy']);
const hidden = {
  'lumira-lorebook': new Set(['review','reject']),
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
const concise = {
 'lumira':'Chat with Lumira','lumira-forget':'Clear recent chat',
 'lumira-lorebook joke':'Submit an inside joke','lumira-lorebook bond':'Submit friendship lore',
 'lumira-lorebook moment':'Submit a memory','lumira-lorebook history':'Submit server history',
 'lumira-lorebook browse':'Browse approved lore','lumira-lorebook search':'Find saved lore',
 'lumira-lorebook pending':'Check your pending approvals','lumira-lorebook approve':'Approve lore involving you',
 'lumira-lorebook remove':'Remove your own lore',
 'lumira-memory enable':'Enable personal memory','lumira-memory save':'Save a personal fact',
 'lumira-memory view':'See your memories','lumira-memory delete':'Delete one memory',
 'lumira-memory disable':'Erase and disable memory',
 'lumira-scrapbook save':'Save a public post','lumira-scrapbook list':'See saved posts',
 'lumira-scrapbook optout':'Stop automatic saves','lumira-scrapbook optin':'Allow automatic saves',
 'lumira-scrapbook remove':'Remove your saved post',
 'lumira-profile create':'Create or update your profile','lumira-profile view':'See your profile',
 'lumira-profile delete':'Delete your profile',
 'lumira-ego create':'Make an alter ego','lumira-ego view':'See your alter ego',
 'lumira-ego reset':'Reset your alter ego',
 'lumira-play rather':'Would You Rather','lumira-play trivia':'Trivia round',
 'lumira-play roulette':'Party prompt','lumira-play court':'Funny verdict',
 'lumira-play roast':'Friendly roast battle','lumira-play quote-add':'Submit a quote',
 'lumira-play who-said':'Who Said That?','lumira-play guess':'Guess the speaker',
 'lumira-play reveal':'Reveal the answer','lumira-play leaderboard':'Trivia rankings',
 'lumira-play award':'Give a silly award','lumira-play awards':'See recent awards',
 'lumira-studio photo':'Generate an image','lumira-studio character':'Character card',
 'lumira-studio collage':'Scrapbook collage',
 'lumira-vibe now':'Recent activity','lumira-vibe recap':'Community recap',
 'lumira-vibe gallery':'Memory gallery','lumira-event upcoming':'Upcoming events',
};
export function memberCommandPages() {
 const definitions=new Map(commandDefinitions().filter(c=>!excluded.has(c.name)).map(c=>[c.name,c]));
 return groups.map(([heading,names],index)=>{
  const embed=new EmbedBuilder().setColor(0x8db8ef).setTitle(heading)
   .setFooter({text:footerMarker+' • '+(index+1)+'/'+groups.length});
  if(index===0)embed.setDescription('🌙 **LumiVibe command guide**\nChoose a command below and type it in chat. Lore submissions wait for Lumi’s approval.');
  for(const name of names){
   const cmd=definitions.get(name);if(!cmd)continue;
   const options=cmd.options?.filter(o=>!hidden[name]?.has(o.name))||[];
   const lines=options.length?options.map(sub=>{
    const full=name+' '+sub.name;
    return '\`/'+full+'\`  '+(concise[full]||sub.description);
   }):['\`/'+name+'\`  '+(concise[name]||cmd.description)];
   embed.addFields({name:'✦ '+name.replace('lumira-','').replace(/^lumira$/,'chat').replace(/-/g,' ').toUpperCase(),value:lines.join('\n'),inline:false});
  }
  return {content:index===0?marker:'',embeds:[embed],allowedMentions:{parse:[]}};
 });
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
  const owned=[...recent.values()].filter(m=>m.author.id===guild.client.user.id&&(m.embeds.some(e=>e.footer?.text?.startsWith(footerMarker))||m.content.startsWith(marker)||m.content.startsWith('📖 Lore & memories')||m.content.startsWith('💬 Chat & privacy')||m.content.startsWith('📸 Scrapbook & profiles')||m.content.startsWith('🎮 Games & fun')||m.content.startsWith('🎨 Creative studio')||m.content.startsWith('🌙 Community'))).sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
  for(let index=0;index<pages.length;index++){
    if(owned[index]){await owned[index].edit(pages[index]);}
    else await channel.send(pages[index]);
  }
  for(const extra of owned.slice(pages.length))await extra.delete();
  console.log('Lumira member command directory refreshed in #lumira-commands');
}
