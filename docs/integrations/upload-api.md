# FaZe Clips — mock creator upload API

> **Draft / not live.** This is a proposed third-party integration contract and fictional response reference. Creating these docs does not enable bot uploads. The existing `/api/posts` route still requires same-origin browser sign-in; it does not accept bearer tokens. Do not point a bot at that route or share browser cookies.

Use this contract to design an upload action in a tool such as Kickbot, **if that tool supports custom authenticated HTTP requests and file uploads**. No native Kickbot integration or product capability has been verified or implemented.

The homepage header now includes **Developer API**, linking to `/#developer-api`. Its local demo console generates copyable `faze_mock_` keys, an Authorization header, a sample upload request and a simulated 201 response. The key stays in the current browser tab’s session. Generation and response previews are client-only; they send no request and do not authorize real uploads.

Machine-readable reference: [OpenAPI 3.0.3 JSON](./faze-clips.openapi.json). Import it into Swagger Editor, Postman, or a compatible mock tool to inspect the request schemas and example responses. Example responses are static fixtures, not storage or real uploads. No external mock service has been provisioned.

## Connection and permissions

- Proposed base URL: `https://clips.example.com/api/v1` — reserved placeholder, not a working host.
- Each creator would approve an integration and receive a separate scoped token. Token issuance, consent and revocation are future implementation work.
- Send `Authorization: Bearer <creator-token>` from the bot’s backend or secret store. Never put it in a public chat command, frontend bundle or repository.
- `clips:write` permits upload/delete; `clips:read` permits listing and engagement/status reads. All operations are restricted to that token’s creator.
- A bot cannot choose an owner, impersonate another streamer, upload like counts, or grant itself scopes.

## Endpoints

| Method | Path | Purpose | Scope |
| --- | --- | --- | --- |
| POST | `/clips` | Upload and publish a public clip | `clips:write` |
| GET | `/clips` | List the connected creator’s uploads | `clips:read` |
| GET | `/clips/{clipId}` | Read an owned clip and platform likes/comments | `clips:read` |
| DELETE | `/clips/{clipId}` | Remove an owned platform upload | `clips:write` |

## Upload from a bot

The bot obtains a video file through its own permitted workflow, then sends the file bytes to FaZe Clips. A Kick/Twitch URL by itself is attribution, not an upload. Uploaded content must be authorized by its owner. Social cross-posting is a separate creator-approved workflow and is not triggered by this endpoint.

```sh
curl -X POST "https://clips.example.com/api/v1/clips" \
  -H "Authorization: Bearer $FAZE_CLIPS_TOKEN" \
  -H "Idempotency-Key: kickbot-event-20261115-001" \
  -F "video=@./highlight.mp4;type=video/mp4" \
  -F "title=Last-second winner" \
  -F "description=The squad lost it." \
  -F "game=EA SPORTS FC" \
  -F "sourcePlatform=kick" \
  -F "sourceClipUrl=https://kick.com/demo/clips/clip_demo" \
  -F "streamUrl=https://kick.com/demo"
```

This is POSIX-shell syntax and will fail against the placeholder server. Replace the host only when a real integration API is implemented. The demo creator/source URLs are fictional.

Required multipart fields: `video`, `title`, `game`. Optional: `description`, `sourcePlatform`, `sourceClipUrl`, `streamUrl`, `sourceVideoUrl`, `challengeId`. Omit unused optional fields. Let the HTTP client generate the multipart boundary; do not manually set the top-level `Content-Type` header.

Limits follow the current upload format: MP4/WebM/MOV, 25 MiB video maximum (26,214,400 bytes), 26 MiB total request maximum, title 3–100 characters, caption up to 1,000, game/category 1–80 non-whitespace characters. File signature and MIME type must agree. A valid container does not guarantee browser codec playback. URLs are validated HTTPS source pages, not arbitrary download destinations. Unknown fields, including owner IDs and like counts, return 400.

### Example 201 response

