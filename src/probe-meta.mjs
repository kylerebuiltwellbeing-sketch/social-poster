// Dev probe, NEVER presses Publish/Schedule. Walks the Meta composer and prints controls after each step.
import { launch } from './browser.mjs';

const img = process.argv[2];
const ctx = await launch({ headless: true });
const page = await ctx.newPage();
const dump = async (tag) => {
  const rows = await page.evaluate(() => {
    const seen = new Set();
    return [...document.querySelectorAll('button,input,textarea,[role=button],[role=menuitem],[role=option],[role=checkbox],[role=switch],[role=tab],[contenteditable=true]')].flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      const l = (el.getAttribute('aria-label') || el.innerText || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 45);
      const k = el.tagName + l + (el.type || '');
      if (seen.has(k) || !l) return [];
      seen.add(k);
      return [`${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''} "${l}"`];
    });
  });
  console.log(`--- ${tag}\n${rows.slice(0, 45).join('\n')}`);
};
await page.goto('https://business.facebook.com/latest/composer', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
console.log('page text:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 700));
const chooser = page.waitForEvent('filechooser', { timeout: 6000 }).catch(() => null);
await page.getByText('Add photo/video', { exact: true }).first().click();
const fc = await chooser;
console.log('filechooser opened directly:', !!fc);
if (!fc) {
  await page.waitForTimeout(1500);
  console.log('menu text:', (await page.locator('[role=menu],[role=dialog],[role=listbox]').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').slice(0, 400));
} else if (img) {
  await fc.setFiles(img);
  await page.waitForTimeout(7000);
  await dump('after upload');
  const cap = page.locator('[contenteditable=true]:visible').first();
  console.log('contenteditables:', await page.locator('[contenteditable=true]').count());
  await cap.click();
  await page.keyboard.type('probe caption');
  await page.getByText('Set date and time', { exact: true }).first().click();
  await page.waitForTimeout(2500);
  await dump('after Set date and time');
  const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].filter((e) => e.getBoundingClientRect().width).map((e) => `${e.type}|${e.placeholder}|${e.getAttribute('aria-label')}|${e.value}|${e.getAttribute('role')}`));
  console.log('inputs:\n' + inputs.join('\n'));
  console.log('schedule text:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').match(/Schedule.{0,300}/)?.[0]);
}
await ctx.close();
