# FaZe Clips

> Public source snapshot of the FaZe Clips HackUTA prototype. Local credentials, user databases, uploads, demo sessions and the original Sites hosting identity are excluded. This repository does not deploy the app automatically.

## Local setup

Use Node.js 22.13 or newer (Node 24 recommended).

1. Run npm ci.
2. Run npm run build to generate the local Wrangler configuration.
3. For a fresh local database, apply each SQL file in drizzle/ in filename order using npx wrangler d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file <SQL_FILE>. Apply the initial files once to a fresh database; preserve existing databases when updating.
4. Run npm run dev and open the local URL it prints.
5. Optional: copy .env.example to .dev.vars and configure the integrations you want. Published Twitch schedules work without credentials for the confirmed channels. Never commit .dev.vars.

Local sign-in uses the preview adapter; hosted sign-in requires the Sites environment. To host a separate copy, register your own Site and configure its identity and storage bindings. The checked-in .openai/hosting.json keeps the DB/BUCKET binding names but does not contain the original project ID.

Schedule features and source limitations: [stream schedules](docs/stream-schedules.md). Brand/media attribution: [NOTICE.md](NOTICE.md).

## Project details

FaZe-themed hackathon clip community with video uploads, Twitch/Kick/YouTube discovery, all-game and IRL filters, and first-party likes.

Run: npm install, then npm run dev. Local preview: http://127.0.0.1:5173/ . Sign in to the preview at /signin-with-chatgpt?return_to=/ .

For a single-use local demo login, run `node scripts/demo-access.mjs` and open its link within 24 hours. It remembers the browser for 30 days and uses the same stable local account as normal preview sign-in, preserving watch history, likes, comments and fan saves. Credential hashes live only in ignored `.sites-runtime/demo-access/`; demo access is restricted to loopback and is not included in hosted authentication. Native playback progress saves every 15 seconds and on page hide/player close; embedded players do not supply watch time. The personalized feed is labeled **For you**.

Uploads are stored in R2; posts, shared reels and one like per account are stored in D1. Configure DB and BUCKET through .openai/hosting.json. Sites applies the append-only Drizzle migrations during publication; local previews require applying new migrations using the starter Wrangler workflow.

Community uploads accept MP4, WebM and MOV up to 25 MB and any game/category up to 80 characters. Browser codec support determines playback. My clips uses authenticated ownership. Community Hot ranks likes with time decay; Top all time ranks likes. Authors can delete their own uploads.

Discovery includes public Kick clips for FaZe Rain, ESL, VALORANT, xQc, YourRage, Saab, Sennadobone and Ninja. The homepage accepts game categories and IRL/Just Chatting while excluding casino and sports-betting categories. Explicit creator searches include all categories returned by that creator’s endpoint. Up to 12 Kick channels can be selected. Kick's website endpoint is undocumented; real cached snapshots are labeled when used. The homepage loads the first clip page per channel; creator search follows native continuation cursors.

Public Twitch clip links and YouTube videos/Shorts can be shared without app credentials. They play in official embeds with a direct source link as fallback. The source may require sign-in, restrict playback or remove a clip. Creator starter clips are real public links: StableRonaldo on Twitch and IShowSpeed on the verified Live Speedy YouTube channel. Unknown source views/dates are omitted rather than invented. Time filters exclude clips with unknown dates.

Automatic Twitch discovery uses the official Helix API and server-side client credentials. Configure TWITCH_CLIENT_ID and secret TWITCH_CLIENT_SECRET in Sites runtime environment settings (never client code). Optional TWITCH_CHANNELS is a comma-separated list, default stableronaldo. Without credentials, public clips and link imports remain functional. Access tokens are obtained and cached server-side; none are sent to the browser. No borrowed app credentials or undocumented Twitch API are used.

