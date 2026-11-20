import { promises as fs } from 'node:fs';
import path from 'node:path';

export function jsonStore(filename) {
  const file = path.join(process.env.LUMIRA_DATA_DIR || '/data', filename);
  let writes = Promise.resolve();
  return {
    async load() {
      await writes.catch(() => {});
      let data;
      try {
        data = JSON.parse(await fs.readFile(file, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw new Error('Could not read ' + filename + ': ' + error.message, { cause: error });
      }
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw Error('Invalid JSON object in ' + filename);
      return data;
    },
    save(data) {
      const payload = JSON.stringify(data);
      const temporary = file + '.tmp';
      writes = writes
        .catch(() => {})
        .then(async () => {
          await fs.mkdir(path.dirname(file), { recursive: true });
          await fs.writeFile(temporary, payload, { mode: 0o600 });
          await fs.rename(temporary, file);
        });
      return writes;
    },
  };
}
