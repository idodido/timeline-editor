import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Button, CircularProgress, IconButton, TextField, Typography,
} from '@mui/material';
import {
  Delete, CloudUpload,
  FormatBold, FormatItalic, FormatUnderlined, FormatListBulleted, FormatListNumbered,
  GpsFixed, KeyboardArrowDown,
} from '@mui/icons-material';
import { CuePoint } from './TimelineRuler';

// ── colours ───────────────────────────────────────────────────────────────
const D = {
  border:  'rgba(255,255,255,0.12)',
  text:    '#ffffff',
  muted:   'rgba(255,255,255,0.5)',
  inputBg: 'rgba(0,0,0,0.3)',
  sectionLbl: 'rgba(255,255,255,0.4)',
};

const inputSx = {
  '& .MuiInputBase-root': {
    color: '#fff', backgroundColor: D.inputBg, fontSize: 13,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#006efa' },
  },
  '& .MuiInputLabel-root': { color: D.muted, fontSize: 13 },
};

const msToDisplay = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
};
const displayToMs = (v: string) => {
  const [m, s] = v.split(':').map(Number);
  return ((m||0)*60 + (s||0)) * 1000;
};

// ── Tab icons ─────────────────────────────────────────────────────────────
const ChapterTabIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="5"  width="16" height="2" rx="1" fill={active ? '#006efa' : 'rgba(255,255,255,0.5)'}/>
    <rect x="4" y="10" width="11" height="2" rx="1" fill={active ? '#006efa' : 'rgba(255,255,255,0.5)'}/>
    <rect x="4" y="15" width="13" height="2" rx="1" fill={active ? '#006efa' : 'rgba(255,255,255,0.5)'}/>
  </svg>
);
const SlideTabIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="14" rx="2" stroke={active ? '#006efa' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" fill="none"/>
    <path d="M7 13L10 9L13 13" stroke={active ? '#006efa' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" fill="none"/>
    <circle cx="8" cy="9" r="1.5" fill={active ? '#006efa' : 'rgba(255,255,255,0.5)'} opacity="0.6"/>
  </svg>
);

// ── Single accordion item (edit form) ────────────────────────────────────
interface ItemProps {
  cp: CuePoint;
  label?: string; // e.g. "Chapter 1", "Chapter 2"
  expanded: boolean;
  saving: boolean;
  currentTime: number;
  pid: string;
  ks: string;
  onToggle: () => void;
  onSave: (data: { type: 'chapter'|'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File|null }) => void;
  onDelete: (id: string) => void;
}

function AccordionItem({ cp, label, expanded, saving, currentTime, pid, ks, onToggle, onSave, onDelete }: ItemProps) {
  const [timeStr,     setTimeStr]     = useState(msToDisplay(cp.startTime));
  const [title,       setTitle]       = useState(cp.title);
  const [description, setDescription] = useState(cp.description);
  const [imageFile,   setImageFile]   = useState<File|null>(null);
  const [imagePreview,setImagePreview]= useState<string|null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when the cue point changes externally (e.g. after save)
  useEffect(() => {
    setTimeStr(msToDisplay(cp.startTime));
    setTitle(cp.title);
    setDescription(cp.description);
    setImageFile(null);
    setImagePreview(null);
  }, [cp.id, cp.startTime, cp.title, cp.description]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const submit = useCallback(() => {
    if (!title.trim()) return;
    onSave({ type: cp.type, startTime: displayToMs(timeStr), title, description, tags: cp.tags, imageFile });
  }, [cp.type, cp.tags, timeStr, title, description, imageFile, onSave]);

  const useCurrentTime = () => {
    const m = Math.floor(currentTime/60), s = Math.floor(currentTime%60);
    setTimeStr(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  };

  const isSlide = cp.type === 'slide';
  const existingThumb = cp.assetId && ks
    ? `https://cdnapisec.kaltura.com/api_v3/service/thumbAsset/action/serve?thumbAssetId=${cp.assetId}&ks=${encodeURIComponent(ks)}`
    : null;

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      elevation={0}
      sx={{
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        borderBottom: `1px solid ${D.border}`,
        '&:before': { display: 'none' },
        '& .MuiAccordionSummary-root': {
          minHeight: 48, px: 2, py: 0,
          backgroundColor: expanded ? 'rgba(0,110,250,0.1)' : 'transparent',
          '&:hover': { backgroundColor: expanded ? 'rgba(0,110,250,0.15)' : 'rgba(255,255,255,0.04)' },
        },
        '& .MuiAccordionSummary-expandIconWrapper': { color: expanded ? '#006efa' : D.muted },
        '& .MuiAccordionDetails-root': { px: 2, pt: 0, pb: 1.5, backgroundColor: 'rgba(0,0,0,0.2)' },
      }}
    >
      <AccordionSummary
        expandIcon={<KeyboardArrowDown sx={{ fontSize: 18, flexShrink: 0 }}/>}
        sx={{ '& .MuiAccordionSummary-content': { minWidth: 0, overflow: 'hidden' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, overflow: 'hidden', width: '100%' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: D.muted, flexShrink: 0, letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: label ? 'auto' : 32, fontVariantNumeric: 'tabular-nums' }}>
            {label || msToDisplay(cp.startTime)}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: expanded ? 700 : 400, color: D.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {cp.title || `Untitled ${cp.type}`}
          </Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
          onBlur={(e) => {
            // Auto-save when focus leaves the form entirely
            if (title.trim() && !e.currentTarget.contains(e.relatedTarget as Node)) {
              submit();
            }
          }}
        >
          {/* Slide image */}
          {isSlide && (
            <Box>
              {(imagePreview || existingThumb) ? (
                <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  <img src={imagePreview || existingThumb!} alt="slide" style={{ width: '100%', borderRadius: 6, objectFit: 'cover', display: 'block' }}/>
                  <Box sx={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', px: 1, py: 0.5, borderRadius: '4px 0 0 0' }}>
                    <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Replace slide</Typography>
                  </Box>
                </Box>
              ) : (
                <Box
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ border: `2px dashed ${dragOver ? '#006efa' : D.border}`, borderRadius: 1.5, p: 1.5, textAlign: 'center', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <CloudUpload sx={{ color: D.muted, fontSize: 20 }}/>
                  <Typography sx={{ fontSize: 11, color: D.muted }}>Click or drag image</Typography>
                </Box>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}/>
            </Box>
          )}

          {/* Title */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: D.text }}>{isSlide ? 'Slide name' : 'Chapter name'}</Typography>
              <Typography sx={{ fontSize: 11, color: D.muted }}>{title.length}/75</Typography>
            </Box>
            <TextField value={title} onChange={e => e.target.value.length <= 75 && setTitle(e.target.value)}
              size="small" fullWidth placeholder={isSlide ? 'Untitled slide' : 'Untitled chapter'} sx={inputSx}/>
          </Box>

          {/* Summary */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: D.text }}>{isSlide ? 'Description' : 'Chapter summary'}</Typography>
              <Typography sx={{ fontSize: 11, color: D.muted }}>{description.length}/500</Typography>
            </Box>
            <Box sx={{ backgroundColor: D.inputBg, border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px 4px 0 0', display: 'flex', gap: 0.25, px: 0.5, py: 0.25 }}>
              {[FormatBold, FormatItalic, FormatUnderlined, FormatListBulleted, FormatListNumbered].map((Icon, i) => (
                <IconButton key={i} size="small" sx={{ color: D.muted, p: 0.3, borderRadius: '3px', '&:hover': { color: D.text, backgroundColor: 'rgba(255,255,255,0.1)' } }}>
                  <Icon sx={{ fontSize: 14 }}/>
                </IconButton>
              ))}
            </Box>
            <TextField value={description} onChange={e => e.target.value.length <= 500 && setDescription(e.target.value)}
              multiline rows={2} fullWidth
              sx={{ ...inputSx, '& .MuiInputBase-root': { ...inputSx['& .MuiInputBase-root'], borderRadius: '0 0 4px 4px' }}}/>
          </Box>

          {/* Timestamp */}
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: D.text, mb: 0.5 }}>Timestamp</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField value={timeStr} onChange={e => setTimeStr(e.target.value)} size="small"
                sx={{ width: 80, ...inputSx }} inputProps={{ style: { fontVariantNumeric: 'tabular-nums' }}}/>
              <IconButton onClick={useCurrentTime} size="small" title="Use current time"
                sx={{ backgroundColor: 'rgba(0,0,0,0.6)', color: D.text, borderRadius: '4px', p: 0.5, '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}>
                <GpsFixed sx={{ fontSize: 16 }}/>
              </IconButton>
            </Box>
          </Box>

          {/* Delete */}
          <Box onClick={() => onDelete(cp.id)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', color: '#ca1c2d', py: 0.25, borderRadius: '4px', '&:hover': { backgroundColor: 'rgba(202,28,45,0.08)' } }}>
            <Delete sx={{ fontSize: 15 }}/>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'inherit' }}>Delete {isSlide ? 'slide' : 'chapter'}</Typography>
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

// ── Intro accordion (summary text, no timestamp, no delete) ──────────────
function IntroItem({ summaryText, expanded, onToggle, onChange }: {
  summaryText: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (text: string) => void;
}) {
  const [text, setText] = useState(summaryText);

  useEffect(() => { setText(summaryText); }, [summaryText]);

  return (
    <Accordion expanded={expanded} onChange={onToggle} disableGutters elevation={0} sx={{
      backgroundColor: 'transparent', backgroundImage: 'none',
      borderBottom: `1px solid ${D.border}`, '&:before': { display: 'none' },
      '& .MuiAccordionSummary-root': {
        minHeight: 48, px: 2, py: 0,
        backgroundColor: expanded ? 'rgba(0,110,250,0.1)' : 'transparent',
        '&:hover': { backgroundColor: expanded ? 'rgba(0,110,250,0.15)' : 'rgba(255,255,255,0.04)' },
      },
      '& .MuiAccordionSummary-expandIconWrapper': { color: expanded ? '#006efa' : D.muted },
      '& .MuiAccordionDetails-root': { px: 2, pt: 0, pb: 1.5, backgroundColor: 'rgba(0,0,0,0.2)' },
    }}>
      <AccordionSummary
        expandIcon={<KeyboardArrowDown sx={{ fontSize: 18 }}/>}
        sx={{ '& .MuiAccordionSummary-content': { minWidth: 0, overflow: 'hidden' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, overflow: 'hidden', width: '100%' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#006efa', flexShrink: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Intro
          </Typography>
          <Typography sx={{ fontSize: 13, color: expanded ? D.text : D.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {text || 'Add an intro summary…'}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: D.text }}>Video summary</Typography>
            <Typography sx={{ fontSize: 11, color: D.muted }}>{text.length}/500</Typography>
          </Box>
          <TextField
            value={text}
            onChange={e => { if (e.target.value.length <= 500) { setText(e.target.value); onChange(e.target.value); } }}
            multiline rows={3} fullWidth placeholder="Write a brief introduction or summary for the video…"
            sx={{ ...inputSx, '& .MuiInputBase-root': { ...inputSx['& .MuiInputBase-root'], borderRadius: '4px' }}}
          />
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
  cuePoints: CuePoint[];
  editingId: string | null;
  formInitial: (Partial<CuePoint> & { startTime: number }) | null;
  saving: boolean;
  currentTime: number;
  pid: string;
  ks: string;
  summaryText: string;
  onSummaryChange: (text: string) => void;
  onSave: (data: { type: 'chapter'|'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File|null }) => void;
  onDelete: (id: string) => void;
  onSelectCuePoint: (cp: CuePoint) => void;
  onAddNew: (type: 'chapter'|'slide') => void;
  onClose: () => void;
}

// Tab definitions
type Tab = 'intro' | 'chapter' | 'slide' | 'all';

const TabNav = ({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) => {
  const items: { id: Tab; icon: React.ReactNode; tooltip: string }[] = [
    {
      id: 'intro', tooltip: 'Intro',
      // Text/paragraph lines icon
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 3.5h14M2 7h9M2 10.5h11M2 14h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>,
    },
    {
      id: 'chapter', tooltip: 'Chapters',
      // Bookmark icon — matches Figma exactly
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 2h10a1 1 0 011 1v12.382a.5.5 0 01-.776.416L9 13.118l-5.224 2.68A.5.5 0 013 15.382V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      </svg>,
    },
    {
      id: 'slide', tooltip: 'Slides',
      // Stack/tray icon — matches Figma exactly
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="6" width="14" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <path d="M4 6V5a1 1 0 011-1h8a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M5.5 5V4a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" opacity="0.6"/>
      </svg>,
    },
    {
      id: 'all', tooltip: 'All',
      // ≡ with bidirectional arrows — matches the active blue icon in Figma
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M5 3L2 5l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13 3l3 2-3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>,
    },
  ];

  return (
    <Box sx={{ width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', pt: 1, borderRight: `1px solid ${D.border}`, backgroundColor: 'rgba(0,0,0,0.4)' }}>
      {items.map(({ id, icon, tooltip }) => {
        const isActive = active === id;
        return (
          <Box key={id} onClick={() => onChange(id)} title={tooltip} sx={{
            width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', borderRadius: '6px', mx: 'auto', mb: 0.5,
            color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
            backgroundColor: isActive ? '#006efa' : 'transparent',
            '&:hover': { backgroundColor: isActive ? '#006efa' : 'rgba(255,255,255,0.08)', color: '#fff' },
          }}>
            {icon}
          </Box>
        );
      })}
    </Box>
  );
};

export const RightPanel = ({
  cuePoints, editingId, formInitial, saving, currentTime, pid, ks,
  summaryText, onSummaryChange,
  onSave, onDelete, onSelectCuePoint, onAddNew, onClose,
}: Props) => {
  const activeType = formInitial?.type ?? 'chapter';
  const [tab, setTab] = useState<Tab>('chapter');

  // Sync tab when a new item is opened externally
  useEffect(() => {
    if (formInitial?.type) setTab(formInitial.type);
  }, [formInitial?.type]);

  // New-item form state (only used when editingId is null)
  const [newTimeStr,     setNewTimeStr]     = useState('00:00');
  const [newTitle,       setNewTitle]       = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageFile,   setNewImageFile]   = useState<File|null>(null);
  const newFileRef = useRef<HTMLInputElement>(null);
  const [newDragOver, setNewDragOver] = useState(false);

  useEffect(() => {
    if (!formInitial || formInitial.id) return; // only reset for "new" forms
    const m = Math.floor((formInitial.startTime/1000)/60), s = Math.floor((formInitial.startTime/1000)%60);
    setNewTimeStr(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    setNewTitle('');
    setNewDescription('');
    setNewImageFile(null);
  }, [formInitial]);

  const handleNewFile = useCallback((file: File) => { setNewImageFile(file); }, []);

  const submitNew = () => {
    if (!newTitle.trim()) return;
    onSave({ type: formInitial?.type ?? 'chapter', startTime: displayToMs(newTimeStr), title: newTitle, description: newDescription, tags: '', imageFile: newImageFile });
  };

  const isNewForm = formInitial && !editingId;
  const chapters  = cuePoints.filter(c => c.type === 'chapter').sort((a,b) => a.startTime - b.startTime);
  const slides    = cuePoints.filter(c => c.type === 'slide').sort((a,b) => a.startTime - b.startTime);

  // For "all" tab, interleave chapters and slides sorted by startTime
  const allItems  = [...chapters, ...slides].sort((a,b) => a.startTime - b.startTime);

  const getListItems = () => {
    if (tab === 'chapter') return chapters;
    if (tab === 'slide') return slides;
    if (tab === 'all') return allItems;
    return [];
  };
  const listItems = getListItems();

  const scrollSx = {
    flex: 1, overflowY: 'auto' as const, minHeight: 0,
    '&::-webkit-scrollbar': { width: '4px' },
    '&::-webkit-scrollbar-track': { background: 'transparent' },
    '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.2)', borderRadius: '4px' },
  };

  const renderEmptyState = (type: 'chapter' | 'slide') => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, pt: 4, gap: 1.5, textAlign: 'center' }}>
      <Box sx={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
        {type === 'chapter'
          ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="2" rx="1" fill="rgba(255,255,255,0.5)"/><rect x="4" y="10" width="11" height="2" rx="1" fill="rgba(255,255,255,0.5)"/><rect x="4" y="15" width="13" height="2" rx="1" fill="rgba(255,255,255,0.5)"/></svg>
          : <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="14" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none"/><path d="M7 13L10 9L13 13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none"/><circle cx="8" cy="9" r="1.5" fill="rgba(255,255,255,0.4)"/></svg>
        }
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: D.text }}>{type === 'chapter' ? 'Chapters' : 'Slides'}</Typography>
      <Typography sx={{ fontSize: 13, color: D.muted, lineHeight: 1.5, px: 1 }}>
        {type === 'chapter'
          ? 'Add chapters to help viewers navigate and understand the structure of your video.'
          : 'Add slides to provide visual context and help viewers follow along while watching.'}
      </Typography>
      <Button size="small" onClick={() => onAddNew(type)}
        sx={{ mt: 1, color: '#006efa', border: '1px solid #006efa', textTransform: 'none', fontSize: 13, fontWeight: 700, borderRadius: '4px', px: 2, backgroundColor: 'transparent', '&:hover': { backgroundColor: 'rgba(0,110,250,0.1)' } }}>
        + Add {type}
      </Button>
    </Box>
  );

  const renderAccordionList = (items: CuePoint[], withLabels: boolean) => items.map((cp, index) => {
    const chapterIndex = chapters.findIndex(c => c.id === cp.id);
    const label = withLabels && cp.type === 'chapter' && chapterIndex >= 0 ? `Chapter ${chapterIndex + 1}` : undefined;
    return (
      <AccordionItem key={cp.id} cp={cp} label={label}
        expanded={cp.id === editingId} saving={saving} currentTime={currentTime} pid={pid} ks={ks}
        onToggle={() => cp.id === editingId ? onSelectCuePoint({ ...cp, id: '' } as any) : onSelectCuePoint(cp)}
        onSave={onSave} onDelete={onDelete}
      />
    );
  });

  const renderNewItemForm = () => (
    <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${D.border}`, flexShrink: 0, backgroundColor: 'rgba(0,110,250,0.08)' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: D.sectionLbl, mb: 1 }}>
        New {tab === 'slide' ? 'slide' : 'chapter'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {(tab === 'slide' || (tab === 'all' && formInitial?.type === 'slide')) && (
          <Box onDragOver={e => { e.preventDefault(); setNewDragOver(true); }} onDragLeave={() => setNewDragOver(false)}
            onDrop={e => { e.preventDefault(); setNewDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleNewFile(f); }}
            onClick={() => newFileRef.current?.click()}
            sx={{ border: `2px dashed ${newDragOver ? '#006efa' : D.border}`, borderRadius: 1.5, p: 1.5, textAlign: 'center', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            {newImageFile ? <Typography sx={{ fontSize: 11, color: '#006efa' }}>{newImageFile.name}</Typography>
              : <><CloudUpload sx={{ color: D.muted, fontSize: 20 }}/><Typography sx={{ fontSize: 11, color: D.muted }}>Click or drag image</Typography></>}
          </Box>
        )}
        <input ref={newFileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleNewFile(f); e.target.value = ''; }}/>
        <TextField value={newTitle} onChange={e => e.target.value.length <= 75 && setNewTitle(e.target.value)}
          size="small" fullWidth placeholder={formInitial?.type === 'slide' ? 'Slide name' : 'Chapter name'} sx={inputSx} autoFocus/>
        <TextField value={newTimeStr} onChange={e => setNewTimeStr(e.target.value)} size="small"
          label="Timestamp" sx={{ width: 100, ...inputSx }} inputProps={{ style: { fontVariantNumeric: 'tabular-nums' }}}/>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" onClick={onClose} sx={{ flex: 1, color: D.muted, border: `1px solid ${D.border}`, textTransform: 'none', fontSize: 12, borderRadius: '4px' }}>Cancel</Button>
          <Button size="small" onClick={submitNew} disabled={saving || !newTitle.trim()}
            sx={{ flex: 1, backgroundColor: '#006efa', color: '#fff', textTransform: 'none', fontSize: 12, fontWeight: 700, borderRadius: '4px', '&:hover': { backgroundColor: '#004cad' }, '&:disabled': { backgroundColor: '#333', color: '#555' } }}>
            {saving ? <CircularProgress size={12} color="inherit"/> : 'Create'}
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)', overflow: 'hidden' }}>

      {/* ── Vertical icon nav ── */}
      <TabNav active={tab} onChange={t => { setTab(t); }} />

      {/* ── Content panel ── */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Intro tab */}
        {tab === 'intro' && (
          <Box sx={scrollSx}>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: D.sectionLbl }}>Video Intro</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: D.text }}>Summary</Typography>
                <Typography sx={{ fontSize: 11, color: D.muted }}>{summaryText.length}/500</Typography>
              </Box>
              <TextField
                value={summaryText}
                onChange={e => { if (e.target.value.length <= 500) onSummaryChange(e.target.value); }}
                multiline rows={5} fullWidth
                placeholder="Write a brief introduction or summary for the video…"
                sx={{ ...inputSx, '& .MuiInputBase-root': { ...inputSx['& .MuiInputBase-root'], borderRadius: '4px' }}}
              />
            </Box>
          </Box>
        )}

        {/* Chapter tab */}
        {tab === 'chapter' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {isNewForm && formInitial?.type === 'chapter' && renderNewItemForm()}
            <Box sx={scrollSx}>
              {chapters.length === 0 && !isNewForm ? renderEmptyState('chapter') : renderAccordionList(chapters, true)}
            </Box>
          </Box>
        )}

        {/* Slide tab */}
        {tab === 'slide' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {isNewForm && formInitial?.type === 'slide' && renderNewItemForm()}
            <Box sx={scrollSx}>
              {slides.length === 0 && !isNewForm ? renderEmptyState('slide') : renderAccordionList(slides, false)}
            </Box>
          </Box>
        )}

        {/* All tab */}
        {tab === 'all' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {isNewForm && renderNewItemForm()}
            <Box sx={scrollSx}>
              {allItems.length === 0 && !isNewForm ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: D.muted }}>No chapters or slides yet.</Typography>
                </Box>
              ) : renderAccordionList(allItems, true)}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
