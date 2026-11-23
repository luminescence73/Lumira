const options = { allowedMentions: { parse: [] } };

export async function fetchProfilePost(channel, id) {
  if (!id) return null;
  try {
    return await channel.messages.fetch(id);
  } catch (error) {
    if (error.code === 10008) return null;
    throw error;
  }
}

export async function putProfilePost(channel, post, embed) {
  const payload = { ...options, embeds: [embed] };
  if (post) {
    if (post.author?.id !== channel.client.user.id) throw Error('Stored profile message is not owned by Lumira');
    await post.edit(payload);
    return post;
  }
  return channel.send(payload);
}

export async function deleteProfilePost(channel, id) {
  const post = await fetchProfilePost(channel, id);
  if (!post) return;
  if (post.author?.id !== channel.client.user.id) throw Error('Stored profile message is not owned by Lumira');
  await post.delete();
}
