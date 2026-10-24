// Headless check in Brave: are the saved sessions still logged in? Prints URL and title only.
import { launch } from './browser.mjs';

const ctx = await launch({ headless: true });
const sites = {
  meta: 'https://business.facebook.com/latest/home',
  tiktok: 'https://www.tiktok.com/tiktokstudio/upload',
};
for (const [name, url] of Object.entries(sites)) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(6000);
  console.log(`${name}: ${page.url().slice(0, 90)} | title="${await page.title()}"`);
  await page.close();
}
await ctx.close();
