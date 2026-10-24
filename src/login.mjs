// One-time helper: opens Brave with a dedicated profile so Kyle can log in.
// Sessions live in ./profile-brave (gitignored). Never commit it.
import { launch } from './browser.mjs';

const ctx = await launch();
const sites = ['https://business.facebook.com/latest/home', 'https://www.tiktok.com/tiktokstudio/upload'];
const open = (page, url) => page.goto(url, { waitUntil: 'commit' }).catch((e) => console.log(`(ignored: ${e.message.split('\n')[0]})`));
const first = ctx.pages()[0] ?? (await ctx.newPage());
await open(first, sites[0]);
const second = await ctx.newPage();
await open(second, sites[1]);
console.log('Log in to both tabs, then close the Brave window.');
await new Promise((resolve) => ctx.on('close', resolve));
console.log('Saved. Sessions are in ./profile-brave');
