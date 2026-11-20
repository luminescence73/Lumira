// Event delivery stays separate from Discord command and message handling.
export async function deliverEventReminders(client,{dueEvents,channelAllowed,publicSocialChannel}){
 try{
  for(const event of await dueEvents()){
   if(!channelAllowed(event.g,event.channel))continue;
   const channel=await client.channels.fetch(event.channel).catch(()=>null);
   if(channel&&publicSocialChannel(channel)&&channel.isTextBased()){
    await channel.send({content:'📅 **LumiVibe event:** '+event.title,allowedMentions:{parse:[]}});
   }
  }
 }catch(error){console.error('Event delivery:',error.message)}
}
