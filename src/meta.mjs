// Schedules an Instagram post (image or carousel) in Meta Business Suite using the saved Brave session.
// No AI involved. Stops before pressing Schedule unless go === true.
const COMPOSER = 'https://business.facebook.com/latest/composer';

const pad = (n) => String(n).padStart(2, '0');

// Formats a Date as UK local parts (the Business Suite account is in UK time).
export function ukParts(date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.day}/${p.month}/${p.year}`, hour: p.hour === '24' ? '00' : p.hour, minute: p.minute };
}

async function setSpin(page, label, value) {
  const box = page.getByRole('spinbutton', { name: label }).first();
  await box.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
  await page.keyboard.press('Tab');
}

export async function scheduleInstagram(ctx, post, { go = false } = {}) {
  const page = await ctx.newPage();
  try {
    await page.goto(COMPOSER, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('Add photo/video', { exact: true }).first().waitFor({ timeout: 45000 });

    const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
    await page.getByText('Add photo/video', { exact: true }).first().click();
    await (await chooser).setFiles(post.files);
    // wait for every thumbnail: one "Remove Photo" control per image
    await page.waitForFunction((n) => document.body.innerText.split('Remove Photo').length - 1 >= n || n === 1, post.files.length, { timeout: 90000 });
    await page.waitForTimeout(2500);

    const caption = page.locator('[contenteditable=true]:visible').first();
    await caption.click();
    await page.keyboard.insertText(post.caption);

    await page.getByText('Set date and time', { exact: true }).first().click();
    const { date, hour, minute } = ukParts(new Date(post.publishAt));
    const dateBox = page.getByPlaceholder('dd/mm/yyyy').first();
    await dateBox.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(date);
    await page.keyboard.press('Tab');
    await setSpin(page, 'hours', hour);
    await setSpin(page, 'minutes', minute);

    const text = (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ');
    const t = text.match(/Time input (\d{1,2}) : (\d{1,2})/);
    const shown = { date: await dateBox.inputValue(), time: t ? `${t[1]}:${t[2]}` : 'not found' };
    const dm = shown.date.match(/^(\d{1,2}) (\w+) (\d{4})$/);
    const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [wd, wm, wy] = date.split('/').map(Number);
    if (!dm || Number(dm[1]) !== wd || dm[2] !== MON[wm - 1] || Number(dm[3]) !== wy) throw new Error(`date not set, wanted ${date}, page shows "${shown.date}"`);
    if (!t && process.env.DEBUG_META) console.log('TEXT:', text.match(/Schedule Set date.{0,260}/)?.[0]);
    if (!t || pad(+t[1]) !== hour || pad(+t[2]) !== minute) throw new Error(`time not set, wanted ${hour}:${minute}, page shows ${shown.time}`);
    if (!go) return { stoppedBeforeSchedule: true, want: { date, hour, minute }, shown };

    await page.getByRole('button', { name: 'Schedule', exact: true }).or(page.getByText('Schedule', { exact: true }).last()).click();
    await page.waitForTimeout(8000);
    return { scheduled: true, want: { date, hour, minute }, shown };
  } finally {
    await page.close();
  }
}
