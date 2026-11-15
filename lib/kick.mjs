/** Small, dependency-free adapter for Kick's website clips endpoint. */
export const DEFAULT_CHANNELS = ["fazerain", "eslcs", "valorant", "xqc", "yourrage", "saab", "sennadobone", "ninja"];
const SORTS = new Set(["view", "date"]);
const TIMES = new Set(["all", "day", "week", "month"]);
const SLUG = /^[a-z0-9][a-z0-9_-]{0,29}$/;
const CLIP_ID = /^clip_[A-Za-z0-9]{12,40}$/;
const TIME_WINDOW = { day: 86400000, week: 604800000, month: 2592000000 };

export class InputError extends Error {}

export function parseClipQuery(input) {
  const params = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  const value = params.get("channels");
  const channels = value === null ? [...DEFAULT_CHANNELS] : [...new Set(value.split(",").map((s) => s.trim().toLowerCase()))];
  if (!channels.length || channels.length > 12 || channels.some((s) => !SLUG.test(s))) {
    throw new InputError("Choose between 1 and 12 valid Kick channel usernames.");
  }
  const sort = params.get("sort") || "view";
  const time = params.get("time") || "all";
  if (!SORTS.has(sort)) throw new InputError("Sort must be view or date.");
  if (!TIMES.has(time)) throw new InputError("Time must be all, day, week, or month.");
  const cursor=params.get('cursor');
  if(cursor!==null&&(channels.length!==1||!cursor||cursor.length>2048||/[\u0000-\u001f]/.test(cursor)))throw new InputError('Invalid creator page cursor.');
  return { channels, sort, time, ...(cursor?{cursor}:{}) };
}

/** Only official clip media can enter the video player. */
export function trustedClipUrl(value, kind = "video") {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "clips.kick.com" || url.username || url.password || url.port || url.hash) return "";
    if (!/^\/clips\/[a-zA-Z0-9/_-]+\.(?:m3u8|mp4|png|jpe?g|webp)$/.test(url.pathname)) return "";
    if (kind === "video" && !/\.(?:m3u8|mp4)$/.test(url.pathname)) return "";
    if (kind === "thumbnail" && !/\.(?:png|jpe?g|webp)$/.test(url.pathname)) return "";
    return url.href;
  } catch { return ""; }
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function normalizeClip(raw, requestedChannel, {includeAllCategories=false}={}) {
  if (!raw || typeof raw !== "object" || !CLIP_ID.test(raw.id || "") || !SLUG.test(requestedChannel)) return null;
  const category = typeof raw.category?.name === "string" ? raw.category.name.slice(0, 100) : "";
  if (!category || (!includeAllCategories && /slots|casino|sports betting/i.test(category))) return null;
  if (raw.channel?.slug != null && typeof raw.channel.slug !== "string") return null;
  const reportedChannel = raw.channel?.slug?.toLowerCase();
  if (reportedChannel && reportedChannel !== requestedChannel) return null;
  const videoUrl = trustedClipUrl(raw.video_url || raw.clip_url);
  const thumbnail = trustedClipUrl(raw.thumbnail_url, "thumbnail");
  if (!videoUrl || !thumbnail) return null;
  const created = new Date(raw.created_at);
  const duration = finite(raw.duration);
  if (Number.isNaN(created.getTime()) || duration < 1 || duration > 180) return null;
  return {
    id: raw.id,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 180) : "Untitled highlight",
    thumbnail,
    videoUrl,
    channel: requestedChannel,
    channelName: typeof raw.channel?.username === "string" ? raw.channel.username.slice(0, 60) : requestedChannel,
    category,
    isMature: raw.is_mature === true,
    duration,
    views: Math.floor(finite(raw.views ?? raw.view_count)),
    createdAt: created.toISOString(),
    url: `https://kick.com/${requestedChannel}/clips/${raw.id}`,
  };
}

