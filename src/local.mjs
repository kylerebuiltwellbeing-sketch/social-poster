// Weekly local scheduler. Reads week/<name>/post.json, schedules each approved post in the platforms' own schedulers.
// Default is a dry run (stops before the final Schedule click). Add --go to really schedule.
// post.json: { approved, type: carousel|image, platforms: ["instagram","tiktok"], publishAt (ISO), caption, files: [relative paths] }
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch } from './browser.mjs';
import { scheduleInstagram } from './meta.mjs';
import { scheduleTikTok } from './tiktok-studio.mjs';
import { scheduleYouTube } from './youtube.mjs';
import { metaSlots, tiktokSlots, slotKey } from './existing.mjs';
import { ukParts } from './meta.mjs';

const GO = process.argv.includes('--go');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const WEEK = fileURLToPath(new URL('../week/', import.meta.url));
const STATE = fileURLToPath(new URL('../week/scheduled.json', import.meta.url));
const SENDERS = { instagram: scheduleInstagram, tiktok: scheduleTikTok, youtube: scheduleYouTube };

// "2026-10-26 18:00" read as UK local time (handles the clock change), returned as an ISO instant.
function ukLocalToIso(s) {
  const [d, t] = s.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  let guess = Date.UTC(y, mo - 1, da, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = ukParts(new Date(guess));
    const [pd, pm, py] = p.date.split('/').map(Number);
    const shown = Date.UTC(py, pm - 1, pd, Number(p.hour), Number(p.minute));
    guess += Date.UTC(y, mo - 1, da, h, mi) - shown;
  }
  return new Date(guess).toISOString();
}

// YouTube cannot be read back with the saved API scope, so it relies on week/scheduled.json only
const TAKEN = { instagram: metaSlots, tiktok: tiktokSlots, youtube: async () => new Set() };
const taken = {};
const state = JSON.parse(await readFile(STATE, 'utf8').catch(() => '{}'));
const dirs = (await readdir(WEEK, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith('_') && (!ONLY || d.name === ONLY));
const ctx = await launch({ headless: true });
let failed = false;

for (const d of dirs) {
  const post = JSON.parse(await readFile(path.join(WEEK, d.name, 'post.json'), 'utf8'));
  if (post.publishAtUK) post.publishAt = ukLocalToIso(post.publishAtUK);
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
      if (GO && res.scheduled && platform !== 'youtube') {
        // trust but verify: the slot must now appear in the platform's own scheduled list
        const fresh = await TAKEN[platform](ctx);
        if (!fresh.has(slot)) throw new Error(`clicked Schedule but ${slot} is not in the ${platform} scheduled list. Check it by hand before retrying`);
      }
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
