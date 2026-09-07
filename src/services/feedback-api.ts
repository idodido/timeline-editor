const API = 'https://cdnapisec.kaltura.com/api_v3';

// Feedback always goes to a fixed partner (2222), via a KS that is scoped to ONLY
// create KalturaDataEntry objects there — see the "one-time manual setup" step in
// the timeline-editor KMS plan. Safe to ship client-side because of that scoping,
// not because it's secret.
// Standalone/dev default comes from the build-time env var; an embedding host
// (KMS) overrides both at runtime via setFeedbackConfig, since it mints/owns
// these values itself (see the KMS module's default.ini).
let FEEDBACK_PARTNER_ID = import.meta.env.VITE_FEEDBACK_PARTNER_ID ?? '2222';
let FEEDBACK_KS = import.meta.env.VITE_FEEDBACK_KS ?? '';

export const setFeedbackConfig = (ks: string, partnerId?: string) => {
  FEEDBACK_KS = ks;
  if (partnerId) FEEDBACK_PARTNER_ID = partnerId;
};

export const isFeedbackConfigured = (): boolean => !!FEEDBACK_KS;

export interface FeedbackContext {
  kmsUserId?: string;
  entryId?: string;
}

export const submitFeedback = async (
  feedbackType: string,
  feedbackText: string,
  context: FeedbackContext = {}
): Promise<void> => {
  if (!FEEDBACK_KS) {
    throw new Error('Feedback is not configured (missing VITE_FEEDBACK_KS) — see .env.example');
  }

  // NOTE: the restricted feedback role can only create a KalturaDataEntry with
  // basic fields — it cannot set `userId` or `entitledUsersView` (both are
  // rejected: the entry is always owned by the KS's own session user). So all
  // submitter/entry context travels inside dataContent instead.
  const payload = {
    timestamp: new Date().toISOString(),
    page_url: window.location.href,
    entry_id: context.entryId ?? null,
    kms_user_id: context.kmsUserId ?? null,
    feedback_type: feedbackType,
    feedback_text: feedbackText,
  };

  const dataEntry = {
    objectType: 'KalturaDataEntry',
    name: `kms-feedback-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    tags: 'kms-feedback,timelineeditor',
    dataContent: JSON.stringify(payload),
  };

  const res = await fetch(`${API}/service/data/action/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Partner is implied by the KS itself.
    body: JSON.stringify({ ks: FEEDBACK_KS, format: 1, dataEntry }),
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Non-JSON response from data.add: ${text.slice(0, 150)}`); }

  if (data?.objectType === 'KalturaAPIException') {
    throw new Error(`Feedback submit failed: ${data.message || data.code}`);
  }
};

export const FEEDBACK_TYPES = ['Bug', 'Feature request', 'Confusing UI', 'Other'];

// exported for the one-off manual verification step in the plan (not used by the app)
export const _debugFeedbackPartnerId = FEEDBACK_PARTNER_ID;