function selectClips(clips, query, now) {
  const earliest = query.time === "all" ? 0 : now - TIME_WINDOW[query.time];
  const unique = new Map();
  for (const clip of clips) {
    if (new Date(clip.createdAt).getTime() >= earliest) unique.set(clip.id, clip);
  }
  return [...unique.values()].sort(query.sort === "date"
    ? (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    : (a, b) => b.views - a.views);
}

export function createClipService({
  fetcher = globalThis.fetch,
  now = Date.now,
  timeoutMs = 7000,
  ttlMs = 300000,
  staleMs = 86400000,
  maxEntries = 32,
  includeAllCategories = false,
  snapshot = { clips: [], capturedAt: null },
} = {}) {
  const cache = new Map();
  const pending = new Map();

  async function load(channel, sort, time, cursor='') {
    const key = `${channel}:${sort}:${time}`+(cursor?':'+cursor:'');
    const existing = cache.get(key);
    if (existing && now() - existing.timestamp < ttlMs) return { ...existing, status: "live" };
    if (pending.has(key)) return pending.get(key);

    const task = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const endpoint = new URL(`https://kick.com/api/v2/channels/${channel}/clips`);
        endpoint.searchParams.set("sort", sort);
        endpoint.searchParams.set("time", time);
        if(cursor)endpoint.searchParams.set('cursor',cursor);
        const response = await fetcher(endpoint.href, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
          // Cloudflare Workers supports manual/follow, but rejects redirect:error.
          // Manual keeps all redirects on the error path instead of following them.
          redirect: "manual",
        });
        if(response.status===404&&!cursor){
          const entry={clips:[],nextCursor:null,found:false,timestamp:now(),capturedAt:new Date(now()).toISOString()};
          cache.set(key,entry);while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
          return {...entry,status:'live'};
        }
        if (!response.ok) throw new Error(`Kick returned HTTP ${response.status}.`);
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Kick returned an unexpected response.");
        const body = await response.text();
        if (body.length > 1000000) throw new Error("Kick returned an oversized response.");
        const data = JSON.parse(body);
        if (!Array.isArray(data.clips)) throw new Error("Kick's clip response changed.");
        const clips = data.clips.map((raw) => normalizeClip(raw, channel,{includeAllCategories})).filter(Boolean);
        const nextCursor=typeof data.nextCursor==='string'&&data.nextCursor.length<=2048&&data.nextCursor!==cursor?data.nextCursor:null;
        const paginationIncomplete=data.nextCursor!=null&&data.nextCursor!==''&&!nextCursor;
        const entry = { clips, nextCursor, paginationIncomplete, timestamp: now(), capturedAt: new Date(now()).toISOString() };
        cache.delete(key);
        cache.set(key, entry);
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        return { ...entry, status: "live" };
      } catch (error) {
        const message = error?.name === "AbortError" ? "Kick took too long to respond." : "Kick is temporarily unavailable.";
        if (existing && now() - existing.timestamp < staleMs) return { ...existing, status: "cached", error: message };
        const snapshotClips = cursor?[]:snapshot.clips.filter((clip) => clip.channel === channel);
        if (snapshotClips.length) return { clips: snapshotClips, capturedAt: snapshot.capturedAt, status: "cached", error: message };
        return { clips: [], capturedAt: null, status: "unavailable", error: message };
      } finally {
        clearTimeout(timer);
      }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }

  return {
    async getClips(input) {
      const query = parseClipQuery(input);
      const values = await Promise.all(query.channels.map((channel) => load(channel, query.sort, query.time,query.cursor)));
      const sources = values.map((value, i) => ({
        channel: query.channels[i], status: value.status,
        count: selectClips(value.clips, query, now()).length,
        capturedAt: value.capturedAt,
        nextCursor:value.nextCursor||null,
        found:value.found,
        paginationIncomplete:value.paginationIncomplete||false,
      }));
      const errors = values.flatMap((value, i) => value.error ? [{ channel: query.channels[i], message: value.error }] : []);
      const cachedDates = values.filter((value) => value.status === "cached" && value.capturedAt).map((value) => value.capturedAt).sort();
      return {
        clips: selectClips(values.flatMap((value) => value.clips), query, now()),
        sources, errors,
        mode: values.some((value) => value.status === "cached") ? "cached" : "live",
        capturedAt: cachedDates[0] || (values.some((value) => value.status === "live") ? new Date(now()).toISOString() : null),
        sort: query.sort,
        time: query.time,
      };
    },
    clearCache() { cache.clear(); },
    get cacheSize() { return cache.size; },
  };
}
