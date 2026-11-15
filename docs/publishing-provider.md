# Publishing provider decision

Selected **Upload-Post** for the multi-creator FaZe Clips integration. Compared against primary documentation on November 15, 2026. No account, subscription or live social post was created.

| Provider | Creator linking and publishing | Engagement data | Fit for this project |
| --- | --- | --- | --- |
| Upload-Post | Separate creator profiles, hosted connection links, binary video uploads | Per-post metrics through the API | Selected: one profile contains a creator's accounts across networks, and binary uploads work with private media storage. |
| Zernio (formerly Late) | Profiles and social connections with API publishing | Analytics included | Strong option for a small demo: first two connected accounts free; accounts 3–10 cost $6 each/month, 11–100 cost $3 each. Each creator's networks count separately. |
| Buffer | OAuth apps can connect accounts and publish | App Clients cannot request metrics; personal API keys only | Does not meet the multi-user engagement-feedback requirement through its OAuth app API. |

Upload-Post Free includes 2 profiles and 10 uploads/month, excluding TikTok. Basic is $24/month for 5 profiles with TikTok. Professional is $50/month for 25 profiles and white-label linking, which is the intended plan for the branded creator experience. Prices are monthly USD; verify current terms before subscribing. For 25 creators with 3 accounts each, this profile model is a better fit than billing each network separately. This is our assessment, not a claim that one provider is best for every app.

Sources: [Upload-Post pricing](https://www.upload-post.com/pricing/), [profile linking](https://docs.upload-post.com/api/user-profiles/), [binary publishing](https://docs.upload-post.com/api/upload-video/), [post analytics](https://docs.upload-post.com/api/get-analytics/), [Zernio pricing](https://docs.zernio.com/pricing), [Buffer metrics restriction](https://developers.buffer.com/guides/post-metrics).

## Local setup

1. Configure server-only `UPLOAD_POST_API_KEY` through the runtime environment. Never use a public/client-prefixed variable or commit the key. The adapter requires no per-creator secret in D1; OAuth tokens remain with Upload-Post.
2. Apply the append-only migration `drizzle/0003_watery_vapor.sql` to the local D1 database. It adds provider-scoped profile mappings and publication metadata. Historical records and migrations remain intact; legacy provider jobs are never sent to Upload-Post.
3. Sign in locally, open Creator Control Room, and connect your own social accounts through the hosted connection page. The server derives an opaque profile ID from the signed-in account. Account mappings and publication history are private to that creator.
4. Select an owned MP4, caption, destination networks and explicit publishing consent. A video is transferred directly from R2 as multipart data. Existing clip imports cannot be republished through this flow. Choose or pin a Facebook Page in the provider's connection flow; several unpinned Pages require resolving a destination there before publishing.
5. Use **Sync engagement** to read status and per-post analytics. Sync is manual, capped at 8 records per request with a 5-minute interval per record. TikTok moderation and metrics may take time. Inbox fallback is shown as a draft. Uncertain submissions require checking the source account; the app does not automatically resend a potentially published clip.

The original file is not cropped or transcoded by FaZe Clips. Platforms and the publishing provider may process it; final Shorts eligibility belongs to YouTube. Platform format, duration, account and music requirements still apply. A private TikTok account may reject the requested public visibility. Missing metrics preserve stored values; only verified `post_metrics` are accepted, never account-wide snapshots. Likes remain separate from FaZe hearts and contribute only aggregate popularity signals; the API does not identify individual people who liked a social post.

`AYRSHARE_API_KEY` and `SOCIAL_ENCRYPTION_KEY` are no longer read. The historical `social_profiles` table is retained for migration compatibility. Already-recorded post/platform pairs are not republished when the provider changes. Deleting a local FaZe upload does not delete its social copies.

## Validation boundary

Provider contract and service tests use mocked network responses with real local SQLite queries. They cover account isolation, ownership, duplicate prevention, timeout recovery, status normalization and missing analytics. Local API integration checks cover the unconfigured state. A production API key, eligible plan and connected test accounts are still needed to verify actual linking, posting and analytics against Upload-Post. Nothing was deployed.
