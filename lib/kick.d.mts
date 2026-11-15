export interface Clip {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  channel: string;
  channelName: string;
  category: string;
  isMature: boolean;
  duration: number;
  views: number;
  createdAt: string;
  url: string;
}
export interface ClipSource {
  channel: string;
  status: "live" | "cached" | "unavailable";
  count: number;
  capturedAt: string | null;
  nextCursor: string | null;
  found?:boolean;
  paginationIncomplete?:boolean;
}
export interface ClipFeed {
  clips: Clip[];
  sources: ClipSource[];
  errors: { channel: string; message: string }[];
  mode: "live" | "cached";
  capturedAt: string | null;
  sort: "view" | "date";
  time: "all" | "day" | "week" | "month";
}
export interface ClipQuery { channels: string[]; sort: ClipFeed["sort"]; time: ClipFeed["time"]; cursor?:string }
export const DEFAULT_CHANNELS: string[];
export class InputError extends Error {}
export function parseClipQuery(input: string | URLSearchParams): ClipQuery;
export function trustedClipUrl(value: unknown, kind?: "video" | "thumbnail"): string;
export function normalizeClip(raw: unknown, requestedChannel: string,options?:{includeAllCategories?:boolean}): Clip | null;
export function createClipService(options?: {
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  ttlMs?: number;
  staleMs?: number;
  maxEntries?: number;
  includeAllCategories?:boolean;
  snapshot?: { clips: Clip[]; capturedAt: string | null };
}): { getClips(input: string | URLSearchParams): Promise<ClipFeed>; clearCache(): void; readonly cacheSize: number };
