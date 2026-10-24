// Weekly local scheduler. Reads week/<name>/post.json, schedules each approved post in the platforms' own schedulers.
// Default is a dry run (stops before the final Schedule click). Add --go to really schedule.
// post.json: { approved, type: carousel|image, platforms: ["instagram","tiktok"], publishAt (ISO), caption, files: [relative paths] }
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch } from './browser.mjs';
import { scheduleInstagram } from './meta.mjs';
import { scheduleTikTok } from './tiktok-studio.mjs';
import { metaSlots, tiktokSlots, slotKey } from './existing.mjs';
import { ukParts } from './meta.mjs';

const GO = process.argv.includes('--go');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const WEEK = fileURLToPath(new URL('../week/', import.meta.url));
const STATE = fileURLToPath(new URL('../week/scheduled.json', import.meta.url));
const SENDERS = { instagram: scheduleInstagram, tiktok: scheduleTikTok };

const TAKEN = { instagram: metaSlots, tiktok: tiktokSlots };
const taken = {};
const state = JSON.parse(await readFile(STATE, 'utf8').catch(() => '{}'));
const dirs = (await readdir(WEEK, { withFileTypes: true })).filter((d) => d.isDirectory() && (!ONLY || d.name === ONLY));
const ctx = await launch({ headless: true });
let failed = false;

for (const d of dirs) {
  const post = JSON.parse(await readFile(path.join(WEEK, d.name, 'post.json'), 'utf8'));
  if (post.approved !== true) { console.log(`skip ${d.name}: not approved`); continue; }
  if (Date.parse(post.publishAt) < Date.now() + 15 * 60e3) { console.log(`skip ${d.name}: publishAt is in the past or under 15 min away`); continue; }
  post.files = post.files.map((f) => path.resolve(WEEK, d.name, f));
  for (const platform of post.platforms) {
    const key = `${d.name}:${platform}`;
    if (state[key]) { console.log(`done already ${key}`); continue; }
    const send = SENDERS[platform];
    if (!send) { console.log(`skip ${key}: no scheduler built for ${platform} yet`); continue; }
    try {
      // never double-book: read what the platform already has scheduled, skip an occupied slot
      taken[platform] ??= await TAKEN[platform](ctx);
      const slot = slotKey(ukParts(new Date(post.publishAt)));
      if (taken[platform].has(slot)) { console.log(`skip ${key}: ${platform} already has something at ${slot}`); continue; }
      const res = await send(ctx, post, { go: GO });
      console.log(`${GO ? 'SCHEDULED' : 'DRY'} ${key}`, JSON.stringify(res));
      if (GO && res.scheduled) { taken[platform].add(slot); state[key] = { at: new Date().toISOString(), publishAt: post.publishAt }; await writeFile(STATE, JSON.stringify(state, null, 2)); }
    } catch (e) {
      console.error(`FAIL ${key}: ${e.message.split('\n')[0]}`);
      failed = true;
    }
  }
}
await ctx.close();
process.exit(failed ? 1 : 0);
