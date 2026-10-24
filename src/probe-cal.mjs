// Dev probe: print the TikTok calendar popup's markup. Never posts.
import { launch } from './browser.mjs';

const ctx = await launch({ headless: true });
const page = await ctx.newPage();
await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.getByText('Photos', { exact: true }).first().click();
await page.waitForTimeout(2000);
await page.locator('input[type=file]').first().setInputFiles(process.argv.slice(2));
await page.getByRole('button', { name: 'Add sound' }).waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
await page.locator('input[type=radio][value=schedule]').check({ force: true });
await page.waitForTimeout(1500);
await page.locator('text=/^\\d{1,2} \\w{3} \\d{4}$/').first().click();
await page.waitForTimeout(1500);
const html = await page.evaluate(() => {
  const wk = document.querySelector('[class*=DatePicker__weekHeader]');
  let root = wk;
  while (root.parentElement && !/DatePicker__(root|container|wrapper|calendar)/i.test(root.className) && root.parentElement.querySelectorAll('[role]').length < 80) root = root.parentElement;
  const items = [...root.querySelectorAll('*')]
    .filter((e) => e.getAttribute('role') || e.getAttribute('aria-label') || e.tagName === 'BUTTON')
    .filter((e) => !/columnheader/.test(e.getAttribute('role') || ''))
    .map((e) => `${e.tagName.toLowerCase()} role=${e.getAttribute('role')} aria="${e.getAttribute('aria-label')}" cls=${String(e.className).replace(/^.*DatePicker__/, '').slice(0, 24)} txt="${(e.textContent || '').trim().slice(0, 14)}"`);
  return `ROOT cls=${root.className.slice(0, 60)}\n` + items.slice(0, 22).join('\n') + `\n... total ${items.length}`;
});
console.log(html);
await ctx.close();
