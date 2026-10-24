// Shared launcher: Kyle's Brave with a dedicated automation profile (./profile-brave, gitignored).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

export const BRAVE = process.env.BRAVE_PATH ?? 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
export const PROFILE = fileURLToPath(new URL('../profile-brave/', import.meta.url));

export function launch({ headless = false } = {}) {
  return chromium.launchPersistentContext(PROFILE, {
    executablePath: BRAVE,
    headless,
    viewport: headless ? { width: 1366, height: 900 } : null,
    args: headless ? [] : ['--start-maximized'],
  });
}
