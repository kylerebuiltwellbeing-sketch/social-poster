// Read-only: which date+time slots already have something scheduled (or posted) on each platform.
// Returns a Set of "YYYY-MM-DD HH:MM" strings in UK local time. Used to avoid double scheduling.
// Both lists are virtualised (rows drop out of the page as you scroll), so slots are collected after every scroll step.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n) => String(n).padStart(2, '0');

// The lists show no year. Pick the nearest year to today.
function withYear(day, monthIdx) {
  const now = new Date();
  const y = now.getFullYear();
  const cands = [y - 1, y, y + 1].map((yy) => new Date(Date.UTC(yy, monthIdx, day)));
  cands.sort((a, b) => Math.abs(a - now) - Math.abs(b - now));
  return cands[0].toISOString().slice(0, 10);
}

const readText = async (page) => (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ');

async function collect(page, rounds, extract) {
  const slots = new Set();
  await page.mouse.move(700, 450); // the wheel only scrolls the container under the pointer
  for (let i = 0; i <= rounds; i++) {
    extract(await readText(page), slots);
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(1000);
  }
  return slots;
}

function metaExtract(text, slots) {
  for (const m of text.matchAll(/(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{2}):(\d{2})/g)) {
    slots.add(`${withYear(Number(m[1]), MONTHS.indexOf(m[2].toLowerCase()))} ${m[3]}:${m[4]}`);
  }
}

function tiktokExtract(text, slots) {
  for (const m of text.matchAll(/(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*, (\d{1,2}):(\d{2}) (am|pm)/gi)) {
    let h = Number(m[3]) % 12;
    if (m[5].toLowerCase() === 'pm') h += 12;
    slots.add(`${withYear(Number(m[1]), MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase())))} ${pad(h)}:${m[4]}`);
  }
}

export async function metaSlots(ctx) {
  const page = await ctx.newPage();
  try {
    await page.goto('https://business.facebook.com/latest/posts/scheduled_posts', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('Date scheduled').first().waitFor({ timeout: 45000 });
    await page.waitForFunction(() => /\d{1,2} \w+ \d{2}:\d{2}/.test(document.body.innerText.replace(/[\s​]+/g, ' ')), null, { timeout: 45000 });
    await page.waitForTimeout(2000);
    const slots = await collect(page, 14, metaExtract);
    if (!slots.size) throw new Error('read no scheduled posts from Instagram, refusing to schedule blind');
    return slots;
  } finally {
    await page.close();
  }
}

export async function tiktokSlots(ctx) {
  const page = await ctx.newPage();
  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('Content (Created on)').first().waitFor({ timeout: 45000 });
    await page.waitForFunction(() => /\d{1,2} \w{3}, \d{1,2}:\d{2} (am|pm)/i.test(document.body.innerText.replace(/[\s​]+/g, ' ')), null, { timeout: 45000 });
    await page.waitForTimeout(2000);
    const slots = await collect(page, 5, tiktokExtract);
    if (!slots.size) throw new Error('read no posts from TikTok, refusing to schedule blind');
    return slots;
  } finally {
    await page.close();
  }
}

export const slotKey = (parts) => `${parts.date.split('/').reverse().join('-')} ${parts.hour}:${parts.minute}`;
