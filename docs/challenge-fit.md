# FaZe Clips: HackUTA product recommendation

## Recommendation

Build a fan journey from a short moment to a longer relationship with FaZe: discover a clip, understand its context, save an era, participate in a spotlight, and follow the story or culture into an official destination.

**Problem:** a general clip feed can win a scroll without giving a new fan context or a returning fan a reason to come back. FaZe's archive and participatory history give this product an advantage over an interchangeable highlight aggregator.

**Audience:** both new and returning fans. New fans get an origin-first path and short explanations; returning fans start with familiar montage and creator-house chapters. Fans who simply want current gaming and variety clips retain the existing cross-platform feed.

## What the MVP now demonstrates

| Challenge goal | Working experience | Evidence and limits |
| --- | --- | --- |
| Sustained attention | Full collection search, native reels, official archive films, full-video/VOD links | Search sorts after collecting available pages. Source restrictions remain visible. Opens are not counted as completed watches. |
| New-fan entry | New-to-FaZe selection, short era context, original videos | Based on the supplied timeline, with video identities checked against YouTube oEmbed. No source view totals or precise publication dates are invented. |
| Returning-fan relevance | Returning-fan path and saved fan passport | Account saves persist in D1; guest preferences stay on that browser. Saves are not represented as watch completion. |
| Participation | Run It Back community spotlight, uploads, first-party hearts and comments | Uploaders opt in to the spotlight. Its board ranks community hearts. It is a fan prototype, not an official recruitment campaign or cash contest. |
| Revenue path | Official merchandise destination, tracked store opens, partnership pilot inquiries | Store checkout happens outside this app. Pilot requests are saved privately; no email, payment or sponsor booking is sent. |
| Product measurement | Fan Pulse with real hearts, comments, story opens, store opens and passport totals | Aggregate signed-in activity only. Click counts do not establish purchases, completed views, unique audience or ROI. |

## Priorities and use of resources

P0 retains the existing clip/community foundation and adds audience entry, contextual archive viewing, persistent saves and a working participation loop. P1 demonstrates the business path through commerce intent, pilot inquiries and measurable source handoffs. P2 would connect publisher credentials, approved merchant/referral arrangements, sponsor operations and longer-term retention measurement after a real pilot.

The linked APIs and open-source tools are suggested resources, not a requirement to integrate every tool. This MVP uses the existing Twitch integration and YouTube embeds instead of adding an unused Discord bot, OBS controller, FFmpeg worker or Whisper model. Recommendations remain a custom scoring algorithm; no generative AI model was added to the product.

## Revenue recommendation

Start with paid, clearly labeled community spotlights: a brand funds a theme and production/distribution package, while community hearts decide the editorial ranking. Measure participation, qualified source clicks and engagement before pricing or promising reach. The saved pilot inquiry is the first step of that workflow; it is not a completed sale.

An official merchandise handoff is a second path. A negotiated referral or revenue-share agreement could connect qualified traffic to attributable orders. The current app records a store open and sends fans to the official store; no agreement, commission or purchase attribution is claimed. Creator publishing/analytics services are an additional future subscription hypothesis, not an active paid plan in this app.

## Proposed pilot measurements

- Compare new and returning fan paths on saved eras, comments and community submissions.
- Measure clip-to-full-story opens, then validate completed viewing only where a platform supplies reliable data.
- Evaluate spotlight participation and first-party hearts independently of source-platform views.
- Track store opens now; add merchant-confirmed order attribution only after an integration and agreement.
- Collect sponsor pilot interest, then validate willingness to pay through actual conversations and contracts.

The linked student survey asks about short-to-long viewing and discovery friction. It supplies useful research questions, not survey results. No responses were available and no research conclusions or conversion rates are invented.

## Resource and link review — November 15, 2026

| PDF link | Result |
| --- | --- |
| [FaZe Brand Toolkit](https://drive.google.com/drive/folders/1psDncTeLcDKOevLuHOMkGzt_BeA1jzr-?usp=sharing) | Public folder read successfully. Font, logo, pattern and guideline folders inspected. The two-page Visual Identity One Sheet was rendered and inspected. |
| [FaZe timeline](https://docs.google.com/document/d/1HI-h6v38zGZaYzV_yc1G7u0NIec8pBerYdqO3z6mjQ4/edit) | Public text and HTML exports read, including embedded original video links. Selected video titles and channels verified through YouTube oEmbed. |
| [HardScope](https://hardscope.com/) | Public creator/media/commerce/platform site reviewed. |
| [FaZe Clan YouTube](https://www.youtube.com/@FaZeClan) | Channel link opened; original FaZe video metadata checked through oEmbed when page retrieval was throttled. |
| [HardScopeTV YouTube](https://www.youtube.com/@HardScopeTV) | Supplied handle returned HTTP 404 on direct retrieval. Not used as an active app destination. |
| [Student survey](https://forms.gle/vNdvJit39JjNstsr6) | Public questions read. No answers entered or submitted. |
| [YouTube Data API](https://developers.google.com/youtube/v3) | Documentation reviewed. |
| [Twitch API](https://dev.twitch.tv/docs/api/) | Documentation and EventSub overview reviewed. |
| [Discord API](https://discord.com/developers/docs) | Developer documentation reviewed. |
| [FFmpeg](https://ffmpeg.org/) | Project and capabilities reviewed. |
| [OBS WebSocket](https://github.com/obsproject/obs-websocket) | Official project reviewed. |
| [Whisper](https://github.com/openai/whisper) | Official project reviewed. |

## Brand implementation

The supplied toolkit's palette is Red Alert `#E4002B`, black `#111111` and white. Local fonts use Anton, Source Sans Pro and the supplied FaZed face. Original one-color marks are used at small sizes; the toolkit's white-filled outlined mark is used on dark backgrounds. Logo filters/rotation were removed, minimum display size and spacing increased, and original tiger-camo assets added. This is an independent hackathon product, not an endorsed FaZe/HardScope service.

Asset source IDs: Anton WOFF2 `1eSQ03HEohGzn5wEg0Q8wG-hllM74qr-B`; Source Sans regular `1pk7eGREiNA5JKSmTbcq4vWobyTRe0v9w`; bold `1STpinMvboC5PA0qHhX2KfkRKCKzttgAY`; FaZed `1s2iq6U0ogftkvqEWUnaiOf5X3CbbhduC`; one-color dark-background logo `14QpVeEdIoA9k8X_gyNoa7dCXAkn_1JWH`; outlined dark-background logo `1J5ncjLBzWPYOme1w2fzEj-n2hvfOoQVV`; red tiger pattern `1u9Vf5W9cFesyWpzmzU3V3PdLpr0NBndJ`; white tiger pattern `1wkkgmuIbxNkr2xTsoqOH6ZmDUTDP3mQi`. These were retrieved from the public toolkit, not recreated with generative images.

## Review boundary

All changes remain local. New database structure is append-only migration `0005_lonely_wiccan.sql`. Tests exercise real SQLite queries and local API flows. The browser automation tool was unavailable; a separate browser review was stopped with the physical Escape key, so no completed visual browser QA is claimed.