FaZe Clips hearts are independent platform likes, persisted per account for Kick clips, Twitch clips, YouTube Shorts and uploaded posts. Source-platform view counts are separate. Discovery Hot here ranks first-party likes with recency; Top likes ranks first-party likes. Source views is explicitly separate. Bookmarks and Kick-channel preferences remain local to the browser.

Checks:
- node --test tests/kick.test.mjs tests/reel-validation.test.mjs tests/twitch.test.mjs
- npx tsc --noEmit
- node tests/reels.integration.mjs (local preview only; creates and deletes a local fixture)
- node tests/community.integration.mjs (local preview only; requires outputs/test-clip.mp4 fixture)
- npm run build

Media credits: FaZe logo from https://fazeclan.com/; promo loop from https://www.counter-strike.net/; FaZe film https://www.youtube.com/watch?v=GHAlIBCY3p4; Speed clips from https://www.youtube.com/@LiveSpeedy/shorts ; Twitch embedding docs https://dev.twitch.tv/docs/embed/video-and-clips/ ; API docs https://dev.twitch.tv/docs/api/clips/ . Footage and trademarks remain with their owners. This is a hackathon community project, not an official FaZe product.

## Unified discovery, recommendations, and social publishing

The shared ranked catalog now includes uploads from all site creators, imported clips, and server-indexed discovered clips. For You uses native playback seconds, completion and account likes, with 14-day decay, creator diversity and exploration. Clip opens and merely loading an iframe are not recorded as watches. Twitch and YouTube embed watch time is not available to this implementation; likes on those clips still affect personalization. Watch history can be reset; likes remain. Hot applies time decay to first-party likes plus a small logarithmic verified external-engagement signal. All time is strictly first-party likes; external counts are separately labeled. Rankings consider the current bounded candidate pool (up to 300 imported/indexed records and 300 uploads), not every clip ever posted on the internet.

Search supports all stored creators and clips plus direct lookup of any valid Kick username. Optional BRAVE_SEARCH_API_KEY enables server-side web-wide clip discovery; Twitch credentials enable exact Twitch broadcaster lookup. Without a search key, the app clearly labels catalog/direct lookup results and offers links to search Google, YouTube and Twitch. It does not claim universal web coverage or scrape restricted search RSS. Suggested/default streamers are starting points, not a source allowlist.

Cross-posting uses Upload-Post for creator account linking, direct binary MP4 publishing to Instagram Reels/TikTok/YouTube/Facebook, job status and verified per-post analytics. Configure server-only UPLOAD_POST_API_KEY. Each creator has a separate provider profile; social OAuth tokens stay with the provider. Publishing requires an owned upload, connected accounts, selected platforms and explicit consent. The original video is transferred directly from R2.

Upload-Post was selected after comparing Zernio and Buffer. TikTok needs a paid plan; branded multi-user linking is intended for Professional. See [the comparison, prices, setup and limitations](docs/publishing-provider.md). No paid account or live post was created. AYRSHARE_API_KEY and SOCIAL_ENCRYPTION_KEY are no longer used.

Apply drizzle/0003_watery_vapor.sql locally after building. Earlier migrations and records are retained. Sync is manual and rate limited per record. Pending, draft and uncertain submissions are distinguished from confirmed publication. Missing metrics do not overwrite stored counts; account-wide totals never become clip likes. Social counts are separate from FaZe hearts. Live provider flows still require credentials and connected accounts.

Additional checks:
- node --test tests/ranking.test.mjs tests/web-discovery.test.mjs tests/publisher-contract.test.mjs tests/publisher-service.test.mjs
- node tests/discovery.integration.mjs (local preview; creates/removes a temporary upload)
- npx tsc --noEmit

Official integration references: https://docs.upload-post.com/api/user-profiles/ ; https://docs.upload-post.com/api/upload-video/ ; https://docs.upload-post.com/api/upload-status/ ; https://docs.upload-post.com/api/get-analytics/ ; https://api-dashboard.search.brave.com/app/documentation/web-search .

## Creator search and sorting

