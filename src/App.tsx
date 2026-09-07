import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, IconButton, TextField, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
} from '@mui/material';
import { AutoAwesome, Add, ZoomIn, ZoomOut, FitScreen, Check, Feedback as FeedbackIcon } from '@mui/icons-material';
import { CuePoint, TimelineRuler } from './components/TimelineRuler';
import { RightPanel } from './components/RightPanel';
import { Player } from './components/Player';
import {
  startSession, initKaltura, getConfig,
  listCuePoints, addSlide, updateCuePoint, deleteCuePoint,
  RawCuePoint,
} from './services/kaltura-api';
import {
  getPublishedSummary, publishSummary, setSummaryKs,
  SummaryChapter,
} from './services/summary-api';
import { isFeedbackConfigured, setFeedbackConfig, submitFeedback, FEEDBACK_TYPES } from './services/feedback-api';

// ── Pending op types ──────────────────────────────────────────────────────
type PendingChapterOp =
  | { kind: 'chapter_set'; chapters: SummaryChapter[]; summary: string }; // full replace on publish

type PendingSlideOp =
  | { kind: 'add';    tempId: string; data: { startTime: number; title: string; description: string; tags: string; imageFile: File|null } }
  | { kind: 'update'; id: string;     data: { startTime: number; title: string; description: string; tags: string } }
  | { kind: 'delete'; id: string };

type PendingOp = PendingChapterOp | PendingSlideOp;

// ── Helpers ───────────────────────────────────────────────────────────────

const DARK = {
  bg: '#121212', surface: '#1e1e1e', border: '#2e2e2e',
  text: '#ffffff', textSecondary: '#888888',
};

const DEFAULTS = {
  pid: '2222',
  secret: '2ee7cd4071bdf5af74a83b5b50ecaaf1',
  uiconfId: '57833242',
  entryId: '1_6bpfq03q',
};

const EMPTY_CFG = { pid: '', secret: '', uiconfId: '', entryId: '' };

const fieldMeta = {
  pid:      { label: 'Partner ID',   type: 'text'     },
  secret:   { label: 'Admin Secret', type: 'password' },
  uiconfId: { label: 'uiConf ID',    type: 'text'     },
  entryId:  { label: 'Entry ID',     type: 'text'     },
} as const;

