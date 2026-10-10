import { panels } from '../../data/profile.ts';
import type { StationId } from './layout.ts';

// In-world text for the plaza. Every line is cut from the matching panel in src/data/profile.ts;
// board titles are the panel titles.
export const BOARDS: Record<StationId, { title: string; lines: string[]; result?: string }> = {
  'amazon-rewards': {
    title: panels['amazon-rewards'].title,
    lines: ['Points from non-bank partners', 'pay for rentals and purchases', '2 low-level designs', 'Verified end to end in Japan'],
  },
  'amazon-oncall-agent': {
    title: panels['amazon-oncall-agent'].title,
    lines: ['Picks up every new oncall ticket', 'Claude on Bedrock AgentCore', 'MCP tools find the root cause', 'Posts confidence and evidence'],
    result: 'About 30 min saved per ticket',
  },
  'amazon-migration': {
    title: panels['amazon-migration'].title,
    lines: ['Moved to two new EU regions', 'Shadow testing, then DNS shifts', 'Ramped to 100% in 4 countries'],
  },
  'amazon-retention': {
    title: panels['amazon-retention'].title,
    lines: ['Customer IDs kept 29 days', '21M rows purged, EMR + Spark', '6 AWS accounts, 3 environments', '8 data-retention obligations met'],
  },
  'amazon-connectors': {
    title: panels['amazon-connectors'].title,
    lines: ['All 4 message connectors moved', 'No playbook to start from', 'Staged A/B dial-up to 100%', 'Wrote the SOP the team now uses'],
  },
  'amazon-oncall': {
    title: panels['amazon-oncall'].title,
    lines: ['Production oncall', 'Day and night pages', 'Fixed before customer', 'impact or lost revenue'],
  },
};

export const TOY_TEXT = {
  flags: ['Japan', 'US', 'Brazil'],
  buyBox: 'buy box',
  ticket: 'ticket',
  sources: ['Logs', 'Metrics', 'Code', 'Runbooks'],
  report: ['Root cause', 'Confidence', 'Evidence'],
  countries: ['Spain', 'France', 'UK', 'Italy'],
  oldRegion: 'old region',
  newRegions: 'new regions',
  dublin: 'Dublin: 0 hosts',
  noImpact: 'no customer impact',
  storedData: 'stored data',
  retention: ['29-day TTL', '21M rows purged', 'stored data down 96%'], // the sign '29-day TTL · 21M rows purged · stored data down 96%', one part per line
  connectors: ['Connector 1', 'Connector 2', 'Connector 3', 'Connector 4'],
  full: '100%',
  sop: 'SOP',
  peaks: [['Black Friday /', 'Cyber Monday'], ['New Year'], ['Prime Day']], // banners: 'Black Friday / Cyber Monday', 'New Year', 'Prime Day'
  tickets: ['30+', 'high-severity tickets'],
};