Creator searches collect the complete available inventory before showing a ranking. The browser follows every Kick, Twitch and local catalog continuation automatically, deduplicates records, and holds results until collection finishes. There is no application-level clip/page cutoff. Progress and cancellation are visible. The source crawl uses a fixed all-time view-order query; changing the selected sort or time filter then works on the full collected inventory without fetching a new subset. Card display can be expanded separately, after global ranking.

Display names, @handles and channel URLs resolve to creator lookups. Explicit creator searches include all source categories and exclude unrelated clips that merely mention the creator. Source view totals and FaZe hearts remain separate; external reel hearts use the same reel: ID prefix as the community API. The collector retains creator-only scope across catalog continuation pages.

An unavailable, stale or stalled source marks collection incomplete and the UI offers a retry rather than labeling a partial ranking complete. Repeated source cursors are detected independently of advancing catalog offsets. A source with no creator account is distinguished from a source that failed. Unconfigured Twitch is labeled not connected and is outside available-source coverage. TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are still needed for Twitch enumeration. YouTube remains saved clips and optional web links; every YouTube creator’s Shorts cannot be enumerated by this integration. Provider-side availability and pagination limits still apply.

Search checks: node --test tests/creator-search.test.mjs tests/collect-creator-clips.test.mjs tests/kick.test.mjs tests/twitch.test.mjs ; node tests/search.integration.mjs ; node tests/reels.integration.mjs (local preview; temporary reel is cleaned up).

## Clip comments and stream pages

Every clip player has a shared D1 comment thread, including Kick, Twitch, YouTube and community uploads. Uploads use the same upload:ID thread in the community player and main reel player. Visitors can read comments; signed-in users can post plain-text comments up to 1,000 characters and delete their own. Names are set server-side without using email addresses as a fallback. Threads load newest first with stable pagination, refresh and older-comment controls. Writes require same-origin authentication and allow 8 comments per user per minute. Deleting an upload removes its comments. Apply append-only migration drizzle/0004_slow_arclight.sql locally.

A Stream page button links to known Kick/Twitch creators and attributed YouTube channels. Upload and shared-clip forms accept an optional creator stream URL; only HTTPS Kick/Twitch channel pages and YouTube handles/channel pages are accepted. The link is not a claim that the streamer is currently live. Unknown imported creators do not get invented channel links. IShowSpeed starter clips point to the main IShowSpeed live page. Arrow keys and scrolling inside comments do not skip to another clip.

Checks: node --test tests/comments.test.mjs tests/stream-links.test.mjs ; node tests/comments.integration.mjs (local preview; creates and removes temporary comments and an upload).

## HackUTA challenge fit

The app now includes new/returning fan paths, an original-video archive, a persistent fan passport, the Run It Back community spotlight, full-video/VOD handoffs, an official-store destination, private prototype pilot inquiries and real aggregate Fan Pulse activity. The archive is sourced from the supplied FaZe timeline; its original video identities were checked with YouTube oEmbed. Branding uses the supplied toolkit's local fonts, original marks, Red Alert palette and tiger camo.

Apply append-only migration drizzle/0005_lonely_wiccan.sql for fan profiles/events/pilot requests and the upload source_url/challenge_id columns. Native Twitch clips link to the source VOD only when Helix supplies its video_id. Upload and import forms can attach a validated full-video link. A spotlight submission is an opt-in upload, and its board ranks first-party hearts.

Pilot requests are saved in this local prototype; they do not send email or charge money. The store link opens FaZe's external storefront. Source/store opens are clicks, not completed viewing, purchases or attributable revenue. The complete product recommendation, priorities, revenue hypothesis, resource audit and verification limits are in docs/challenge-fit.md.

Checks: node --test tests/fan-service.test.mjs tests/stream-links.test.mjs tests/twitch.test.mjs ; node tests/fans.integration.mjs (local preview; fixtures and prior passport state are cleaned up/restored).
