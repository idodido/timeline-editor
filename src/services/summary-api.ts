// Kaltura Summary Microservice — for new-style chapters
// Separate from the cuePoint API which handles slides

const SUMMARY_BASE = 'https://summary.nvp1.ovp.kaltura.com/api/v1';

let _ks = '';
export const setSummaryKs = (ks: string) => { _ks = ks; };

export interface SummaryChapter {
  time: number;   // seconds (NOT ms — different from cue points)
  title: string;
  description: string;
}

export interface SummaryData {
  summary: string;
  chapters: SummaryChapter[];
}

// ── Read ──────────────────────────────────────────────────────────────────

export const getPublishedSummary = async (entryId: string): Promise<SummaryData | null> => {
  const res = await fetch(`${SUMMARY_BASE}/summary/getPublishedSummary`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${_ks}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId }),
  });
  const text = await res.text();
  if (!text || text === 'null') return null;
  const data = JSON.parse(text);
  if (!data?.summaryOutputJson) return null;
  const parsed: SummaryData = typeof data.summaryOutputJson === 'string'
    ? JSON.parse(data.summaryOutputJson)
    : data.summaryOutputJson;
  return parsed;
};

// ── Write ─────────────────────────────────────────────────────────────────

export const publishSummary = async (entryId: string, data: SummaryData): Promise<void> => {
  const res = await fetch(`${SUMMARY_BASE}/summary/addPublishedSummary`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${_ks}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entryId,
      summaryOutputJson: JSON.stringify(data),
    }),
  });
  if (!res.ok) throw new Error(`Summary publish failed: ${res.status}`);
};