const inputDarkSx = {
  '& .MuiInputBase-root': { color: '#fff', backgroundColor: '#1e1e1e', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#666' } },
  '& .MuiInputLabel-root': { color: '#888' },
};

// Convert old-style cue point chapter → SummaryChapter (ms → seconds)
const cuePointToSummaryChapter = (cp: CuePoint): SummaryChapter => ({
  time: Math.round(cp.startTime / 1000),
  title: cp.title,
  description: cp.description,
});

// Convert SummaryChapter → CuePoint-like for the unified list (seconds → ms)
const summaryChapterToCuePoint = (ch: SummaryChapter, index: number): CuePoint => ({
  id: `sum_${index}_${ch.time}`,
  type: 'chapter',
  startTime: ch.time * 1000, // ms for timeline consistency
  title: ch.title,
  description: ch.description,
  tags: '',
  objectType: 'SummaryChapter',
  subType: 2,
});

// Converts any raw cue point — preserves subType so we can split chapters vs slides
const rawSlideToCuePoint = (r: RawCuePoint): CuePoint => ({
  id: r.id,
  type: r.subType === 1 ? 'slide' : 'chapter',
  startTime: r.startTime,
  title: r.title || '',
  description: r.description || '',
  tags: r.tags || '',
  assetId: r.assetId,
  objectType: r.objectType,
  subType: r.subType ?? 2,
});

// ── Embedded mode ─────────────────────────────────────────────────────────
// When hosted inside KMS (or any page that mints its own KS server-side),
// props arrive either as `window.__TIMELINE_EDITOR_PROPS__` (set by the host
// before this app mounts) or as URL query params (handy for manual testing).
// If a `ks` is present, the login screen is skipped entirely — the host
// already authenticated the user before this app ever loaded.

interface EmbedProps {
  ks: string;
  entryId: string;
  playerId?: string;
  serviceUrl?: string;
  partnerId?: string;
  feedbackKs?: string;
  feedbackPartnerId?: string;
  kmsUserId?: string;
}

declare global {
  interface Window { __TIMELINE_EDITOR_PROPS__?: EmbedProps; }
}

const readEmbedProps = (): EmbedProps | null => {
  if (window.__TIMELINE_EDITOR_PROPS__?.ks) return window.__TIMELINE_EDITOR_PROPS__;

  const params = new URLSearchParams(window.location.search);
  const ks = params.get('ks');
  if (!ks) return null;

  return {
    ks,
    entryId: params.get('entryId') ?? '',
    playerId: params.get('playerId') ?? undefined,
    serviceUrl: params.get('serviceUrl') ?? undefined,
    partnerId: params.get('partnerId') ?? undefined,
    feedbackKs: params.get('feedbackKs') ?? undefined,
    feedbackPartnerId: params.get('feedbackPartnerId') ?? undefined,
    kmsUserId: params.get('kmsUserId') ?? undefined,
  };
};

// ── Login screen ──────────────────────────────────────────────────────────

export default function App() {
  const [embedProps] = useState(() => readEmbedProps());
  const [mode, setMode] = useState<'choose' | 'own'>('choose');
  const [cfg, setCfg] = useState(EMPTY_CFG);
  const [activeConfig, setActiveConfig] = useState(() => embedProps
    ? { pid: embedProps.partnerId ?? '', secret: '', uiconfId: embedProps.playerId ?? '', entryId: embedProps.entryId }
    : DEFAULTS);
  const [ready, setReady] = useState(() => !!embedProps);
  const [initError, setInitError] = useState('');
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (!embedProps) return;
    initKaltura({ pid: embedProps.partnerId ?? '', ks: embedProps.ks });
    setSummaryKs(embedProps.ks);
    if (embedProps.feedbackKs) setFeedbackConfig(embedProps.feedbackKs, embedProps.feedbackPartnerId);
    // embedProps is read once at mount (useState initializer) and never changes — deliberately not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async (config: typeof DEFAULTS) => {
    setInitializing(true);
    setInitError('');
    try {
      const ks = await startSession(config.pid, config.secret);
      initKaltura({ pid: config.pid, ks });
      setSummaryKs(ks);
      setActiveConfig(config);
      setReady(true);
    } catch {
      setInitError('Could not connect to Kaltura. Check your credentials.');
    } finally {
      setInitializing(false);
    }
  };

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', p: 3, backgroundColor: DARK.bg }}>
        <Box sx={{ width: 380, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={700} color="#006efa" gutterBottom>Kaltura Timeline Editor</Typography>
            <Typography sx={{ fontSize: 13, color: DARK.textSecondary }}>Add chapters and slides to a Kaltura entry</Typography>
          </Box>
          {mode === 'choose' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button fullWidth onClick={() => connect(DEFAULTS)} disabled={initializing}
                sx={{ backgroundColor: '#006efa', color: '#fff', py: 1.5, textTransform: 'none', fontSize: 14, fontWeight: 600, borderRadius: 2, '&:hover': { backgroundColor: '#004cad' } }}>
                {initializing ? <CircularProgress size={18} color="inherit" /> : 'Use test config'}
              </Button>
              <Button fullWidth onClick={() => setMode('own')}
                sx={{ backgroundColor: '#1e1e1e', color: '#fff', py: 1.5, textTransform: 'none', fontSize: 14, fontWeight: 600, borderRadius: 2, border: '1px solid #3a3a3a', '&:hover': { backgroundColor: '#2a2a2a' } }}>
                Use my own config
              </Button>
              {initError && <Alert severity="error" sx={{ mt: 1 }}>{initError}</Alert>}
            </Box>
          )}
          {mode === 'own' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(Object.keys(fieldMeta) as (keyof typeof fieldMeta)[]).map(field => (
                <TextField key={field} label={fieldMeta[field].label} size="small" type={fieldMeta[field].type} value={cfg[field]}
                  onChange={e => setCfg(c => ({ ...c, [field]: e.target.value }))} sx={inputDarkSx} />
              ))}
              {initError && <Alert severity="error">{initError}</Alert>}
              <Button fullWidth onClick={() => connect(cfg as typeof DEFAULTS)} disabled={initializing || !cfg.pid || !cfg.secret || !cfg.uiconfId || !cfg.entryId}
                sx={{ backgroundColor: '#006efa', color: '#fff', py: 1.2, textTransform: 'none', fontSize: 14, fontWeight: 600, borderRadius: 2, '&:hover': { backgroundColor: '#004cad' } }}>
                {initializing ? <CircularProgress size={18} color="inherit" /> : 'Connect'}
              </Button>
              <Button onClick={() => { setMode('choose'); setInitError(''); }} sx={{ color: DARK.textSecondary, textTransform: 'none', fontSize: 13 }}>
                ← Back
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return <TimelineEditor entryId={activeConfig.entryId} uiconfId={activeConfig.uiconfId} kmsUserId={embedProps?.kmsUserId} />;
}

// ── Main editor ───────────────────────────────────────────────────────────

function TimelineEditor({ entryId, uiconfId, kmsUserId }: { entryId: string; uiconfId: string; kmsUserId?: string }) {
  const playerRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Chapters (from summary microservice) — stored as SummaryChapter[]
  const [summaryChapters, setSummaryChapters] = useState<SummaryChapter[]>([]);
  const [summaryText, setSummaryText] = useState('');

  // Slides (from cue points) — CuePoint[]
  const [slides, setSlides] = useState<CuePoint[]>([]);

  // Old-style cue point chapters found on load → migration prompt
  const [oldChapters, setOldChapters] = useState<CuePoint[]>([]);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Feedback (always goes to a fixed partner, independent of the current session) ──
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const openFeedback = useCallback(() => {
    setFeedbackType(FEEDBACK_TYPES[0]);
    setFeedbackText('');
    setFeedbackError('');
    setFeedbackSent(false);
    setFeedbackOpen(true);
  }, []);

  const submitFeedbackForm = useCallback(async () => {
    if (!feedbackText.trim()) return;
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      await submitFeedback(feedbackType, feedbackText.trim(), { entryId, kmsUserId });
      setFeedbackSent(true);
    } catch (e: any) {
      setFeedbackError(e.message || 'Failed to send feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackType, feedbackText, entryId, kmsUserId]);

  // Draft: chapters are tracked separately from slides
  // For chapters: we track the full list (replace-on-publish)
  // For slides: individual ops
  const [draftChapters, setDraftChapters] = useState<SummaryChapter[]>([]);
  const [draftSummaryText, setDraftSummaryText] = useState('');
  const [slidePendingOps, setSlidePendingOps] = useState<PendingSlideOp[]>([]);
  const chaptersDirty = useRef(false);

  // Combined cue points for timeline display
  const cuePoints: CuePoint[] = [
    ...draftChapters.map(summaryChapterToCuePoint),
    ...slides,
  ];

  const isDirty = chaptersDirty.current || slidePendingOps.length > 0;

  // ── Undo/redo ─────────────────────────────────────────────────────────
  type Snapshot = { chapters: SummaryChapter[]; summaryText: string; slides: CuePoint[]; slideOps: PendingSlideOp[] };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = useCallback((ch: SummaryChapter[], st: string, sl: CuePoint[], ops: PendingSlideOp[]) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { chapters: ch, summaryText: st, slides: sl, slideOps: ops }]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const applySnapshot = useCallback((snap: Snapshot) => {
    setDraftChapters(snap.chapters);
    setDraftSummaryText(snap.summaryText);
    setSlides(snap.slides);
    setSlidePendingOps(snap.slideOps);
    setEditingId(null); setSelectedCp(null); setFormInitial(null);
  }, []);

  const undo = useCallback(() => { if (canUndo) { applySnapshot(history[historyIndex]); setHistoryIndex(p => p - 1); } }, [canUndo, history, historyIndex, applySnapshot]);
  const redo = useCallback(() => { if (canRedo) { applySnapshot(history[historyIndex + 1]); setHistoryIndex(p => p + 1); } }, [canRedo, history, historyIndex, applySnapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ── Form state ────────────────────────────────────────────────────────
  const [selectedCp, setSelectedCp] = useState<CuePoint | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<(Partial<CuePoint> & { startTime: number }) | null>(null);

  const { pid, ks } = getConfig();

  // ── Load data ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        // Parallel: summary chapters + cue point slides
        const [summaryData, rawCuePoints] = await Promise.all([
          getPublishedSummary(entryId),
          listCuePoints(entryId),
        ]);

        const allCps = rawCuePoints.map(rawSlideToCuePoint);
        const cueSlides = allCps.filter(c => c.subType === 1);
        const cueChapters = allCps.filter(c => c.subType === 2); // old-style

        // Always load summary chapters if they exist
        if (summaryData?.chapters?.length) {
          setSummaryChapters(summaryData.chapters);
          setDraftChapters(summaryData.chapters);
          setSummaryText(summaryData.summary || '');
          setDraftSummaryText(summaryData.summary || '');
        }

        // Always show migration banner as long as old cue point chapters exist
        if (cueChapters.length > 0) {
          setOldChapters(cueChapters);
          setShowMigrationBanner(true);
        }

        setSlides(cueSlides);
        setLoading(false);
      } catch (e: any) {
        setError(e.message || 'Failed to load');
        setLoading(false);
      }
    };
    load();
  }, [entryId]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // ── Migration ─────────────────────────────────────────────────────────
  const migrate = useCallback(async () => {
    setMigrating(true);
    try {
      const migratedChapters = oldChapters
        .sort((a, b) => a.startTime - b.startTime)
        .map(cuePointToSummaryChapter);

      // 1. Write to summary microservice
      await publishSummary(entryId, { summary: '', chapters: migratedChapters });

      // 2. Delete old cue point chapters so the player doesn't show duplicates
      await Promise.all(oldChapters.map(ch => deleteCuePoint(ch.id)));

      setSummaryChapters(migratedChapters);
      setDraftChapters(migratedChapters);
      setOldChapters([]);
      chaptersDirty.current = false;
      setShowMigrationBanner(false);

      // Refresh player to remove old chapters
      try { playerRef.current?.loadMedia({ entryId }); } catch {}

      setSuccess(`Migrated ${migratedChapters.length} chapters — old chapters removed from player`);
    } catch (e: any) {
      setError(e.message || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  }, [entryId, oldChapters]);

  // ── Player ────────────────────────────────────────────────────────────
  const handlePlayerReady = useCallback((kp: any) => {
    playerRef.current = kp;
    kp.addEventListener('timeupdate', () => setCurrentTime(kp.currentTime));
    kp.addEventListener('loadedmetadata', () => setDuration(kp.duration));
    kp.addEventListener('durationchange', () => setDuration(kp.duration));
  }, []);

  const seek = useCallback((t: number) => {
    if (playerRef.current) playerRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  // ── Open/close form ───────────────────────────────────────────────────
  const openAdd = useCallback((type: 'chapter' | 'slide') => {
    try { if (playerRef.current) playerRef.current.pause(); } catch {}
    setEditingId(null); setSelectedCp(null);
    setFormInitial({ type, startTime: Math.round(currentTime * 1000), title: '', description: '', tags: '' });
  }, [currentTime]);

  const openEdit = useCallback((cp: CuePoint) => {
    if (!cp.id) { setSelectedCp(null); setEditingId(null); setFormInitial(null); return; }
    seek(cp.startTime / 1000);
    setSelectedCp(cp); setEditingId(cp.id);
    setFormInitial({ ...cp });
  }, [seek]);

  const closeForm = useCallback(() => {
    setEditingId(null); setSelectedCp(null); setFormInitial(null);
  }, []);

  // ── Local save ────────────────────────────────────────────────────────
  const handleSave = useCallback((data: { type: 'chapter'|'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File|null }) => {
    pushHistory(draftChapters, draftSummaryText, slides, slidePendingOps);

    if (data.type === 'chapter') {
      // Chapters → update the summary chapters array
      const timeInSec = Math.round(data.startTime / 1000);
      if (editingId && editingId.startsWith('sum_')) {
        // Edit existing
        const oldTimeSec = parseInt(editingId.split('_')[2]);
        setDraftChapters(prev => prev
          .map(ch => ch.time === oldTimeSec ? { time: timeInSec, title: data.title, description: data.description } : ch)
          .sort((a, b) => a.time - b.time));
        // Update selectedCp to reflect new id
        const updatedCp = summaryChapterToCuePoint({ time: timeInSec, title: data.title, description: data.description }, 0);
        setEditingId(`sum_0_${timeInSec}`);
        setSelectedCp(updatedCp);
        setFormInitial({ ...updatedCp });
      } else {
        // Add new
        const newChapter: SummaryChapter = { time: timeInSec, title: data.title, description: data.description };
        const updated = [...draftChapters, newChapter].sort((a, b) => a.time - b.time);
        setDraftChapters(updated);
        const idx = updated.findIndex(c => c.time === timeInSec && c.title === data.title);
        const newCp = summaryChapterToCuePoint(newChapter, idx);
        setEditingId(newCp.id);
        setSelectedCp(newCp);
        setFormInitial({ ...newCp });
      }
      chaptersDirty.current = true;
    } else {
      // Slides → cue point ops
      if (editingId && !editingId.startsWith('temp_')) {
        setSlides(prev => prev.map(s => s.id === editingId
          ? { ...s, startTime: data.startTime, title: data.title, description: data.description }
          : s).sort((a, b) => a.startTime - b.startTime));
        setSlidePendingOps(prev => {
          const without = prev.filter(op => !(op.kind === 'update' && op.id === editingId));
          return [...without, { kind: 'update', id: editingId, data }];
        });
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const newSlide: CuePoint = { id: tempId, type: 'slide', startTime: data.startTime, title: data.title, description: data.description, tags: data.tags, objectType: 'KalturaThumbCuePoint', subType: 1 };
        setSlides(prev => [...prev, newSlide].sort((a, b) => a.startTime - b.startTime));
        setSlidePendingOps(prev => [...prev, { kind: 'add', tempId, data }]);
        setEditingId(tempId);
        setSelectedCp(newSlide);
        setFormInitial({ ...newSlide });
      }
    }
  }, [editingId, draftChapters, draftSummaryText, slides, slidePendingOps, pushHistory]);

  const handleDelete = useCallback((id: string) => {
    pushHistory(draftChapters, draftSummaryText, slides, slidePendingOps);
    if (id.startsWith('sum_')) {
      const timeSec = parseInt(id.split('_')[2]);
      setDraftChapters(prev => prev.filter(ch => ch.time !== timeSec));
      chaptersDirty.current = true;
    } else {
      setSlides(prev => prev.filter(s => s.id !== id));
      setSlidePendingOps(prev => {
        if (id.startsWith('temp_')) return prev.filter(op => !(op.kind === 'add' && op.tempId === id));
        return [...prev.filter(op => !(op.kind === 'update' && op.id === id)), { kind: 'delete', id }];
      });
    }
    if (editingId === id) { setEditingId(null); setSelectedCp(null); setFormInitial(null); }
  }, [editingId, draftChapters, draftSummaryText, slides, slidePendingOps, pushHistory]);

  // ── Publish ───────────────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    try {
      // 1. Publish chapters to summary microservice
      if (chaptersDirty.current) {
        await publishSummary(entryId, { summary: draftSummaryText, chapters: draftChapters });
        setSummaryChapters(draftChapters);
        chaptersDirty.current = false;
      }
      // 2. Execute slide ops
      for (const op of slidePendingOps) {
        if (op.kind === 'add') {
          await (await import('./services/kaltura-api')).addSlide(entryId, op.data.startTime, op.data.title, op.data.description, op.data.tags, op.data.imageFile);
        } else if (op.kind === 'update') {
          await updateCuePoint(op.id, 1, op.data.startTime, op.data.title, op.data.description, op.data.tags);
        } else if (op.kind === 'delete') {
          await deleteCuePoint(op.id);
        }
      }
      setSlidePendingOps([]);
      // Reload slides from server
      const fresh = await listCuePoints(entryId);
      setSlides(fresh.map(rawSlideToCuePoint).filter(s => s.subType === 1));
      try { playerRef.current?.loadMedia({ entryId }); } catch {}
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  // ── Pill button style ─────────────────────────────────────────────────
  const pillSx = (primary?: boolean) => ({
    height: 32, px: 1.5, py: 1, textTransform: 'none' as const, fontSize: 13,
    fontWeight: 700, borderRadius: '4px', whiteSpace: 'nowrap' as const, minWidth: 0,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.3)',
    color: primary ? '#fff' : 'rgba(255,255,255,0.7)',
    background: primary ? 'linear-gradient(68deg, #006efa 11%, #2485ff 30%, #ff9dff 134%)' : 'transparent',
    '&:hover': { backgroundColor: primary ? undefined : 'rgba(255,255,255,0.08)' },
  });

  const pendingCount = slidePendingOps.length + (chaptersDirty.current ? 1 : 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000', color: '#fff' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, gap: 2, flexShrink: 0, height: 56 }}>
        <IconButton sx={{ color: '#fff', p: 0.5 }} onClick={closeForm}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        </IconButton>
        <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>Chapters &amp; slides</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isFeedbackConfigured() && (
            <Button sx={pillSx()} startIcon={<FeedbackIcon sx={{ fontSize: 16 }} />} onClick={openFeedback}>Feedback</Button>
          )}
          <Button sx={pillSx(true)} startIcon={<AutoAwesome sx={{ fontSize: 16 }} />}>Generate with AI</Button>
          <Button sx={pillSx()}>Save draft</Button>
          <Button
            disabled={publishing || !isDirty}
            onClick={handlePublish}
            sx={{
              ...pillSx(), border: 'none',
              backgroundColor: publishSuccess ? '#23803a' : '#006efa', color: '#fff',
              opacity: publishing ? 0.7 : 1,
              '&:hover': { backgroundColor: publishSuccess ? '#1a6030' : '#004cad' },
              '&:disabled': { backgroundColor: '#333', color: '#666' },
            }}
            startIcon={publishing ? <CircularProgress size={14} color="inherit" /> : <Check sx={{ fontSize: 16 }} />}
          >
            {publishSuccess ? 'Changes saved!' : isDirty ? `Publish to media (${pendingCount})` : 'Publish to media'}
          </Button>
        </Box>
      </Box>

      {/* ── Migration banner ── */}
      {showMigrationBanner && (
        <Box sx={{ backgroundColor: 'rgba(255,152,0,0.15)', border: '1px solid rgba(255,152,0,0.4)', px: 3, py: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#ff9800" strokeWidth="2" strokeLinecap="round"/></svg>
          <Typography sx={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
            We found <strong>{oldChapters.length} chapters</strong> in the old format. Migrate them to the new format — old chapters will be removed from the player and replaced with the new ones.
          </Typography>
          <Button size="small" onClick={() => setShowMigrationBanner(false)}
            sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: 12, minWidth: 0 }}>
            Dismiss
          </Button>
          <Button size="small" onClick={migrate} disabled={migrating}
            sx={{ backgroundColor: '#ff9800', color: '#000', textTransform: 'none', fontSize: 12, fontWeight: 700, borderRadius: '4px', px: 1.5, '&:hover': { backgroundColor: '#e68900' } }}>
            {migrating ? <CircularProgress size={14} /> : `Migrate ${oldChapters.length} chapters`}
          </Button>
        </Box>
      )}

      {/* ── Editor body ── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Main canvas */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <Box sx={{ flex: 1, minHeight: 0, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Player entryId={entryId} uiconfId={uiconfId} onReady={handlePlayerReady} />
          </Box>

          {/* Timeline area */}
          <Box sx={{ flexShrink: 0, backgroundColor: '#000', borderTop: '1px solid rgba(255,255,255,0.1)', pb: 1 }}>
            {(success || error) && (
              <Box sx={{ px: 2, pt: 1 }}>
                {success && <Alert severity="success" sx={{ py: 0, fontSize: 11 }}>{success}</Alert>}
                {error && <Alert severity="error" sx={{ py: 0, fontSize: 11 }} onClose={() => setError('')}>{error}</Alert>}
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 1.5, pb: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                {(['chapter','slide'] as const).map(type => (
                  <Button key={type} size="small" startIcon={<Add sx={{ fontSize: 16 }}/>} onClick={() => openAdd(type)}
                    sx={{ backgroundColor:'rgba(0,0,0,0.6)', color:'#fff', textTransform:'none', fontSize:13, fontWeight:700, borderRadius:'4px', px:1.5, py:0.75, border:'none', '&:hover':{ backgroundColor:'rgba(255,255,255,0.1)' } }}>
                    Add {type === 'chapter' ? 'chapter' : 'slide'}
                  </Button>
                ))}
                <Box sx={{ display:'flex', gap:0.5, ml:0.5 }}>
                  <IconButton size="small" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
                    sx={{ width:32, height:32, color: canUndo ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)', borderRadius:'4px', '&:hover':{ backgroundColor:'rgba(255,255,255,0.1)' } }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7.41421 11H17C19.2091 11 21 12.7909 21 15C21 17.2091 19.2091 19 17 19H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10 14L7 11L10 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </IconButton>
                  <IconButton size="small" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
                    sx={{ width:32, height:32, color: canRedo ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)', borderRadius:'4px', '&:hover':{ backgroundColor:'rgba(255,255,255,0.1)' } }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16.5858 11H7C4.79086 11 3 12.7909 3 15C3 17.2091 4.79086 19 7 19H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M14 14L17 11L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </IconButton>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[ZoomOut, ZoomIn, FitScreen].map((Icon, i) => (
                  <IconButton key={i} size="small" sx={{ color:'rgba(255,255,255,0.6)', p:0.5, borderRadius:'4px', '&:hover':{ backgroundColor:'rgba(255,255,255,0.1)' } }}>
                    <Icon sx={{ fontSize: 18 }}/>
                  </IconButton>
                ))}
              </Box>
            </Box>
            {loading
              ? <Box sx={{ display:'flex', justifyContent:'center', py:2 }}><CircularProgress size={20} sx={{ color:'#006efa' }}/></Box>
              : <TimelineRuler duration={duration} currentTime={currentTime} cuePoints={cuePoints}
                  selectedId={selectedCp?.id ?? null} onSeek={seek} onSegmentClick={openEdit}
                  pid={pid} ks={ks} entryId={entryId}/>
            }
          </Box>
        </Box>

        {/* Right panel */}
        <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <RightPanel
            cuePoints={cuePoints}
            editingId={editingId}
            formInitial={formInitial}
            saving={false}
            currentTime={currentTime}
            pid={pid}
            ks={ks}
            summaryText={draftSummaryText}
            onSummaryChange={(text) => {
              setDraftSummaryText(text);
              chaptersDirty.current = true;
            }}
            onSave={handleSave}
            onDelete={handleDelete}
            onSelectCuePoint={openEdit}
            onAddNew={openAdd}
            onClose={closeForm}
          />
        </Box>
      </Box>

      {/* ── Feedback dialog ── */}
      <Dialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { backgroundColor: DARK.surface, color: '#fff' } }}>
        <DialogTitle>Send feedback</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {feedbackSent ? (
            <Alert severity="success">Thanks — your feedback was sent.</Alert>
          ) : (
            <>
              <Select size="small" value={feedbackType} onChange={e => setFeedbackType(e.target.value)}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' } }}>
                {FEEDBACK_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
              <TextField multiline minRows={4} placeholder="What's on your mind?" value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)} sx={inputDarkSx} />
              {feedbackError && <Alert severity="error">{feedbackError}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackOpen(false)} sx={{ color: DARK.textSecondary, textTransform: 'none' }}>
            {feedbackSent ? 'Close' : 'Cancel'}
          </Button>
          {!feedbackSent && (
            <Button onClick={submitFeedbackForm} disabled={feedbackSubmitting || !feedbackText.trim()}
              sx={{ backgroundColor: '#006efa', color: '#fff', textTransform: 'none', '&:hover': { backgroundColor: '#004cad' } }}>
              {feedbackSubmitting ? <CircularProgress size={16} color="inherit" /> : 'Send'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
