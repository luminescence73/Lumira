import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { classifyEmojiBatch } from '../src/emoji-classifier.js';

test('visual batch carries image data only and matches returned indices to emoji IDs', async () => {
  const tile = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const items = ['a', 'b', 'c'].map((id) => ({
    emoji: { id, name: 'old_filename_' + id, imageURL: () => 'https://cdn.example/' + id },
  }));
  let requests = 0;
  const result = await classifyEmojiBatch(items, {
    key: 'test',
    request: async (url, options) => {
      if (!options.method) {
        if (url.endsWith('/b')) return new Response('', { status: 404 });
        return new Response(tile);
      }
      requests++;
      assert.ok(!options.body.includes('old_filename'));
      const parts = JSON.parse(options.body).contents[0].parts;
      assert.deepEqual(
        parts.filter((p) => p.text?.startsWith('Image ')).map((p) => p.text),
        ['Image 0.', 'Image 2.'],
      );
      assert.equal(parts.filter((p) => p.inlineData).length, 2);
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    { index: 2, category: 'object', subject: 'Red Cube', confidence: 0.98 },
                    { index: 0, category: 'icon', subject: 'Red Square', confidence: 0.99 },
                  ]),
                },
              ],
            },
          },
        ],
      });
    },
  });
  assert.equal(requests, 1);
  assert.equal(result.get('a').value.subject, 'red_square');
  assert.equal(result.get('c').value.subject, 'red_cube');
  assert.match(result.get('b').error.message, /HTTP 404/);
});
