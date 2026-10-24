// Instagram API with Instagram Login (no Facebook Page needed).
// Env: IG_ACCESS_TOKEN, IG_USER_ID
const API = 'https://graph.instagram.com/v21.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, params = {}, method = 'POST') {
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_ACCESS_TOKEN });
  const res = method === 'GET'
    ? await fetch(`${API}/${path}?${body}`)
    : await fetch(`${API}/${path}`, { method, body });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`Instagram ${path}: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

async function waitReady(id) {
  for (let i = 0; i < 40; i++) {
    const { status_code } = await call(id, { fields: 'status_code' }, 'GET');
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`container ${id} ${status_code}`);
    await sleep(5000);
  }
  throw new Error(`container ${id} not ready in time`);
}

export async function postInstagram(post) {
  const uid = process.env.IG_USER_ID;
  let creation;
  if (post.type === 'image') {
    creation = (await call(`${uid}/media`, { image_url: post.mediaUrls[0], caption: post.caption })).id;
  } else if (post.type === 'carousel') {
    const kids = [];
    for (const url of post.mediaUrls) {
      const kid = (await call(`${uid}/media`, { image_url: url, is_carousel_item: 'true' })).id;
      await waitReady(kid);
      kids.push(kid);
    }
    creation = (await call(`${uid}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption: post.caption })).id;
  } else {
    creation = (await call(`${uid}/media`, { media_type: 'REELS', video_url: post.mediaUrls[0], caption: post.caption })).id;
  }
  await waitReady(creation);
  return (await call(`${uid}/media_publish`, { creation_id: creation })).id;
}
