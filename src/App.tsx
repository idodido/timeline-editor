import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import { CuePoint, TimelineRuler } from './components/TimelineRuler';
import { CuePointList } from './components/CuePointList';
import { CuePointForm } from './components/CuePointForm';
import { Player } from './components/Player';
import {
  startSession, initKaltura,
  listCuePoints, addChapter, addSlide, updateCuePoint, deleteCuePoint,
  RawCuePoint,
} from './services/kaltura-api';

// ── Default config (change these to match your test environment) ──────────
const DEFAULTS = {
  pid: '2222',
  secret: '2ee7cd4071bdf5af74a83b5b50ecaaf1',
  uiconfId: '57833242',
  entryId: '1_6bpfq03q',
};

const rawToCuePoint = (r: RawCuePoint): CuePoint => ({
  id: r.id,
  // subType 1 = slide, subType 2 = chapter (both are KalturaThumbCuePoint in MediaSpace)
  type: r.subType === 1 ? 'slide' : 'chapter',
  startTime: r.startTime,
  title: r.title || '',
  description: r.description || '',
  tags: r.tags || '',
  assetId: r.assetId,
  objectType: r.objectType,
  subType: r.subType,
});

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    : `${m}:${String(ss).padStart(2,'0')}`;
};

export default function App() {
  // ── Config state ────────────────────────────────────────────────────────
  const [cfg, setCfg] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState('');
  const [initializing, setInitializing] = useState(false);

  const handleInit = async () => {
    setInitializing(true);
    setInitError('');
    try {
      const ks = await startSession(cfg.pid, cfg.secret);
      initKaltura({ pid: cfg.pid, ks });
setReady(true);
    } catch {
      setInitError('Could not connect to Kaltura. Check your Partner ID and Secret.');
    } finally {
      setInitializing(false);
    }
  };

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', p: 3 }}>
        <Box sx={{ width: 400, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h5" fontWeight={700} color="#006efa">Kaltura Timeline Editor</Typography>
          <TextField label="Partner ID" size="small" value={cfg.pid} onChange={e => setCfg(c => ({ ...c, pid: e.target.value }))} />
          <TextField label="Admin Secret" size="small" type="password" value={cfg.secret} onChange={e => setCfg(c => ({ ...c, secret: e.target.value }))} />
          <TextField label="uiConf ID" size="small" value={cfg.uiconfId} onChange={e => setCfg(c => ({ ...c, uiconfId: e.target.value }))} />
          <TextField label="Entry ID" size="small" value={cfg.entryId} onChange={e => setCfg(c => ({ ...c, entryId: e.target.value }))} />
          {initError && <Alert severity="error">{initError}</Alert>}
          <Button variant="contained" onClick={handleInit} disabled={initializing}
            sx={{ backgroundColor: '#006efa', '&:hover': { backgroundColor: '#004cad' } }}>
            {initializing ? <CircularProgress size={18} color="inherit" /> : 'Connect'}
          </Button>
        </Box>
      </Box>
    );
  }

  return <TimelineEditor entryId={cfg.entryId} uiconfId={cfg.uiconfId} />;
}

// ── Main Editor ──────────────────────────────────────────────────────────

