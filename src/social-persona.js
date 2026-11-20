// Social tone changes by member; use IDs where supplied and display names only as fallback.
const BOYS = new Set(['237586130038423552', '1495189750162657400', '1272841728952369172']);
const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export function socialStyle({ userId, ownerId, displayName, username } = {}) {
  if (userId && userId === ownerId) return 'girls';
  if (BOYS.has(userId)) return 'diva';
  const names = [displayName, username].map(normalize);
  if (
    names.some((name) =>
      ['lumi', 'luminescence73', 'gracie', 'bgracie', 'moonie', 'moony', 'meatshieldmoonie'].includes(name),
    )
  )
    return 'girls';
  if (names.some((name) => ['shug', 'tee', 'mits', 'mitsuto', 'dante', 'megu', 'megumin'].includes(name)))
    return 'diva';
  return 'default';
}
export function socialDirection(member) {
  const mode = socialStyle(member);
  if (mode === 'girls')
    return 'SOCIAL TONE: With this member, be a warm, confident girls-girl: hype her up, show loyalty, share playful opinions and gentle humor. Do not blindly agree with harmful behavior or insult other people on her behalf. Keep the established Lumira voice.\n';
  if (mode === 'diva')
    return 'SOCIAL TONE: With this member, be an affectionate, witty diva: quick comebacks, dramatic flair, teasing and playful roasts. The banter is mutual, never cruel. Avoid sensitive traits, humiliation, or personal vulnerabilities. Back off if asked. Keep the established Lumira voice.\n';
  return '';
}
export function playfulActivity(text) {
  const s = String(text || '')
    .trim()
    .toLowerCase();
  if (/^(?:roast battle|roast me|battle me|roast off)[.!? ]*$/.test(s))
    return 'INTERACTIVE MINI-GAME: Start a friendly roast battle. Deliver ONE short playful roast (no sensitive traits) and invite a comeback. Keep it under 180 characters.\n';
  if (/^(?:diva verdict|judge this|your verdict)[.!? ]*$/.test(s))
    return 'INTERACTIVE MINI-GAME: Invite the member to share a silly low-stakes dilemma for a dramatic diva verdict. One short sentence.\n';
  if (/^(?:group challenge|give us a challenge|party prompt)[.!? ]*$/.test(s))
    return 'INTERACTIVE MINI-GAME: Give the group ONE fun, opt-in, harmless chat challenge or question. Avoid pressure, personal disclosures, or pinging members.\n';
  return '';
}

const roastFriends = [
  { name: 'Tee', aliases: ['tee'] },
  { name: 'Shug', aliases: ['shug'] },
  { name: 'Mitsuto', id: '1495189750162657400', aliases: ['mitsuto', 'mits'] },
  { name: 'Megu', id: '237586130038423552', aliases: ['megu', 'megumin'] },
  { name: 'Dante', id: '1272841728952369172', aliases: ['dante'] },
  { name: 'Kiz', id: '224399760616980481', aliases: ['kiz'] },
];

const roastRequest =
  /^(?:(?:please|can you|could you|would you|will you|just|girl)[\s,]+)*(?:roast|make fun of|tease|drag|insult|clown on)\s+(?:@?(?<name>[a-z][a-z0-9_]*)(?![a-z0-9_])|<@!?(?<id>\d+)>)/i;

export function friendRoastTarget(prompt, mentions, members) {
  const { id, name } = roastRequest.exec(prompt)?.groups || {};
  if (!id && !name) return null;
  const user = id ? mentions?.get(id) : null;
  const labels = id
    ? [members?.get(id)?.displayName, user?.globalName, user?.username].map(normalize)
    : [normalize(name)];
  const friend =
    (id && roastFriends.find((entry) => entry.id === id)) ||
    roastFriends.find((entry) => (!id || !entry.id) && entry.aliases.some((alias) => labels.includes(alias)));
  if (!friend) return null;
  const member =
    !id && !friend.id
      ? members?.find?.((candidate) =>
          [candidate.displayName, candidate.user?.username, candidate.user?.globalName]
            .map(normalize)
            .some((label) => friend.aliases.includes(label)),
        )
      : null;
  return { name: friend.name, id: id || friend.id || member?.id };
}
