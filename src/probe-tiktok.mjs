// Dev probe, NEVER presses Post/Schedule. Walks the TikTok Studio Photos upload and prints what appears.
import { launch } from './browser.mjs';

const imgs = process.argv.slice(2);
const ctx = await launch({ headless: true });
const page = await ctx.newPage();
const text = async (n = 900) => (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ').slice(0, n);
await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
console.log('URL:', page.url().slice(0, 100), '|', await text(120));
await page.getByText('Photos', { exact: true }).first().click({ timeout: 20000 });
await page.waitForTimeout(3000);
console.log('PHOTOS TAB:', await text(600));
console.log('file inputs:', await page.evaluate(() => [...document.querySelectorAll('input[type=file]')].map((e) => `${e.accept}|multiple=${e.multiple}`)));
if (imgs.length) {
  await page.locator('input[type=file]').first().setInputFiles(imgs);
  await page.waitForTimeout(12000);
  console.log('AFTER UPLOAD:', await text(1800));
  await page.locator('input[type=radio][value=schedule]').first().check({ force: true }).catch(async () => page.getByText('Schedule', { exact: true }).first().click());
  await page.waitForTimeout(3000);
  console.log('AFTER SCHEDULE:', (await text(3000)).match(/When to post.{0,500}/)?.[0]);
  const show = async (label, sel) => {
    await page.locator(sel).first().click({ timeout: 8000 }).catch((e) => console.log(label, 'click failed'));
    await page.waitForTimeout(1500);
    const body = (await text(6000));
    console.log(label, body.match(/When to post.{0,700}/)?.[0], '\nTAIL:', body.slice(-300));
    await page.keyboard.press('Escape');
  };
  await show('DATE PICKER:', 'text=/^\\d{1,2} \\w{3} \\d{4}$/');
  await show('TIME PICKER:', 'text=/^\\d{2}:\\d{2}$/');
  console.log('radios:', await page.evaluate(() => [...document.querySelectorAll('input[type=radio]')].map((e) => `${e.name}=${e.value}:${e.checked}`)));
  console.log(
    'CONTROLS:\n' +
      (await page.evaluate(() =>
        [...document.querySelectorAll('button,input,textarea,[role=radio],[role=switch],[role=combobox],[contenteditable=true]')]
          .filter((e) => e.getBoundingClientRect().width)
          .map((e) => `${e.tagName.toLowerCase()}${e.type ? `[${e.type}]` : ''} "${(e.getAttribute('aria-label') || e.innerText || e.placeholder || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`)
          .slice(0, 50)
          .join('\n'),
      )),
  );
}
await ctx.close();
