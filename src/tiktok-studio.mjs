// Schedules a TikTok photo post (carousel) in TikTok Studio using the saved Brave session.
// No AI involved. Stops before pressing Schedule unless go === true.
import { ukParts } from './meta.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SOUND_QUERY = process.env.TIKTOK_SOUND ?? 'Calm Piano';
const SOUND_LENGTH = process.env.TIKTOK_SOUND_LENGTH ?? '01:00';

const bodyText = async (page) => (await page.locator('body').innerText()).replace(/[\s\u200b]+/g, ' ');

async function pickSound(page) {
  await page.getByRole('button', { name: 'Add sound' }).click();
  const search = page.getByPlaceholder('Search sounds');
  await search.waitFor({ timeout: 15000 });
  await search.fill(SOUND_QUERY);
  await page.keyboard.press('Enter');
  const row = page.locator('div', { hasText: new RegExp(`^${SOUND_QUERY}\\s*${SOUND_LENGTH}`) }).filter({ has: page.getByRole('button', { name: 'Use' }) }).last();
  await row.waitFor({ timeout: 20000 });
  await row.getByRole('button', { name: 'Use' }).first().click();
  await page.waitForTimeout(2500);
}

async function pickDate(page, parts) {
  const [dd, mm, yyyy] = parts.date.split('/').map(Number);
  await page.locator('text=/^\\d{1,2} \\w{3} \\d{4}$/').first().click();
  // every day button carries a full aria-label, e.g. "Sunday, 25 October 2026"
  const day = page.getByRole('button', { name: new RegExp(`, ${dd} ${MONTHS[mm - 1]} ${yyyy}$`) });
  await page.getByRole('group', { name: 'Calendar navigation' }).waitFor({ timeout: 10000 });
  for (let i = 0; i < 14 && !(await day.count()); i++) {
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.waitForTimeout(400);
  }
  await day.first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
}

async function pickTime(page, parts) {
  await page.locator('text=/^\\d{2}:\\d{2}$/').first().click();
  await page.waitForTimeout(800);
  await page.locator(`text="${parts.hour}"`).first().click();
  await page.waitForTimeout(400);
  const mins = page.locator(`text="${parts.minute}"`);
  await mins.nth((await mins.count()) - 1).click();
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
}

export async function scheduleTikTok(ctx, post, { go = false } = {}) {
  const page = await ctx.newPage();
  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('Photos', { exact: true }).first().click({ timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.locator('input[type=file]').first().setInputFiles(post.files);
    await page.getByRole('button', { name: 'Add sound' }).waitFor({ timeout: 90000 });
    await page.waitForTimeout(4000);

    const title = post.caption.split('\n')[0].slice(0, 90);
    await page.getByPlaceholder('Add a catchy title').fill(title);
    const desc = page.locator('[contenteditable=true]:visible').first();
    await desc.click();
    await page.keyboard.insertText(post.caption);
    await page.waitForTimeout(1000);

    await pickSound(page);
    if (!(await bodyText(page)).includes(SOUND_QUERY)) throw new Error('sound not applied');

    await page.locator('input[type=radio][value=schedule]').check({ force: true });
    await page.waitForTimeout(1500);
    const parts = ukParts(new Date(post.publishAt));
    await pickDate(page, parts);
    await pickTime(page, parts);

    const text = await bodyText(page);
    const m = text.match(/(\d{1,2}) (\w{3}) (\d{4}) (\d{2}):(\d{2})/);
    const [dd, mm, yyyy] = parts.date.split('/').map(Number);
    const ok = m && Number(m[1]) === dd && MONTHS[mm - 1].startsWith(m[2]) && Number(m[3]) === yyyy && m[4] === parts.hour && m[5] === parts.minute;
    const shown = m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}:${m[5]}` : 'not found';
    if (!ok) throw new Error(`schedule not set, wanted ${parts.date} ${parts.hour}:${parts.minute}, page shows ${shown}`);
    if (!go) return { stoppedBeforeSchedule: true, shown };

    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.waitForTimeout(10000);
    const after = await bodyText(page);
    if (/uploading|something went wrong|try again/i.test(after)) throw new Error('TikTok showed an error after Schedule');
    return { scheduled: true, shown };
  } finally {
    await page.close();
  }
}
