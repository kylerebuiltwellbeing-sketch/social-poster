// Dev probe: open the TikTok sound picker, search, and print what shows. Never posts.
import { launch } from './browser.mjs';

const ctx = await launch({ headless: true });
const page = await ctx.newPage();
const text = async (n = 900) => (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ').slice(0, n);
await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.getByText('Photos', { exact: true }).first().click();
await page.waitForTimeout(2000);
await page.locator('input[type=file]').first().setInputFiles(process.argv.slice(2));
await page.waitForTimeout(12000);
await page.getByRole('button', { name: 'Add sound' }).click();
await page.waitForTimeout(3000);
console.log('SOUND PANEL:', (await text(6000)).replace(/^.*?Add sound/, 'Add sound').slice(0, 900));
console.log('search placeholders:', await page.evaluate(() => [...document.querySelectorAll('input')].filter((e) => e.getBoundingClientRect().width).map((e) => e.placeholder)));
const search = page.locator('input[placeholder*=earch]:visible').last();
await search.fill('Calm Piano');
await page.keyboard.press('Enter');
await page.waitForTimeout(4000);
console.log('AFTER SEARCH:', (await text(6000)).replace(/^.*?Discard Feed Profile Web/, '').slice(0, 700));
console.log('BUTTONS:', await page.evaluate(() => [...document.querySelectorAll('button')].filter((e) => e.getBoundingClientRect().width && e.innerText.trim()).map((e) => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 25)).slice(0, 30)));
await ctx.close();
