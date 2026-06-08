import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { AutoAwesome, Bookmark, Image } from '@mui/icons-material';
import { CuePoint, TimelineRuler } from './components/TimelineRuler';
import { CuePointForm } from './components/CuePointForm';
import { Player } from './components/Player';
import {
  startSession, initKaltura, getConfig,
  listCuePoints, addChapter, addSlide, updateCuePoint, deleteCuePoint,
  RawCuePoint,
} from './services/kaltura-api';

const DARK = {
  bg: '#121212',
  surface: '#1e1e1e',
  border: '#2e2e2e',
  text: '#ffffff',
  textSecondary: '#888888',
};

const DEFAULTS = {
  pid: '2222',
  secret: '2ee7cd4071bdf5af74a83b5b50ecaaf1',
  uiconfId: '57833242',
  entryId: '1_6bpfq03q',
};

const rawToCuePoint = (r: RawCuePoint): CuePoint => ({
  id: r.id,
  type: r.subType === 1 ? 'slide' : 'chapter',
  startTime: r.startTime,
  title: r.title || '',
  description: r.description || '',
  tags: r.tags || '',
  assetId: r.assetId,
  objectType: r.objectType,
  subType: r.subType,
});

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

export default function App() {
  const [mode, setMode] = useState<'choose' | 'own' | null>('choose');
  const [cfg, setCfg] = useState(EMPTY_CFG);
  const [activeConfig, setActiveConfig] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState('');
  const [initializing, setInitializing] = useState(false);

  const connect = async (config: typeof DEFAULTS) => {
    setInitializing(true);
    setInitError('');
    try {
      const ks = await startSession(config.pid, config.secret);
      initKaltura({ pid: config.pid, ks });
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

          {/* Logo / title */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={700} color="#006efa" gutterBottom>Kaltura Timeline Editor</Typography>
            <Typography sx={{ fontSize: 13, color: DARK.textSecondary }}>Add chapters and slides to a Kaltura entry</Typography>
          </Box>

          {/* Two option cards */}
          {mode === 'choose' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                fullWidth onClick={() => connect(DEFAULTS)} disabled={initializing}
                sx={{
                  backgroundColor: '#006efa', color: '#fff', py: 1.5, textTransform: 'none',
                  fontSize: 14, fontWeight: 600, borderRadius: 2,
                  '&:hover': { backgroundColor: '#004cad' },
                }}
              >
                {initializing ? <CircularProgress size={18} color="inherit" /> : 'Use test config'}
              </Button>
              <Button
                fullWidth onClick={() => setMode('own')}
                sx={{
                  backgroundColor: '#1e1e1e', color: '#fff', py: 1.5, textTransform: 'none',
                  fontSize: 14, fontWeight: 600, borderRadius: 2, border: '1px solid #3a3a3a',
                  '&:hover': { backgroundColor: '#2a2a2a' },
                }}
              >
                Use my own config
              </Button>
              {initError && <Alert severity="error" sx={{ mt: 1 }}>{initError}</Alert>}
            </Box>
          )}

          {/* Own config form */}
          {mode === 'own' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(Object.keys(fieldMeta) as (keyof typeof fieldMeta)[]).map(field => (
                <TextField key={field}
                  label={fieldMeta[field].label}
                  size="small" type={fieldMeta[field].type} value={cfg[field]}
                  onChange={e => setCfg(c => ({ ...c, [field]: e.target.value }))}
                  sx={inputDarkSx}
                />
              ))}
              {initError && <Alert severity="error">{initError}</Alert>}
              <Button
                fullWidth onClick={() => connect(cfg as typeof DEFAULTS)}
                disabled={initializing || !cfg.pid || !cfg.secret || !cfg.uiconfId || !cfg.entryId}
                sx={{ backgroundColor: '#006efa', color: '#fff', py: 1.2, textTransform: 'none', fontSize: 14, fontWeight: 600, borderRadius: 2, '&:hover': { backgroundColor: '#004cad' } }}
              >
                {initializing ? <CircularProgress size={18} color="inherit" /> : 'Connect'}
              </Button>
              <Button onClick={() => { setMode('choose'); setInitError(''); }}
                sx={{ color: DARK.textSecondary, textTransform: 'none', fontSize: 13 }}>
                ← Back
              </Button>
            </Box>
          )}

        </Box>
      </Box>
    );
  }

  return <TimelineEditor entryId={activeConfig.entryId} uiconfId={activeConfig.uiconfId} />;
}

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

  const { pid, ks } = getConfig();

  useEffect(() => {
    listCuePoints(entryId)
      .then(raw => { setCuePoints(raw.map(rawToCuePoint).sort((a, b) => a.startTime - b.startTime)); setLoading(false); })
      .catch((e: any) => { setError(e.message || 'Failed to load cue points'); setLoading(false); });
  }, [entryId]);

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: DARK.bg, color: DARK.text }}>

      {/* ── App header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, borderBottom: `1px solid ${DARK.border}`, flexShrink: 0,
        backgroundColor: DARK.surface,
      }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: DARK.text, flex: 1, textAlign: 'center' }}>
          Chapters &amp; slides
        </Typography>
        <Button
          size="small"
          sx={{
            color: DARK.text, fontSize: 12, textTransform: 'none',
            border: `1px solid ${DARK.border}`, px: 1.5, py: 0.5,
            '&:hover': { backgroundColor: '#2a2a2a' },
          }}
        >
          ✓ Publish to media
        </Button>
      </Box>

      {/* ── Middle: player + form side by side ── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Player */}
        <Box sx={{ flex: 1, minWidth: 0, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Player entryId={entryId} uiconfId={uiconfId} onReady={handlePlayerReady} />
        </Box>

        {/* Form panel */}
        {formOpen && formInitial && (
          <Box sx={{ width: 340, flexShrink: 0, borderLeft: `1px solid ${DARK.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <CuePointForm
              initial={formInitial}
              editingId={editingId}
              saving={saving}
              currentTime={currentTime}
              pid={pid}
              ks={ks}
              onSave={handleSave}
              onDelete={handleDelete}
              onCancel={closeForm}
            />
          </Box>
        )}
      </Box>

      {/* ── Bottom: timeline + toolbar ── */}
      <Box sx={{ flexShrink: 0, backgroundColor: DARK.surface, borderTop: `1px solid ${DARK.border}` }}>

        {/* Status messages */}
        {(success || error) && (
          <Box sx={{ px: 2, pt: 1 }}>
            {success && <Alert severity="success" sx={{ py: 0, fontSize: 11 }}>{success}</Alert>}
            {error && <Alert severity="error" sx={{ py: 0, fontSize: 11 }} onClose={() => setError('')}>{error}</Alert>}
          </Box>
        )}

        {/* Timeline */}
        {loading
          ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} sx={{ color: '#006efa' }} /></Box>
          : <TimelineRuler
              duration={duration}
              currentTime={currentTime}
              cuePoints={cuePoints}
              selectedId={selectedCp?.id ?? null}
              onSeek={seek}
              onSegmentClick={openEdit}
              pid={pid}
              ks={ks}
            />
        }

        {/* Bottom toolbar */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1, borderTop: `1px solid ${DARK.border}`,
        }}>
          <Button
            size="small" startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
            sx={{ color: DARK.text, fontSize: 12, textTransform: 'none', '&:hover': { backgroundColor: '#2a2a2a' } }}
          >
            Generate with AI
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small" startIcon={<Bookmark sx={{ fontSize: 14 }} />}
              onClick={() => openAdd('chapter')}
              sx={{ color: DARK.text, fontSize: 12, textTransform: 'none', '&:hover': { backgroundColor: '#2a2a2a' } }}
            >
              Add chapter
            </Button>
            <Button
              size="small" startIcon={<Image sx={{ fontSize: 14 }} />}
              onClick={() => openAdd('slide')}
              sx={{ color: DARK.text, fontSize: 12, textTransform: 'none', '&:hover': { backgroundColor: '#2a2a2a' } }}
            >
              Add slide
            </Button>
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
