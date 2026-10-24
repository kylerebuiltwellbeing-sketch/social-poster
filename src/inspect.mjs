// Dev helper: list the visible interactive controls on a page as compact text. Usage: node src/inspect.mjs <url> [waitMs]
import { launch } from './browser.mjs';

const [url, wait = '8000'] = process.argv.slice(2);
const ctx = await launch({ headless: true });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(Number(wait));
console.log('URL:', page.url().slice(0, 120));
const rows = await page.evaluate(() => {
  const sel = 'button, a[href], input, textarea, select, [role=button], [role=tab], [role=menuitem], [contenteditable=true]';
  const seen = new Set();
  return [...document.querySelectorAll(sel)].flatMap((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return [];
    const label = (el.getAttribute('aria-label') || el.innerText || el.placeholder || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    const key = `${el.tagName}|${label}|${el.type || ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [`${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''} "${label}"${el.accept ? ` accept=${el.accept}` : ''}`];
  });
});
console.log(rows.slice(0, 70).join('\n'));
await ctx.close();
