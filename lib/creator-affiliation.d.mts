export const FAZE_ROSTER_SOURCE: string;
export const FAZE_ROSTER_CHECKED: string;
export type Affiliation = {status: 'member' | 'legacy' | 'unconfirmed'; label: string; detail: string};
export function creatorAffiliation(clip: {provider?: string; channel?: string; url?: string}): Affiliation;
