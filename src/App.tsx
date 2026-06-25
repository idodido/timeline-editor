import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import { AutoAwesome, Add, ZoomIn, ZoomOut, FitScreen, Check, Delete, GpsFixed } from '@mui/icons-material';
import { CuePoint, TimelineRuler } from './components/TimelineRuler';
import { RightPanel } from './components/RightPanel';
import { Player } from './components/Player';
import {
  startSession, initKaltura, getConfig,
  listCuePoints, addChapter, addSlide, updateCuePoint, deleteCuePoint,
  uploadSlideImage, RawCuePoint,
} from './services/kaltura-api';

// ── Pending op types ──────────────────────────────────────────────────────
type PendingOp =
  | { kind: 'add';    tempId: string; data: { type: 'chapter'|'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File|null } }
  | { kind: 'update'; id: string;     data: { startTime: number; title: string; description: string; tags: string } }
  | { kind: 'delete'; id: string };

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

const rawToCuePoint = (r: RawCuePoint): CuePoint => {
  console.log('[rawToCuePoint]', r.id, 'objectType:', r.objectType, 'subType:', r.subType, 'cuePointType:', r.cuePointType);
  return {
    id: r.id,
    type: r.subType === 1 ? 'slide' : 'chapter',
    startTime: r.startTime,
    title: r.title || '',
    description: r.description || '',
    tags: r.tags || '',
    assetId: r.assetId,
    objectType: r.objectType,
    subType: r.subType,
  };
};

export default function App() {
  const [mode, setMode] = useState<'choose' | 'own'>('choose');
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

  return <TimelineEditor entryId={activeConfig.entryId} uiconfId={activeConfig.uiconfId} />;
}

// ── Main editor ───────────────────────────────────────────────────────────

function TimelineEditor({ entryId, uiconfId }: { entryId: string; uiconfId: string }) {
  const playerRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cuePoints, setCuePoints] = useState<CuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Undo/redo history ─────────────────────────────────────────────────
  // Each history entry is a snapshot of [cuePoints, pendingOps]
  type Snapshot = { cuePoints: CuePoint[]; pendingOps: PendingOp[] };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pendingOps, setPendingOps] = useState<PendingOp[]>([]);
  const isDirty = pendingOps.length > 0;

  // Push a snapshot BEFORE making a change
  const pushHistory = useCallback((currentCps: CuePoint[], currentOps: PendingOp[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, { cuePoints: currentCps, pendingOps: currentOps }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const snap = history[historyIndex];
    setCuePoints(snap.cuePoints);
    setPendingOps(snap.pendingOps);
    setHistoryIndex(prev => prev - 1);
    setEditingId(null);
    setSelectedCp(null);
    setFormInitial(null);
  }, [canUndo, history, historyIndex]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const snap = history[historyIndex + 1];
    setCuePoints(snap.cuePoints);
    setPendingOps(snap.pendingOps);
    setHistoryIndex(prev => prev + 1);
    setEditingId(null);
    setSelectedCp(null);
    setFormInitial(null);
  }, [canRedo, history, historyIndex]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
  const [selectedCp, setSelectedCp] = useState<CuePoint | null>(null);
  const [formOpen, setFormOpen] = useState(true); // panel always starts open
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
    if (!cp.id) {
      // deselect signal from accordion collapse
      setSelectedCp(null);
      setEditingId(null);
      setFormInitial(null);
      return;
    }
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

  // ── Local-only save (no API call) ────────────────────────────────────────
  const handleSave = useCallback((data: { type: 'chapter'|'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File|null }) => {
    pushHistory(cuePoints, pendingOps); // snapshot before change
    if (editingId) {
      // Update existing cue point locally
      setCuePoints(prev => prev
        .map(c => c.id === editingId ? { ...c, startTime: data.startTime, title: data.title, description: data.description, tags: data.tags } : c)
        .sort((a, b) => a.startTime - b.startTime));
      setPendingOps(prev => {
        // Merge: if there's already a pending add for this tempId, update its data
        const existingAdd = prev.find(op => op.kind === 'add' && op.tempId === editingId);
        if (existingAdd) {
          return prev.map(op => op.kind === 'add' && op.tempId === editingId ? { ...op, data: { ...op.data, ...data } } : op);
        }
        // Otherwise upsert an update op
        const withoutPrev = prev.filter(op => !(op.kind === 'update' && op.id === editingId));
        return [...withoutPrev, { kind: 'update', id: editingId, data }];
      });
    } else {
      // Add new cue point locally with a temp ID
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const newCp: CuePoint = {
        id: tempId, type: data.type,
        startTime: data.startTime, title: data.title,
        description: data.description, tags: data.tags,
        objectType: 'KalturaThumbCuePoint',
        subType: data.type === 'slide' ? 1 : 2,
      };
      setCuePoints(prev => [...prev, newCp].sort((a, b) => a.startTime - b.startTime));
      setPendingOps(prev => [...prev, { kind: 'add', tempId, data }]);
      setEditingId(tempId);
      setSelectedCp(newCp);
      setFormInitial({ ...newCp });
    }
  }, [editingId, cuePoints, pendingOps, pushHistory]);

  // ── Local-only delete (no API call) ──────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    pushHistory(cuePoints, pendingOps); // snapshot before change
    setCuePoints(prev => prev.filter(c => c.id !== id));
    setPendingOps(prev => {
      // If it was a pending add (temp ID), just drop the add op — nothing to delete on server
      if (id.startsWith('temp_')) return prev.filter(op => !(op.kind === 'add' && op.tempId === id));
      // Otherwise remove any pending update for it, and add a delete op
      const withoutUpdate = prev.filter(op => !(op.kind === 'update' && op.id === id));
      return [...withoutUpdate, { kind: 'delete', id }];
    });
    if (editingId === id) {
      setEditingId(null);
      setSelectedCp(null);
      setFormInitial(null);
    }
  }, [editingId, cuePoints, pendingOps, pushHistory]);

  // Header pill button style
  const pillSx = (primary?: boolean) => ({
    height: 32, px: 1.5, py: 1, textTransform: 'none' as const, fontSize: 13,
    fontWeight: 700, borderRadius: '4px', whiteSpace: 'nowrap' as const,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.3)',
    color: primary ? '#fff' : 'rgba(255,255,255,0.7)',
    minWidth: 0,
    background: primary ? 'linear-gradient(68deg, #006efa 11%, #2485ff 30%, #ff9dff 134%)' : 'transparent',
    '&:hover': { backgroundColor: primary ? undefined : 'rgba(255,255,255,0.08)' },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000', color: '#fff' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, gap: 2, flexShrink: 0, height: 56 }}>
        <IconButton sx={{ color: '#fff', p: 0.5 }} onClick={closeForm}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        </IconButton>
        <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>Chapters &amp; slides</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button sx={pillSx(true)} startIcon={<AutoAwesome sx={{ fontSize: 16 }} />}>Generate with AI</Button>
          <Button sx={pillSx()}>Save draft</Button>
          <Button
            disabled={publishing || !isDirty}
            onClick={async () => {
              setPublishing(true);
              setPublishSuccess(false);
              setError('');
              try {
                // Execute all pending ops in order
                for (const op of pendingOps) {
                  if (op.kind === 'add') {
                    if (op.data.type === 'chapter') {
                      await addChapter(entryId, op.data.startTime, op.data.title, op.data.description, op.data.tags);
                    } else {
                      await addSlide(entryId, op.data.startTime, op.data.title, op.data.description, op.data.tags, op.data.imageFile);
                    }
                  } else if (op.kind === 'update') {
                    const cp = cuePoints.find(c => c.id === op.id);
                    if (cp) await updateCuePoint(op.id, cp.subType ?? (cp.type === 'slide' ? 1 : 2), op.data.startTime, op.data.title, op.data.description, op.data.tags);
                  } else if (op.kind === 'delete') {
                    await deleteCuePoint(op.id);
                  }
                }
                setPendingOps([]);
                setIsDirty(false);
                // Reload cue points from server and refresh player
                const fresh = await listCuePoints(entryId);
                setCuePoints(fresh.map(rawToCuePoint).sort((a, b) => a.startTime - b.startTime));
                try { playerRef.current?.loadMedia({ entryId }); } catch {}
                setPublishSuccess(true);
                setTimeout(() => setPublishSuccess(false), 3000);
              } catch (e: any) {
                setError(e.message || 'Publish failed');
              } finally {
                setPublishing(false);
              }
            }}
            sx={{
              ...pillSx(),
              border: 'none',
              backgroundColor: publishSuccess ? '#23803a' : '#006efa',
              color: '#fff',
              opacity: publishing ? 0.7 : 1,
              '&:hover': { backgroundColor: publishSuccess ? '#1a6030' : '#004cad' },
              '&:disabled': { backgroundColor: '#333', color: '#666' },
            }}
            startIcon={publishing ? <CircularProgress size={14} color="inherit" /> : publishSuccess ? <Check sx={{ fontSize: 16, color: '#23803a' }} /> : <Check sx={{ fontSize: 16 }} />}
          >
            {publishSuccess ? 'Changes saved!' : isDirty ? `Publish to media (${pendingOps.length})` : 'Publish to media'}
          </Button>
        </Box>
      </Box>

      {/* ── Editor body: main-canvas + right panel (full height siblings) ── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Main canvas: player on top, timeline at bottom */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Player */}
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
            {/* Add buttons + zoom */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 1.5, pb: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                {(['chapter','slide'] as const).map(type => (
                  <Button key={type} size="small" startIcon={<Add sx={{ fontSize: 16 }}/>} onClick={() => openAdd(type)}
                    sx={{ backgroundColor:'rgba(0,0,0,0.6)', color:'#fff', textTransform:'none', fontSize:13, fontWeight:700, borderRadius:'4px', px:1.5, py:0.75, border:'none', '&:hover':{ backgroundColor:'rgba(255,255,255,0.1)' } }}>
                    Add {type === 'chapter' ? 'chapter' : 'slide deck'}
                  </Button>
                ))}
                {/* Undo / Redo */}
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
            {/* Timeline ruler */}
            {loading
              ? <Box sx={{ display:'flex', justifyContent:'center', py:2 }}><CircularProgress size={20} sx={{ color:'#006efa' }}/></Box>
              : <TimelineRuler duration={duration} currentTime={currentTime} cuePoints={cuePoints}
                  selectedId={selectedCp?.id ?? null} onSeek={seek} onSegmentClick={openEdit}
                  pid={pid} ks={ks} entryId={entryId}/>
            }
          </Box>
        </Box>

        {/* Right panel — always visible */}
        {true && (
          <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RightPanel
              cuePoints={cuePoints}
              editingId={editingId}
              formInitial={formInitial}
              saving={saving}
              currentTime={currentTime}
              pid={pid}
              ks={ks}
              onSave={handleSave}
              onDelete={handleDelete}
              onSelectCuePoint={openEdit}
              onAddNew={openAdd}
              onClose={closeForm}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
