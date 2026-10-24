import { readdir, readFile, writeFile } from 'node:fs/promises';
import { postInstagram } from './instagram.mjs';
import { postTikTok } from './tiktok.mjs';

const DRY = process.argv.includes('--dry') || process.env.DRY_RUN === '1';
const MAX_LATE_HOURS = Number(process.env.MAX_LATE_HOURS ?? 12);
const QUEUE = new URL('../queue/', import.meta.url);
const STATE = new URL('../state/posted.json', import.meta.url);
const SENDERS = { instagram: postInstagram, tiktok: postTikTok };
const TYPES = ['carousel', 'image', 'video'];

function check(post) {
  if (!TYPES.includes(post.type)) return `unknown type "${post.type}"`;
  if (!Array.isArray(post.mediaUrls) || !post.mediaUrls.length) return 'no mediaUrls';
  if (post.mediaUrls.some((u) => !/^https:\/\//.test(u))) return 'mediaUrls must be public https URLs';
  if (post.type === 'carousel' && post.mediaUrls.length < 2) return 'carousel needs 2+ images';
  if (post.type !== 'carousel' && post.mediaUrls.length !== 1) return `${post.type} needs exactly 1 url`;
  if (!Array.isArray(post.platforms) || !post.platforms.every((p) => SENDERS[p])) return 'bad platforms';
  if (post.type === 'image' && post.platforms.includes('tiktok')) return 'single image to TikTok not supported, use a carousel';
  if (Number.isNaN(Date.parse(post.publishAt))) return 'bad publishAt';
  return null;
}

const state = JSON.parse(await readFile(STATE, 'utf8').catch(() => '{}'));
const dirs = (await readdir(QUEUE, { withFileTypes: true })).filter((d) => d.isDirectory());
const now = Date.now();
let failed = false;

for (const dir of dirs) {
  const post = JSON.parse(await readFile(new URL(`${dir.name}/post.json`, QUEUE), 'utf8'));
  if (post.approved !== true) { console.log(`skip ${dir.name}: not approved`); continue; }
  const problem = check(post);
  if (problem) { console.error(`BAD ${dir.name}: ${problem}`); failed = true; continue; }
  const due = Date.parse(post.publishAt);
  if (due > now) { console.log(`wait ${dir.name}: due ${post.publishAt}`); continue; }
  if (now - due > MAX_LATE_HOURS * 3600e3) { console.log(`stale ${dir.name}: over ${MAX_LATE_HOURS}h late, skipped`); continue; }

  for (const platform of post.platforms) {
    const key = `${dir.name}:${platform}`;
    if (state[key]) continue;
    if (DRY) { console.log(`DRY ${key}: would post ${post.type} (${post.mediaUrls.length} file/s)`); continue; }
    try {
      const id = await SENDERS[platform](post);
      state[key] = { at: new Date().toISOString(), id };
      await writeFile(STATE, JSON.stringify(state, null, 2) + '\n');
      console.log(`posted ${key} -> ${id}`);
    } catch (err) {
      console.error(`FAIL ${key}: ${err.message}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
