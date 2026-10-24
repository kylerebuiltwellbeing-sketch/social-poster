// Schedules a YouTube Short through the YouTube Data API, reusing Kyle's yt_upload.py (login saved in C:/Users/kylem/youtube-token.json).
// Builds the video from the post's slide PNGs first. The API cannot read the channel's scheduled list with the saved scope,
// so double booking is prevented by week/scheduled.json only.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ukParts } from './meta.mjs';

const run = promisify(execFile);
const TOOLS = 'C:\\Users\\kylem\\Downloads\\rebuilt-wellbeing-business\\businesses\\rebuilt-wellbeing\\marketing\\videos\\_tools';
const MKSHORT = fileURLToPath(new URL('../tools/mkshort.py', import.meta.url));

export async function scheduleYouTube(_ctx, post, { go = false } = {}) {
  const folder = path.dirname(post.files[0]);
  const video = path.join(folder, 'short.mp4');
  const build = await run('python', ['-I', MKSHORT, folder, video], { maxBuffer: 1e7 });

  const hook = post.caption.split('\n')[0].trim();
  const title = `${hook} #Shorts`;
  if (title.length > 100) throw new Error(`YouTube title is ${title.length} characters, 100 max: ${title}`);
  const p = ukParts(new Date(post.publishAt));
  const at = `${p.date.split('/').reverse().join('-')} ${p.hour}:${p.minute}`;
  if (!go) return { stoppedBeforeUpload: true, built: build.stdout.trim(), title, at };

  const descFile = path.join(os.tmpdir(), `yt-desc-${Date.now()}.txt`);
  await writeFile(descFile, post.caption, 'utf8');
  const { stdout } = await run('python', [path.join(TOOLS, 'yt_upload.py'), video, '--title', title, '--desc-file', descFile, '--at', at, '--not-synthetic'], { maxBuffer: 1e7 });
  const m = stdout.match(/video id: (\S+) \| status: (\S+)/);
  if (!m) throw new Error(`no video id in uploader output: ${stdout.slice(-200)}`);
  return { scheduled: true, videoId: m[1], status: m[2], at };
}
