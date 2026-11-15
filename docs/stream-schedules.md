# Stream schedules

Local page: /schedule. The homepage navigation includes a Schedule link.

## Two modes

- Featured 12: Stable Ronaldo, JasonTheWeen, Lacy, Silky, Kai Cenat, CaseOh, Jynxzi, tarik, shroud, summit1g, xQc and IShowSpeed. This is an editorial mix, not a claim that they are all FaZe members or the twelve largest channels.
- FaZe members: everyone in the ACTIVE data on https://fazeclan.com/pages/people, including coaches. The current checked snapshot includes 17 people. Founders and alumni are not silently relabeled as active members. The official directory is attempted every six hours; failures explicitly use the dated local snapshot.

The page provides a seven-day calendar, list layout, previous/next weeks, this week, local time zone with alternatives, creator/game search, individual creator filtering and deep links, real live-status indicators when available, source channel schedules and calendar downloads. Creator-announced cancellations and vacation breaks are retained. It does not infer regular start times from viewing history.

## Data configuration

All credentials stay on the server. No new account or paid plan is created.

| Variable | Purpose |
| --- | --- |
| TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET | Optional. Reuses the existing Twitch developer app configuration for app-token user lookup, live status and richer published schedules. Confirmed channels have a public iCalendar fallback without credentials. |
| YOUTUBE_API_KEY | YouTube Data API upcoming/live broadcasts for IShowSpeed, then video liveStreamingDetails for actual announced start times. |
| FAZE_TWITCH_CHANNELS | Optional JSON object mapping roster IDs to confirmed Twitch logins, such as {"faze-zoomaa":"zoomaa"}. Operator-maintained channel identities, not arbitrary destination URLs. |

At implementation time Twitch and YouTube credentials were not configured in the local runtime. Twitch published schedules still work through its public iCalendar endpoint; no live status is inferred from a scheduled time. YouTube needs its API key for automatic upcoming broadcasts; IShowSpeed's source channel is linked regardless.

Fifteen of the seventeen FaZe active-directory entries have confirmed channel mappings. VITAKING and Rafadell remain visible as Channel not linked until their streaming identity is confirmed. ProSettings player profiles, SiegeGG's linked roster and the PUBG publisher's player POV directory supplied disambiguated channels, checked against the Twitch profiles. A similarly named karrigancsgo account advertised a giveaway; the linked player account is karrigango. The feature does not treat a matching handle alone as identity proof.

Twenty-six public Twitch channel IDs (eleven featured channels plus fifteen FaZe channels) are saved in public/data/twitch-schedule-identities.json. Initial ID resolution used DecAPI, and every result was independently checked against the NAME in Twitch's own calendar before saving. Runtime requests go directly to Twitch; no runtime third-party lookup or secret is needed for these calendars. Renamed/mismatched calendar identities are rejected. Newly configured channel handles need a confirmed public ID or the optional Twitch app configuration.

Public calendar parsing uses the pinned ical.js 2.2.1 dependency. It expands weekly recurrences, excluded dates and cancellation exceptions, and uses the runtime IANA/Intl time-zone data to convert local wall times across DST because Twitch calendars omit VTIMEZONE definitions. Unsupported/invalid calendar data remains partial or unavailable. The published calendar is cached for its six-hour refresh interval, so a source handoff is available for the latest changes. The feed reflects the current published schedule, not an archive of historical streaming activity.

Twitch schedules follow source cursors, stop at the selected week's range, detect repeated cursors, and expose partial results rather than looping. A defensive 20-page source limit also reports partial status. Schedule results are cached for two minutes. Requests to the same week are coalesced. YouTube source discovery follows up to five pages per event type and exposes partial status at its limit; its channel-wide result is shared across week views for an hour to reduce quota usage. The runtime cache is per worker instance.

Twitch 404 means no published schedule. Authentication failures, source errors, unresolved channels and an unconfigured source remain separate states. An offline channel can still have scheduled events, and an active live channel can have none. Kick is retained as an alternate channel destination for xQc; this feature does not fabricate a Kick schedule API.

Calendar exports use UTC timestamps, preserve the announced duration only when supplied, escape text, fold UTF-8 lines, and disallow canceled entries. They are static downloads; subsequent source changes do not update an already imported event.

## Sources checked

- https://fazeclan.com/pages/people — active vs alumni directory and all names in the saved active snapshot.
- https://dev.twitch.tv/docs/api/reference/schedule — app/user token requirements, schedule segments, vacations, pagination, 404 behavior and the public iCalendar API. Public channel IDs were checked rather than guessed.
- https://developers.google.com/youtube/v3/docs/search/list — channel-specific upcoming/live discovery and pagination.
- https://developers.google.com/youtube/v3/docs/videos#liveStreamingDetails — announced scheduledStartTime, actualStartTime and actualEndTime, rather than upload publication dates.
- IShowSpeed's official YouTube oEmbed author identity and the selected Twitch source profile pages.
- https://pubg.com/ru/news/10268 — the publisher's player POV directory links Fexx, Gustav and vard to their actual channels.
- https://prosettings.net/players/broky/, /frozen/, /jcobbb/ and /neo/ — linked channel identities, followed to the Twitch profile pages.
- https://siege.gg/teams/50-faze-clan and https://siege.gg/players/1386-soulz1 — linked R6 player streaming profiles.
- https://kewisch.github.io/ical.js/api/ — iCalendar parsing, recurrence handling and timezone registration limits.

## Verification

Ten adapter/time/calendar tests cover pagination, cancellations, missing credentials, partial failures, directory parsing and fallback, source caching, local dates across DST, safe Unicode calendar export, public calendars, recurrence expansion, excluded dates, and moved/canceled recurrence exceptions. Local /schedule and both API modes return successfully; invalid collection requests return 400. Real Twitch calendar retrieval returned Shroud's recurring announced streams without credentials. No browser visual QA was performed for this addition.
