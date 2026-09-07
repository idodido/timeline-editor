const API = 'https://cdnapisec.kaltura.com/api_v3';

export interface KalturaConfig { pid: string; ks: string; }
let _config: KalturaConfig = { pid: '', ks: '' };
export const initKaltura = (config: KalturaConfig) => {
  _config = config;
  // Also wire up the summary microservice KS
  import('./summary-api').then(m => m.setSummaryKs(config.ks));
};
export const getConfig = () => _config;

// ── Core request helper ────────────────────────────────────────────────────
// Matches how the Kaltura TypeScript client sends requests:
//   URL  → /api_v3/service/{service}/action/{action}
//   Body → JSON  { ks, format:1, ...params }

const kRequest = async (service: string, action: string, body: Record<string, unknown>) => {
  const url = `${API}/service/${service}/action/${action}`;
  const payload = { ks: _config.ks, format: 1, ...body };
  console.log(`[kaltura:${service}.${action}]`, JSON.stringify(payload).slice(0, 300));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(`[kaltura:${service}.${action}] →`, text.slice(0, 300));

  let data: any;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Non-JSON response from ${service}.${action}: ${text.slice(0, 150)}`); }

  if (data?.objectType === 'KalturaAPIException')
    throw new Error(`Kaltura error (${service}.${action}): ${data.message || data.code}`);

  return data;
};

// ── Session ────────────────────────────────────────────────────────────────

export const startSession = async (pid: string, secret: string): Promise<string> => {
  const res = await fetch(`${API}/service/session/action/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partnerId: pid, secret, type: 2, expiry: 86400, format: 1 }),
  });
  const ks = await res.json();
  if (typeof ks !== 'string') throw new Error('Failed to generate KS — check partnerId and secret');
  return ks;
};

// ── Probe (temporary — remove once working) ───────────────────────────────

export const probeServices = async (ks: string): Promise<void> => {
  const tests = [
    { svc: 'annotation_annotation',    label: 'annotation_annotation' },
    { svc: 'annotation',               label: 'annotation' },
    { svc: 'thumbCuePoint_thumbCuePoint', label: 'thumbCuePoint_thumbCuePoint' },
    { svc: 'cuePoint_cuePoint',        label: 'cuePoint_cuePoint' },
  ];
  console.group('[kaltura:probe] JSON body format');
  for (const { svc, label } of tests) {
    try {
      const res = await fetch(`${API}/service/${svc}/action/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ks, format: 1,
          filter: { objectType: 'KalturaCuePointFilter', entryIdEqual: '1_6bpfq03q' },
          pager: { objectType: 'KalturaFilterPager', pageSize: 1 },
        }),
      });
      const t = await res.text();
      console.log(`${label} → ${t.slice(0, 120).replace(/\s+/g, ' ')}`);
    } catch (e: any) {
      console.log(`${label} → NETWORK ERROR: ${e.message}`);
    }
  }
  console.groupEnd();
};

// ── Cue Points ─────────────────────────────────────────────────────────────

export interface RawCuePoint {
  id: string; objectType: string; cuePointType: string;
  startTime: number; title?: string; description?: string; tags?: string;
  subType?: number; assetId?: string;
}

export const listCuePoints = async (entryId: string): Promise<RawCuePoint[]> => {
  // cuePoint_cuePoint returns all types (annotations + thumbCuePoints)
  const data = await kRequest('cuePoint_cuePoint', 'list', {
    filter: { objectType: 'KalturaCuePointFilter', entryIdEqual: entryId },
    pager:  { objectType: 'KalturaFilterPager', pageSize: 500, pageIndex: 1 },
  });
  return (data?.objects ?? []) as RawCuePoint[];
};

// Both chapters (subType=2) and slides (subType=1) are KalturaThumbCuePoint in MediaSpace

export const addChapter = (
  entryId: string, startTime: number, title: string, description: string, tags: string
): Promise<RawCuePoint> =>
  kRequest('cuePoint_cuePoint', 'add', {
    cuePoint: { objectType: 'KalturaThumbCuePoint', entryId, startTime, subType: 2, title, description, tags },
  });

export const addSlide = async (
  entryId: string, startTime: number, title: string, description: string, tags: string, imageFile: File | null
): Promise<RawCuePoint> => {
  // Step 1: create the cue point first (we need its ID before we can create the timed thumb asset)
  const created = await kRequest('cuePoint_cuePoint', 'add', {
    cuePoint: { objectType: 'KalturaThumbCuePoint', entryId, startTime, subType: 1, title, description, tags },
  }) as RawCuePoint;

  // Step 2: if there's an image, upload it as a KalturaTimedThumbAsset linked to this cue point
  if (imageFile) {
    const assetId = await uploadSlideImage(imageFile, created.id, entryId);
    // Step 3: update the cue point with the new assetId
    await kRequest('cuePoint_cuePoint', 'update', {
      id: created.id,
      cuePoint: { objectType: 'KalturaThumbCuePoint', subType: 1, assetId },
    });
    return { ...created, assetId };
  }

  return created;
};

export const updateCuePoint = (
  id: string, subType: number, startTime: number, title: string, description: string, tags: string
): Promise<void> =>
  kRequest('cuePoint_cuePoint', 'update', {
    id,
    cuePoint: { objectType: 'KalturaThumbCuePoint', subType, startTime, title, description, tags },
  });

export const deleteCuePoint = (id: string): Promise<void> =>
  kRequest('cuePoint_cuePoint', 'delete', { id });

// ── Image upload ───────────────────────────────────────────────────────────

// cuePointId is required by KalturaTimedThumbAsset — must create the cue point before calling this
export const uploadSlideImage = async (file: File, cuePointId: string, entryId: string): Promise<string> => {
  // 1. Create upload token
  const tokenData = await kRequest('uploadToken', 'add', {});
  const uploadTokenId: string = tokenData.id;

  // 2. Upload file (multipart — must NOT use JSON here)
  const formData = new FormData();
  formData.append('ks', _config.ks);
  formData.append('uploadTokenId', uploadTokenId);
  formData.append('resume', '0');
  formData.append('finalChunk', '1');
  formData.append('resumeAt', '0');
  formData.append('fileData', file, file.name);
  await fetch(`${API}/service/uploadToken/action/upload?format=1&ks=${encodeURIComponent(_config.ks)}`, {
    method: 'POST', body: formData,
  });

  // 3. Create timed thumb asset — requires cuePointId linking it to the slide cue point
  const assetData = await kRequest('thumbAsset', 'add', {
    entryId,
    thumbAsset: { objectType: 'KalturaTimedThumbAsset', cuePointId },
  });
  const assetId: string = assetData.id;

  // 4. Link upload token → thumb asset
  await kRequest('thumbAsset', 'setContent', {
    id: assetId,
    contentResource: { objectType: 'KalturaUploadedFileTokenResource', token: uploadTokenId },
  });

  return assetId;
};
