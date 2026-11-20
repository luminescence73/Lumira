import sharp from 'sharp';
import { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
const escape = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const clean = (value, max = 140) =>
  escape(
    String(value ?? '')
      .replace(/[\r\n]+/g, ' ')
      .slice(0, max),
  );
export async function renderCard({ title, subtitle = '', lines = [], kind = 'card' }) {
  const rows = lines
    .slice(0, 5)
    .map(
      (line, i) =>
        '<text x="75" y="' + (315 + i * 66) + '" font-size="30" fill="#dceaff">' + clean(line) + '</text>',
    )
    .join('');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#10284f"/><stop offset=".55" stop-color="#4b4caa"/><stop offset="1" stop-color="#9a72bd"/></linearGradient></defs><rect width="900" height="700" rx="38" fill="url(#bg)"/><circle cx="790" cy="100" r="150" fill="#ffffff" opacity=".06"/><circle cx="80" cy="650" r="200" fill="#ffffff" opacity=".06"/><rect x="42" y="45" width="816" height="610" rx="30" fill="none" stroke="#c8dcff" stroke-opacity=".65" stroke-width="3"/><text x="74" y="125" font-size="28" fill="#b9e4ff">LUMIVIBE  •  ' +
    clean(kind.toUpperCase()) +
    '</text><text x="74" y="207" font-size="48" font-weight="bold" fill="#ffffff">' +
    clean(title, 31) +
    '</text><text x="75" y="260" font-size="28" fill="#d4e8ff">' +
    clean(subtitle, 48) +
    '</text>' +
    rows +
    '<text x="75" y="615" font-size="22" fill="#d5e9ff">✦ LUMIRA VISUAL STUDIO ✦</text></svg>';
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return new AttachmentBuilder(buffer, { name: 'lumira-card.png' });
}
export function studioBoard(g, settings, counts) {
  const embed = new EmbedBuilder()
    .setColor(0x83bafa)
    .setTitle('🦋 Lumira Studio Control Room')
    .setDescription('Private visual tools • generation requires an image provider')
    .addFields(
      { name: 'Photo Booth', value: settings.photoBooth ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Character Cards', value: settings.characterCards ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Collage Previews', value: settings.collages ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Image generation', value: counts.imageReady ? 'Configured' : 'Not configured', inline: true },
      { name: 'Daily image cap', value: String(counts.dailyLimit), inline: true },
      { name: 'Saved scrapbook moments', value: String(counts.moments), inline: true },
    );
  const keys = [
    ['photoBooth', 'Photo Booth'],
    ['characterCards', 'Character Cards'],
    ['collages', 'Collages'],
  ];
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        keys.map(([k, label]) =>
          new ButtonBuilder()
            .setCustomId('lumira:studio:' + k)
            .setLabel(label)
            .setStyle(settings[k] ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
      ),
    ],
    allowedMentions: { parse: [] },
  };
}
export async function generateImage(prompt) {
  const key = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw Error('Image generation API key not configured');
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'Create a single safe, original, beautiful digital illustration, no real people, no logos or copyrighted characters. ' +
                    prompt.slice(0, 500),
                },
              ],
            },
          ],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal: controller.signal,
      },
    );
    const json = await response.json();
    if (!response.ok)
      throw Error(
        'Image provider returned ' +
          response.status +
          ': ' +
          String(json.error?.message || 'unknown error').slice(0, 160),
      );
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) throw Error('Provider did not return an image');
    const bytes = Buffer.from(part.inlineData.data, 'base64');
    if (bytes.length > 8 * 1024 * 1024) throw Error('Image exceeded Discord upload limit');
    return new AttachmentBuilder(bytes, {
      name: 'lumira-photo.' + (part.inlineData.mimeType === 'image/jpeg' ? 'jpg' : 'png'),
    });
  } finally {
    clearTimeout(timer);
  }
}
