// TikTok Content Posting API. UNTESTED against the live API.
// Env: TIKTOK_ACCESS_TOKEN, TIKTOK_PRIVACY (default SELF_ONLY, the only value an unaudited app may use)
// Media URLs must sit on a domain or URL prefix verified in the TikTok developer portal.
const API = 'https://open.tiktokapis.com/v2/post/publish';

export async function postTikTok(post) {
  const privacy = process.env.TIKTOK_PRIVACY ?? 'SELF_ONLY';
  const title = post.caption.split('\n')[0].slice(0, 90);
  const isPhoto = post.type === 'carousel';
  const body = isPhoto
    ? {
        post_info: { title, description: post.caption.slice(0, 4000), privacy_level: privacy, disable_comment: false, auto_add_music: true },
        source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: post.mediaUrls },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      }
    : {
        post_info: { title: post.caption.slice(0, 2200), privacy_level: privacy },
        source_info: { source: 'PULL_FROM_URL', video_url: post.mediaUrls[0] },
      };
  const res = await fetch(`${API}/${isPhoto ? 'content' : 'video'}/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || (json.error?.code && json.error.code !== 'ok')) throw new Error(`TikTok: ${JSON.stringify(json.error ?? json)}`);
  return json.data.publish_id;
}
