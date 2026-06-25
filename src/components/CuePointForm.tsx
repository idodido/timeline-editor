import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import { Delete, CloudUpload, FormatBold, FormatItalic, FormatUnderlined, FormatListBulleted, FormatListNumbered, KeyboardArrowRight, GpsFixed } from '@mui/icons-material';
import { CuePoint } from './TimelineRuler';

const D = {
  bg: 'transparent',
  border: 'rgba(255,255,255,0.2)',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.5)',
  inputBg: 'rgba(0,0,0,0.3)',
};

interface Props {
  initial: Partial<CuePoint> & { startTime: number } | null;
  editingId: string | null;
  saving: boolean;
  currentTime: number;
  pid: string;
  ks: string;
  onSave: (data: { type: 'chapter' | 'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File | null }) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const msToDisplay = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
};

const displayToMs = (v: string): number => {
  const parts = v.split(':').map(Number);
  const secs = parts.length === 2 ? (parts[0]||0)*60+(parts[1]||0) : (parts[0]||0);
  return secs * 1000;
};

const inputSx = {
  '& .MuiInputBase-root': {
    color: '#fff', backgroundColor: 'rgba(0,0,0,0.3)', fontSize: 14,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
    '&.Mui-focused fieldset': { borderColor: '#006efa' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#006efa' },
};

export const CuePointForm = ({ initial, editingId, saving, currentTime, pid, ks, onSave, onDelete, onCancel }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<'chapter' | 'slide'>(initial?.type ?? 'chapter');
  const [timeStr, setTimeStr] = useState(msToDisplay(initial?.startTime ?? 0));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    isDirty.current = false; // reset on every open/switch — prevents auto-save on load
    clearTimeout(autoSaveTimer.current);
    setType(initial?.type ?? 'chapter');
    setTimeStr(msToDisplay(initial?.startTime ?? 0));
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setImageFile(null);
    setImagePreview(null);
  }, [initial, editingId]);

  const isDirty = useRef(false);
  const autoSaveTimer = useRef<any>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const useCurrentTime = () => {
    const m = Math.floor(currentTime / 60), s = Math.floor(currentTime % 60);
    setTimeStr(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  };

  const isSlide = type === 'slide';
  const existingThumb = initial?.assetId && ks
    ? `https://cdnapisec.kaltura.com/api_v3/service/thumbAsset/action/serve?thumbAssetId=${initial.assetId}&ks=${encodeURIComponent(ks)}`
    : null;

  const labelSx = { fontSize: 14, fontWeight: 700, color: D.text, mb: 0.75 };
  const counterSx = { fontSize: 14, color: D.muted };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header: timestamp + title + collapse */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
        borderBottom: `1px solid ${D.border}`, flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: D.muted, textTransform: 'uppercase', minWidth: 36, textAlign: 'center' }}>
          {timeStr}
        </Typography>
        <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700, color: D.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title || `Untitled ${type}`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={onCancel} sx={{ color: D.muted, p: 0.5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '4px' }}>
            <KeyboardArrowRight sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Scrollable form body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Slide image — first for slides */}
        {isSlide && (
          <Box>
            <Typography sx={labelSx}>Slide</Typography>
            {(imagePreview || existingThumb) ? (
              <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                <img
                  src={imagePreview || existingThumb!}
                  alt="slide"
                  style={{ width: '100%', borderRadius: 6, objectFit: 'cover', display: 'block' }}
                />
                <Box sx={{
                  position: 'absolute', bottom: 0, right: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)', px: 1, py: 0.5,
                  borderRadius: '4px 0 0 0',
                }}>
                  <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Replace slide</Typography>
                </Box>
              </Box>
            ) : (
              <Box
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: `2px dashed ${dragOver ? '#006efa' : D.border}`,
                  borderRadius: 1.5, p: 2, textAlign: 'center', cursor: 'pointer',
                  backgroundColor: dragOver ? 'rgba(0,110,250,.05)' : 'rgba(0,0,0,0.2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                }}
              >
                <CloudUpload sx={{ color: D.muted, fontSize: 24 }} />
                <Typography sx={{ fontSize: 12, color: D.muted }}>Click or drag an image here</Typography>
              </Box>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </Box>
        )}

        {/* Title */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={labelSx}>{isSlide ? 'Slide name' : 'Chapter name'}</Typography>
            <Typography sx={counterSx}>{title.length}/75</Typography>
          </Box>
          <TextField
            value={title}
            onChange={e => e.target.value.length <= 75 && setTitle(e.target.value)}
            size="small" fullWidth
            placeholder={isSlide ? 'Untitled slide' : 'Untitled chapter'}
            sx={inputSx}
          />
        </Box>

        {/* Summary / Description */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={labelSx}>{isSlide ? 'Description' : 'Chapter summary'}</Typography>
            <Typography sx={counterSx}>{description.length}/500</Typography>
          </Box>
          {/* Rich text toolbar */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.25,
            backgroundColor: 'rgba(0,0,0,0.3)', border: `1px solid ${D.border}`,
            borderBottom: 'none', borderRadius: '4px 4px 0 0',
          }}>
            {[FormatBold, FormatItalic, FormatUnderlined, FormatListBulleted, FormatListNumbered].map((Icon, i) => (
              <IconButton key={i} size="small" sx={{ color: D.muted, p: 0.4, borderRadius: '4px', '&:hover': { color: D.text, backgroundColor: 'rgba(255,255,255,0.1)' } }}>
                <Icon sx={{ fontSize: 16 }} />
              </IconButton>
            ))}
          </Box>
          <TextField
            value={description}
            onChange={e => e.target.value.length <= 500 && setDescription(e.target.value)}
            multiline rows={4} fullWidth
            sx={{ ...inputSx, '& .MuiInputBase-root': { ...inputSx['& .MuiInputBase-root'], borderRadius: '0 0 4px 4px' } }}
          />
        </Box>

        {/* Timestamp */}
        <Box>
          <Typography sx={{ ...labelSx, mb: 0.75 }}>Timestamp</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              value={timeStr}
              onChange={e => setTimeStr(e.target.value)}
              size="small"
              sx={{ width: 90, ...inputSx }}
              inputProps={{ style: { fontVariantNumeric: 'tabular-nums' } }}
            />
            <IconButton
              onClick={useCurrentTime}
              size="small"
              title="Use current time"
              sx={{ backgroundColor: 'rgba(0,0,0,0.6)', color: D.text, borderRadius: '4px', p: 0.5, '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
            >
              <GpsFixed sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Bottom actions */}
      <Box sx={{ p: 1.5, borderTop: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>

        {/* New item: Create button */}
        {!editingId && (
          <Button fullWidth
            onClick={() => onSave({ type, startTime: displayToMs(timeStr), title, description, tags: initial?.tags ?? '', imageFile })}
            disabled={saving || !title.trim()}
            sx={{ backgroundColor: '#006efa', color: '#fff', textTransform: 'none', fontSize: 14, fontWeight: 700, borderRadius: '4px', '&:hover': { backgroundColor: '#004cad' }, '&:disabled': { backgroundColor: '#333', color: '#555' } }}>
            {saving ? <CircularProgress size={14} color="inherit" /> : `Create ${isSlide ? 'slide' : 'chapter'}`}
          </Button>
        )}

        {/* Existing item: Apply to player (saves but keeps form open) */}
        {editingId && (
          <Button fullWidth
            onClick={() => onSave({ type, startTime: displayToMs(timeStr), title, description, tags: initial?.tags ?? '', imageFile })}
            disabled={saving || !title.trim()}
            sx={{ backgroundColor: '#006efa', color: '#fff', textTransform: 'none', fontSize: 14, fontWeight: 700, borderRadius: '4px', '&:hover': { backgroundColor: '#004cad' }, '&:disabled': { backgroundColor: '#333', color: '#555' } }}>
            {saving ? <CircularProgress size={14} color="inherit" /> : 'Apply to player'}
          </Button>
        )}

        {/* Delete */}
        {editingId && (
          <Box onClick={() => !saving && onDelete(editingId)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: saving ? 'default' : 'pointer', color: '#ca1c2d', opacity: saving ? 0.5 : 1, py: 0.5, px: 1.5, borderRadius: '4px', '&:hover': { backgroundColor: 'rgba(202,28,45,0.1)' } }}>
            <Delete sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'inherit' }}>Delete {isSlide ? 'slide' : 'chapter'}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
