// One-time helper: opens Brave with the dedicated profile so Kyle can log in.
// Sessions live in ./profile-brave (gitignored). Never commit it.
// Usage: node src/login.mjs            (Meta + TikTok)
//        node src/login.mjs youtube    (YouTube Studio only)
import { launch } from './browser.mjs';

const SITES = {
  meta: 'https://business.facebook.com/latest/home',
  tiktok: 'https://www.tiktok.com/tiktokstudio/upload',
  youtube: 'https://studio.youtube.com',
};
const wanted = process.argv.slice(2).filter((a) => SITES[a]);
const names = wanted.length ? wanted : ['meta', 'tiktok'];

const ctx = await launch();
const open = (page, url) => page.goto(url, { waitUntil: 'commit' }).catch((e) => console.log(`(ignored: ${e.message.split('\n')[0]})`));
for (const [i, name] of names.entries()) {
  const page = i === 0 ? (ctx.pages()[0] ?? (await ctx.newPage())) : await ctx.newPage();
  await open(page, SITES[name]);
}
console.log(`Log in to: ${names.join(', ')}. Then close the Brave window.`);
await new Promise((resolve) => ctx.on('close', resolve));
console.log('Saved. Sessions are in ./profile-brave');
