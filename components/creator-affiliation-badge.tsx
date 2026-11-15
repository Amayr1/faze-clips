import {creatorAffiliation, FAZE_ROSTER_CHECKED, FAZE_ROSTER_SOURCE} from '@/lib/creator-affiliation.mjs';

function Emblem({status}: {status: 'member' | 'legacy' | 'unconfirmed'}) {
  return <svg viewBox="0 0 28 26" aria-hidden="true" focusable="false">
    <path className="affiliation-shield" d="M14 1.5 25 6v10L14 24.5 3 16V6Z"/>
    {status === 'unconfirmed'
      ? <g fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="14" cy="10" r="3"/><path d="M8.5 18c.5-5 10.5-5 11 0"/></g>
      : <><text x="14" y="16" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="900" letterSpacing="-.5">FZ</text>{status === 'legacy' && <path className="affiliation-rewind" d="m20 2-3 3 3 3M18 5h4a3 3 0 0 1 0 6"/>}</>}
  </svg>;
}

export default function CreatorAffiliationBadge({clip}: {clip: {provider?: string; channel?: string; url?: string}}) {
  const affiliation = creatorAffiliation(clip);
  const description = affiliation.label + '. ' + affiliation.detail +
    (affiliation.status === 'unconfirmed' ? '' : ' Roster checked ' + FAZE_ROSTER_CHECKED + '.');
  return <span className={'creator-affiliation creator-affiliation--' + affiliation.status}
    role="img" aria-label={description} title={description}><Emblem status={affiliation.status}/></span>;
}

export function CreatorBadgeLegend() {
  return <details className="creator-badge-legend"><summary>Creator badges</summary><div>
    <span><i className="creator-affiliation creator-affiliation--member"><Emblem status="member"/></i>FaZe active roster</span>
    <span><i className="creator-affiliation creator-affiliation--legacy"><Emblem status="legacy"/></i>FaZe legacy / alumni</span>
    <span><i className="creator-affiliation creator-affiliation--unconfirmed"><Emblem status="unconfirmed"/></i>Community · membership unconfirmed</span>
    <a href={FAZE_ROSTER_SOURCE} target="_blank" rel="noopener noreferrer">Roster source · checked {FAZE_ROSTER_CHECKED} ↗</a>
  </div></details>;
}