```json
{
  "data": {
    "id": "3e519168-5ee9-4cb4-b8c6-706b37cb79f6",
    "canonicalClipId": "upload:3e519168-5ee9-4cb4-b8c6-706b37cb79f6",
    "status": "published",
    "title": "Last-second winner",
    "description": "The squad lost it.",
    "game": "EA SPORTS FC",
    "creator": {
      "displayName": "Demo Creator"
    },
    "source": {
      "platform": "kick",
      "clipUrl": "https://kick.com/demo/clips/clip_demo",
      "streamUrl": "https://kick.com/demo"
    },
    "url": "https://clips.example.com/#clip=3e519168-5ee9-4cb4-b8c6-706b37cb79f6",
    "createdAt": "2026-11-15T17:00:00Z",
    "metrics": {
      "fazeLikes": 0,
      "comments": 0
    }
  },
  "requestId": "req_mock_upload_001"
}
```

The `Location` header identifies `/api/v1/clips/{clipId}`. Use the UUID `id` in API paths; use `canonicalClipId` only when referring to the platform’s shared clip identity. `url` is the public platform link a bot could return in chat. `published` means posted on FaZe Clips, not Instagram/TikTok publication.

## Duplicate-safe delivery and retries

- Create one stable `Idempotency-Key` per logical bot upload, 16–128 letters/digits/underscores/hyphens. Keep it if the connection times out or the server returns 503.
- Proposed retention: 24 hours per creator and upload endpoint. Within that window, identical file bytes and metadata replay the original 201 response with `Idempotency-Replayed: true`. A changed payload with that key returns 409. Validation failures do not reserve the key.
- On an uncertain timeout, retry the identical request with exponential backoff and jitter. After the retention window, reconcile owned uploads before making another POST; a new key can create a duplicate.
- On 429, honor `Retry-After` seconds. Proposed quotas are 60 requests/minute and 20 successful uploads/rolling 24 hours per creator, shared across their tokens. Replays consume request quota but do not create another upload or consume another upload slot.
- Do not automatically retry 400/401/403/409/413/415. Correct the input, permissions or credentials first.

## Read back and sort

```http
GET /api/v1/clips?sort=top&limit=20
Authorization: Bearer <creator-token>
```

Returns `{ "data": [ ...clips ], "nextCursor": null, "requestId": "req_mock_list_001" }`. If `nextCursor` is non-null, send it URL-encoded as `cursor` and keep following pages until null. Keep the same sort. A page is not the complete inventory.

`new` sorts by creation time; `top` ranks first-party FaZe hearts; `hot` uses time-decayed first-party hearts. Equal scores break by creation time descending then ID. These endpoints list the connected creator’s uploads, not the whole cross-platform discovery catalog. The server applies sorting across the creator’s available collection before pagination.

`GET /clips/{clipId}` returns the same clip envelope with current read-only `metrics.fazeLikes` and `metrics.comments`. Source-platform likes/views are separate and cannot be supplied here. No engagement webhooks or external analytics ingestion are promised by this mock.

## Errors

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Check your clip metadata.",
    "fields": {
      "title": "Use 3–100 characters."
    }
  },
  "requestId": "req_mock_error_001"
}
```

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | Metadata, cursor or unknown field rejected |
| 401 | `unauthorized` | Missing, expired, revoked or invalid token |
| 403 | `insufficient_scope` | Valid token lacks required permission |
| 404 | `not_found` | Missing clip or not owned by this creator |
| 409 | `idempotency_conflict` | Same operation key, different content |
| 413 | `payload_too_large` | Video/request exceeds size limit |
| 415 | `unsupported_media_type` | Unsupported MIME type or file signature |
| 429 | `rate_limited` | Retry after the supplied delay |
| 503 | `service_unavailable` | Retry identical upload with the same key |

## Implementation boundary

This reference adds documentation only. Before real bot uploads work, the main app needs a versioned API adapter, creator-approved token issuance/revocation and scoped authentication, atomic shared quotas, durable idempotency storage, metadata validation, ownership checks and the documented response/error mapping. Reuse the existing R2/D1 upload storage and validation rather than weakening the browser route’s origin protections. The public media URL and stream attribution never reveal private account IDs.

The reference does not implement remote-media fetching, a bot OAuth handshake, social publishing, source-platform engagement verification, moderation claims, webhooks, or new storage/migrations. No live token, paid service, account connection or external post was created.