function TimelineEditor({ entryId, uiconfId }: { entryId: string; uiconfId: string }) {
  const playerRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cuePoints, setCuePoints] = useState<CuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCp, setSelectedCp] = useState<CuePoint | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<(Partial<CuePoint> & { startTime: number }) | null>(null);

  // Load cue points
  useEffect(() => {
    listCuePoints(entryId)
      .then(raw => {
        setCuePoints(raw.map(rawToCuePoint).sort((a, b) => a.startTime - b.startTime));
        setLoading(false);
      })
      .catch((e: any) => { setError(e.message || 'Failed to load cue points'); setLoading(false); });
  }, [entryId]);

  // Auto-clear success message
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

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

  const openAdd = useCallback((type: 'chapter' | 'slide') => {
    try { if (playerRef.current) playerRef.current.pause(); } catch {}
    setEditingId(null);
    setSelectedCp(null);
    setFormInitial({ type, startTime: Math.round(currentTime * 1000), title: '', description: '', tags: '' });
    setFormOpen(true);
  }, [currentTime]);

  const openEdit = useCallback((cp: CuePoint) => {
    seek(cp.startTime / 1000);
    setSelectedCp(cp);
    setEditingId(cp.id);
    setFormInitial({ ...cp });
    setFormOpen(true);
  }, [seek]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setSelectedCp(null);
    setFormInitial(null);
  }, []);

  const handleSave = useCallback(async (data: { type: 'chapter' | 'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File | null }) => {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const cp = cuePoints.find(c => c.id === editingId)!;
        await updateCuePoint(editingId, cp.subType ?? (cp.type === 'slide' ? 1 : 2), data.startTime, data.title, data.description, data.tags);
        setCuePoints(prev => prev.map(c => c.id === editingId ? { ...c, ...data, imageFile: undefined } : c).sort((a, b) => a.startTime - b.startTime));
      } else if (data.type === 'chapter') {
        const raw = await addChapter(entryId, data.startTime, data.title, data.description, data.tags);
        setCuePoints(prev => [...prev, rawToCuePoint(raw)].sort((a, b) => a.startTime - b.startTime));
      } else {
        const raw = await addSlide(entryId, data.startTime, data.title, data.description, data.tags, data.imageFile);
        setCuePoints(prev => [...prev, rawToCuePoint(raw)].sort((a, b) => a.startTime - b.startTime));
      }
      setSuccess('Saved successfully');
      closeForm();
      try { playerRef.current?.loadMedia({ entryId }); } catch {}
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [editingId, cuePoints, entryId, closeForm]);

  const handleDelete = useCallback(async (id: string) => {
    setSaving(true);
    try {
      await deleteCuePoint(id);
      setCuePoints(prev => prev.filter(c => c.id !== id));
      setSuccess('Deleted');
      closeForm();
      try { playerRef.current?.loadMedia({ entryId }); } catch {}
    } catch {
      setError('Delete failed');
    } finally {
      setSaving(false);
    }
  }, [closeForm, entryId]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' }}>

      {/* Top: Player — 16:9 ratio, capped so the editor is always visible */}
      <Box sx={{ width: '100%', height: 'min(56.25vw, 58vh)', flexShrink: 0, backgroundColor: '#000', overflow: 'hidden' }}>
        <Player entryId={entryId} uiconfId={uiconfId} onReady={handlePlayerReady} />
      </Box>

      {/* Bottom: Editor panel */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid #e0e0e0', backgroundColor: '#fff' }}>

      {/* Time bar + Add button */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: '6px', borderBottom: '1px solid #eee', flexShrink: 0, gap: 1,
      }}>
        <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', color: '#555' }}>
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </Typography>
        {success && <Alert severity="success" sx={{ py: 0, fontSize: 11, flex: 1 }}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ py: 0, fontSize: 11, flex: 1 }} onClose={() => setError('')}>{error}</Alert>}
        <Button size="small" startIcon={<Add />} onClick={() => openAdd('chapter')}
          sx={{ fontSize: 12, textTransform: 'none', color: '#006efa', borderColor: '#006efa', border: '1px solid', flexShrink: 0 }}>
          Add new
        </Button>
      </Box>

      {/* Timeline ruler */}
      <Box sx={{ flexShrink: 0, pt: 1 }}>
        <TimelineRuler
          duration={duration}
          currentTime={currentTime}
          cuePoints={cuePoints}
          onSeek={seek}
          onMarkerClick={openEdit}
        />
      </Box>

      {/* List + Form — single scrollable column */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {formOpen && formInitial && (
          <CuePointForm
            initial={formInitial}
            editingId={editingId}
            saving={saving}
            onSave={handleSave}
            onDelete={handleDelete}
            onCancel={closeForm}
          />
        )}

        {loading
          ? <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={24} /></Box>
          : <CuePointList cuePoints={cuePoints} selectedId={selectedCp?.id ?? null} onSelect={openEdit} />
        }

        {!formOpen && !loading && (
          <Box sx={{ p: 1.5, borderTop: '1px solid #eee', textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Pause the player, then click + Chapter or + Slide to add a marker at the current time
            </Typography>
          </Box>
        )}
      </Box>
      {/* end right panel */}
      </Box>
    </Box>
  );
}
