# social-poster

Posts approved items to Instagram and TikTok from GitHub Actions. Nothing runs on the laptop.

## How it works
- One folder per post in `queue/<name>/post.json`. See `queue/example`.
- A post only goes out if `approved` is `true` and `publishAt` has passed.
- The workflow runs every 15 minutes inside the 18:00 and 00:00 UK windows only (UTC hours 17, 18, 23, 0). A post due outside those windows waits for the next one. Edit the cron in `.github/workflows/post.yml` to add slots.
- Anything more than 12 hours late is skipped, not posted at the wrong time.
- `state/posted.json` records what went out so nothing posts twice.
- Test locally with `node src/run.mjs --dry`. Dry mode posts nothing.

## Post types
| type | Instagram | TikTok |
|---|---|---|
| carousel (2 to 10 images) | yes | photo post |
| image (1 image) | yes | not supported |
| video (1 file) | Reel | video |

## Media must be public https URLs
Instagram and TikTok fetch the files themselves. Plan: a Cloudflare R2 bucket on a media subdomain of a domain Kyle owns. TikTok also needs that domain or URL prefix verified in its developer portal.

## Secrets (Kyle adds these in GitHub, repo Settings, Secrets)
- `IG_ACCESS_TOKEN`, `IG_USER_ID` from a Meta app using "Instagram API with Instagram Login" (Creator account, no Facebook Page).
- `TIKTOK_ACCESS_TOKEN` from a TikTok developer app with the Content Posting API.
- Repo variable `TIKTOK_PRIVACY`. Leave unset (SELF_ONLY) until TikTok audits the app. After the audit set `PUBLIC_TO_EVERYONE`.

## Open items
- Instagram long-lived tokens expire after 60 days and need refreshing. TikTok access tokens expire daily. Neither refresh is built yet. Needs a place to store rotating tokens.
- `tiktok.mjs` is untested against the live API.
- Media upload to R2 is not built.
- Daily YouTube long-form is parked until the voice clone is done.
