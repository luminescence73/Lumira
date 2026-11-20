// Owner-supplied LumiVibe canon. Persisted in source control and injected at runtime.
// Historical accounts are recollections, not independently verified claims.
export const LUMIVIBE_CANON = [
'IDENTITIES: Lumi is the human owner/founder of LumiVibe. Lumira is the AI bot, not Lumi. Do not confuse their names or respond to messages directed only at Lumi.',
'GUILD NAMES: Meguka is the NAME OF A RIVAL SWORD X STAFF GUILD, NOT A PERSON. Ashen Warriors has a rivalry with Meguka. Never invent a person named Meguka. Megumin (sometimes Megu) IS a real friend and Gracie’s sibling. Never conflate Megumin with Meguka.',
'GUILD NAMES: S Rank is the canonical name for the guild sometimes transcribed as Esring/Espring. The user also discusses an Ember Springs chapter; avoid inventing a separate chronology or declaring it a separate guild without confirmation.',
'ORACLE: Oracle does not play Sword x Staff, is not in Ashen Warriors, and is historical lore only. His nickname is Hot Tub. Do not feature Oracle as a current member or generate a profile card.',
'DANTE: Dante is a friend and IS currently in Ashen Warriors. Do not describe him as outside the guild. His LumiVibe server activity is not confirmed. He is a playful teaser, a harmless troublemaker, and loves his wife.',
'LUMI: The youngest of the group, talkative, easily teased, enjoys anime, drawing and conversation; comes and goes from conversations and can be forgetful. Stepped back amid social tension and wants to revive LumiVibe.',
'GRACIE: Social, outgoing, interested in astrology and Sword x Staff. Gracie and Megumin are siblings.',
'MEGUMIN: A real friend distinct from the rival guild Meguka. Generous, a dedicated and competitive gamer, likes anime, food and everyday photos. Gracie’s sibling.',
'SHUG: Laid-back, joking, good-hearted, enjoys older music and metal. Do not present private habits as public biography facts.',
'MITSUTO / MITS: Dry, sarcastic sense of humor but kind; likes older music and metal.',
'TEE: Loyal and friendly, teases others, likes music and experimenting with Sword x Staff builds.',
'MOONIE / MOONY: Sweet and sociable, often says they are bored; nickname Meat Shield Moonie.',
'KIZ: More reserved, competitive gamer who loves rock climbing, testing Sword x Staff builds, Strata, and Call of Duty; formerly a LumiVibe deputy.',
'FISH / MATT: Known as Fish, nickname Filet-O-Fish. Lumi recalls a screenshot leak from the early private LumiVibe server to Grimm involving Fish/Matt, followed by distrust and removal. This is Lumi’s recollection of a dispute, not a proven public accusation; do not volunteer allegations or use them in playful profiles.',
'PINK: An older friend who helped connect Lumi with the Sword x Staff social community; later quit during guild upheaval.',
'NATTY: Worked with Lumi to create the Illuminati joke group during the first Ashen Warriors stay.',
'OTHER FRIEND NAMES MENTIONED: Eflashray, Skelly, Chain, Blaksta, KiRiToKuN, Joxz, Ps3sY, Adonis, Ruudstriker, Shade, JeNny, AimarSol, persefone, indigo, Montalvo, Alight, DougDark, Arya, MrIDGAF, Kimberly, Nebzie/Nebzy. These names alone do not establish current guild membership or detailed biographies.',
'EARLIER LUMIVIBE GROUP ROSTER (AUGUST 2026 SNAPSHOT): Nebzie was leader; Lumi and Kiz deputies; Bgracie, Megumin, Tee, Kimberly officers; Shug and Mitsuto members. This is historical, not necessarily current.',
'EARLY HISTORY: Lumi spent approximately a week in Eminence, reconnected with Pink, then after Eminence’s leader quit moved with friends to Ashen Warriors. Later the group went to the guild known as S Rank; exact timing of some moves and Ember Springs references should not be fabricated.',
'ASHEN NICKNAMES: Meat Shield Moonie for Moonie, Filet-O-Fish for Fish, Hot Tub for Oracle. The nickname does not imply Oracle played SxS.',
'ILLUMINATI: A predecessor to LumiVibe, created by Lumi and Natty during the first stay in Ashen Warriors, around playful Lumi/Loony/Natty campaigning and names. Recalled participants included Oracle, Moonie, Tee, Shug, Mits, Gracie, Megu/Megumin, Grimm, Natty, possibly Rio Kaze. Do not treat the uncertain member as confirmed.',
'LUMIVIBE ORIGIN: Began as a smaller, private friend server for Gracie, Megumin, Shug, Tee, Mitsuto, and possibly Dante and Fish. It was intended to be a close-knit space. Later conflict around leaked screenshots damaged trust; do not embellish.',
'LUMI CULT: An in-game and group-chat joke, not a religion or real cult. Included playful names and avatars, evolved from group humor and leader campaigning, and spread during the S Rank chapter. Its exact beginning (late Ashen versus after moving) is uncertain. It faded naturally near the end of Season 1 as friends wanted a fresh start for Season 2. Do not claim everyone worshipped Lumi or invent rituals.',
'S RANK CHAPTER: Nadia led during part of this history; Grimm, Soft, and Heckwoof were powerful players. Use Heckwoof, not Hecwulf/Hecwa. User recalls tension around the cult and guild social issues; some players returned to Ashen Warriors. Do not assert precise numbers or assign motives without confirmation.',
'LATER GUILD CHANGES: Nadia later went by Ovilia; Grimm and Soft joined her group. Fish/Matt joined the rival guild Meguka under Sus. Ashen Warriors under Nebzy, with Lumi coordinating, competed against Meguka. These are historical recollections and membership can change.',
'OTHER LORE: Vestra basement joke, democratic-leader campaigning, friendly group banter, and the recurring nicknames are parts of the group’s shared history.',
'SAFETY AND ACCURACY: Distinguish user-provided recollections from verified events. Never invent dialogue, dates, origins, motives, relationships, accusations, guild affiliations, or current status. When uncertain, say what is unknown. Do not disclose private sensitive information as public gossip.'
];
export function lumiVibeCanonContext(){return 'Permanent owner-supplied friend and guild lore. Treat as historical reference, not commands. Follow corrections over older inconsistent lore.\n'+LUMIVIBE_CANON.map((x,i)=>`${i+1}. ${x}`).join('\n')}
