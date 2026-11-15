// Editorial roster snapshot, not account verification. Update from the official
// ACTIVE/ALUMNI lists; never infer membership from a display name or clip title.
export const FAZE_ROSTER_SOURCE = 'https://fazeclan.com/pages/people';
export const FAZE_ROSTER_CHECKED = '2026-11-15';

const activeTwitch = new Set([
  'broky', 'karrigango', 'frozen', 'twistzz', 'jcobbb', 'zoomaa',
]);
const alumni = {
  kick: new Set(['yourrage', 'nickmercs']),
  twitch: new Set([
    'stableronaldo', 'yourrage', 'jasontheween', 'lacy', 'silky',
    'plaqueboymax', 'faze_adapt', 'fazeadapt', 'swagg', 'nickmercs',
    'faze_kalei', 'fazekalei', 'cizzorz', 'cloakzy', 'mongraal', 'tfue',
  ]),
};
const legacy = {
  kick: new Set(['fazerain']),
  twitch: new Set(['fazerain', 'fazeapex', 'fazetemperrr', 'fazebanks']),
};

export function creatorAffiliation(clip) {
  const provider = clip?.provider || 'kick';
  const channel = typeof clip?.channel === 'string' ? clip.channel.toLowerCase() : '';
  // A community upload's author/stream link does not establish membership.
  if (provider === 'upload' || !/^[a-z0-9_][a-z0-9_-]{0,29}$/.test(channel)) {
    return {status: 'unconfirmed', label: 'Community creator', detail: 'FaZe membership is not confirmed.'};
  }
  // Kick clip URLs include the broadcaster; reject conflicting attribution.
  if (provider === 'kick') {
    try {
      const url = new URL(clip.url);
      if (url.protocol !== 'https:' || url.hostname !== 'kick.com' ||
          url.pathname.split('/')[1].toLowerCase() !== channel ||
          !/^\/[a-z0-9][a-z0-9_-]{0,29}\/clips\//i.test(url.pathname)) {
        return {status: 'unconfirmed', label: 'Community creator', detail: 'FaZe membership is not confirmed.'};
      }
    } catch {
      return {status: 'unconfirmed', label: 'Community creator', detail: 'FaZe membership is not confirmed.'};
    }
  }
  if (provider === 'twitch' && activeTwitch.has(channel)) {
    return {status: 'member', label: 'FaZe member', detail: 'Listed on FaZe’s active roster.'};
  }
  if (legacy[provider]?.has(channel)) {
    return {status: 'legacy', label: 'FaZe legacy', detail: 'Listed in FaZe’s founders/history section; not an active-roster claim.'};
  }
  if (alumni[provider]?.has(channel)) {
    return {status: 'legacy', label: 'FaZe alumni', detail: 'Listed in FaZe’s alumni directory; not a current member badge.'};
  }
  return {status: 'unconfirmed', label: 'Community creator', detail: 'FaZe membership is not confirmed.'};
}
