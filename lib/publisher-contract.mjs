export const NETWORKS = ['instagram', 'tiktok', 'youtube', 'facebook'];

export function publishForm(post, targets, video, caption, origin, username, requestId) {
  const form = new FormData();
  form.set('user', username);
  for (const target of targets) form.append('platform[]', target);
  form.set('video', video, post.id + '.mp4');
  form.set('title', caption);
  form.set('youtube_title', post.title.slice(0, 100));
  form.set('youtube_description', caption + '\n\nWatch more: ' + origin + '/#clip=' + encodeURIComponent(post.id));
  form.set('privacyStatus', 'public');
  form.set('media_type', 'REELS');
  form.set('facebook_media_type', 'REELS');
  form.set('privacy_level', 'PUBLIC_TO_EVERYONE');
  form.set('async_upload', 'true');
  form.set('request_id', requestId);
  form.set('external_id', 'faze-' + post.id);
  return form;
}

function sourceUrl(value, platform) {
  const hosts = {instagram: ['instagram.com'], tiktok: ['tiktok.com'], youtube: ['youtube.com', 'youtu.be'], facebook: ['facebook.com', 'fb.watch']};
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts[platform]?.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return url.href;
  } catch {}
  return null;
}

export function publicationResult(data, platform) {
  const detail = (Array.isArray(data.results) ? data.results.find(x => x.platform === platform) : data.results?.[platform]) || data.platforms?.[platform];
  const url = sourceUrl(detail?.post_url || detail?.url, platform);
  let status = 'submitted', message = null;
  if (detail?.fallback_to_inbox || detail?.post_mode === 'MEDIA_UPLOAD') {
    status = 'draft'; message = 'Delivered to your TikTok inbox. Open TikTok to finish publishing.';
  } else if (detail?.skipped || detail?.success === false || detail?.status === 'failed' || (!detail && data.status === 'failed')) {
    status = 'failed'; message = 'The platform could not publish this clip. Review its account and media requirements before uploading again.';
  } else if (url && (detail?.success === true || detail?.status === 'completed')) {
    status = 'published';
  } else if (detail?.status === 'retryable') {
    message = 'The provider is retrying this platform. Do not upload another copy.';
  }
  return {status, url: status === 'published' ? url : null, message};
}

export function extractMetrics(data, platform) {
  const detail = data.platforms?.[platform];
  const metrics = detail?.success === true && !detail.post_metrics_error && detail.post_metrics_source === 'platform_api' ? detail.post_metrics : null;
  const count = value => {
    if ((typeof value !== 'number' && typeof value !== 'string') || value === '') return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  };
  // Profile snapshots describe the whole account, never this clip. Missing is not zero.
  return {likes: count(metrics?.likes), views: count(metrics?.views)};
}

export function connectedAccounts(profile) {
  return NETWORKS.flatMap(platform => {
    const account = profile?.social_accounts?.[platform];
    if (!account || typeof account !== 'object' || account.reauth_required || !(account.username || account.handle || account.display_name)) return [];
    return [{platform, name: account.handle || account.display_name || platform}];
  });
}

export function linkingUrl(value) {
  const url = new URL(value);
  if (url.origin !== 'https://app.upload-post.com' || url.pathname !== '/connect' || url.username || url.password || !url.searchParams.get('token')) throw Error('Unexpected linking destination.');
  return url.href;
}
