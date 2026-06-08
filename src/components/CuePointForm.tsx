import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import { Close, Delete, CloudUpload, FormatBold, FormatItalic, FormatUnderlined, FormatListBulleted, FormatListNumbered, KeyboardArrowDown } from '@mui/icons-material';
import { CuePoint } from './TimelineRuler';

const DARK = {
  bg: '#1e1e1e',
  surface: '#2a2a2a',
  border: '#3a3a3a',
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  inputBg: '#141414',
};

interface Props {
  initial: Partial<CuePoint> & { startTime: number } | null;
  editingId: string | null;
  saving: boolean;
  currentTime: number; // seconds
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
  let secs = 0;
  if (parts.length === 2) secs = (parts[0] || 0) * 60 + (parts[1] || 0);
  else secs = parts[0] || 0;
  return secs * 1000;
};

const inputSx = {
  '& .MuiInputBase-root': {
    backgroundColor: DARK.inputBg,
    color: DARK.text,
    fontSize: 13,
    '& fieldset': { borderColor: DARK.border },
    '&:hover fieldset': { borderColor: '#555' },
    '&.Mui-focused fieldset': { borderColor: '#006efa' },
  },
  '& .MuiInputLabel-root': { color: DARK.textSecondary, fontSize: 13 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#006efa' },
};

export const CuePointForm = ({ initial, editingId, saving, currentTime, pid, ks, onSave, onDelete, onCancel }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type] = useState<'chapter' | 'slide'>(initial?.type ?? 'chapter');
  const [timeStr, setTimeStr] = useState(msToDisplay(initial?.startTime ?? 0));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tags] = useState(initial?.tags ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setTimeStr(msToDisplay(initial?.startTime ?? 0));
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setImageFile(null);
    setImagePreview(null);
  }, [initial, editingId]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const useCurrentTime = () => {
    const m = Math.floor(currentTime / 60);
    const s = Math.floor(currentTime % 60);
    setTimeStr(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  };

  const submit = () => onSave({ type, startTime: displayToMs(timeStr), title, description, tags, imageFile });

  // Build existing slide thumbnail URL if we have an assetId
  const existingThumb = initial?.assetId && pid && ks
    ? `https://cdnapisec.kaltura.com/p/${pid}/thumbnail/thumb_asset_id/${initial.assetId}/width/300/ks/${ks}`
    : null;

  const isSlide = type === 'slide';
  const isChapter = type === 'chapter';

  return (
    <Box sx={{ backgroundColor: DARK.bg, height: '100%', display: 'flex', flexDirection: 'column', color: DARK.text }}>

      {/* Type label row */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5, borderBottom: `1px solid ${DARK.border}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'default' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: DARK.textSecondary, textTransform: 'uppercase' }}>
            {type}
          </Typography>
          <KeyboardArrowDown sx={{ fontSize: 16, color: DARK.textSecondary }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {editingId && (
            <IconButton size="small" onClick={() => onDelete(editingId)} sx={{ color: '#ca1c2d', p: 0.5 }}>
              <Delete sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <IconButton size="small" onClick={onCancel} sx={{ color: DARK.textSecondary, p: 0.5 }}>
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Scrollable body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Timestamp */}
        <Box>
          <Typography sx={{ fontSize: 12, color: DARK.textSecondary, mb: 0.75 }}>Timestamp</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              value={timeStr}
              onChange={e => setTimeStr(e.target.value)}
              size="small"
              sx={{ width: 90, ...inputSx }}
              inputProps={{ style: { fontVariantNumeric: 'tabular-nums' } }}
            />
            <Button
              size="small"
              onClick={useCurrentTime}
              sx={{
                backgroundColor: '#2a2a2a', color: DARK.text, fontSize: 12, textTransform: 'none',
                border: `1px solid ${DARK.border}`, px: 1.5, py: 0.5,
                '&:hover': { backgroundColor: '#333' },
              }}
            >
              Use current time
            </Button>
          </Box>
        </Box>

        {/* Title */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 12, color: DARK.textSecondary }}>Title</Typography>
            <Typography sx={{ fontSize: 11, color: DARK.textSecondary }}>{title.length}/75</Typography>
          </Box>
          <TextField
            value={title}
            onChange={e => e.target.value.length <= 75 && setTitle(e.target.value)}
            size="small"
            fullWidth
            placeholder={isChapter ? 'Add chapter name' : 'Add slide name'}
            sx={inputSx}
          />
        </Box>

        {/* Summary / Description */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 12, color: DARK.textSecondary }}>{isChapter ? 'Summary' : 'Description'}</Typography>
            <Typography sx={{ fontSize: 11, color: DARK.textSecondary }}>{description.length}/500</Typography>
          </Box>
          {/* Formatting toolbar */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.25,
            px: 1, py: 0.5,
            backgroundColor: DARK.inputBg,
            border: `1px solid ${DARK.border}`,
            borderBottom: 'none',
            borderRadius: '4px 4px 0 0',
          }}>
            {[FormatBold, FormatItalic, FormatUnderlined, FormatListBulleted, FormatListNumbered].map((Icon, i) => (
              <IconButton key={i} size="small" sx={{ color: DARK.textSecondary, p: 0.4, '&:hover': { color: DARK.text, backgroundColor: '#333' } }}>
                <Icon sx={{ fontSize: 15 }} />
              </IconButton>
            ))}
          </Box>
          <TextField
            value={description}
            onChange={e => e.target.value.length <= 500 && setDescription(e.target.value)}
            multiline
            rows={4}
            fullWidth
            sx={{
              ...inputSx,
              '& .MuiInputBase-root': {
                ...inputSx['& .MuiInputBase-root'],
                borderRadius: '0 0 4px 4px',
                alignItems: 'flex-start',
              },
            }}
          />
        </Box>

        {/* Slide image */}
        {isSlide && (
          <Box>
            <Typography sx={{ fontSize: 12, color: DARK.textSecondary, mb: 0.75 }}>Slide</Typography>
            {(imagePreview || existingThumb) ? (
              <Box sx={{ position: 'relative' }}>
                <img
                  src={imagePreview || existingThumb!}
                  alt="slide"
                  style={{ width: '100%', borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: `1px solid ${DARK.border}` }}
                  onClick={() => fileInputRef.current?.click()}
                />
              </Box>
            ) : (
              <Box
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: `2px dashed ${dragOver ? '#006efa' : DARK.border}`,
                  borderRadius: 1.5, p: 2, textAlign: 'center', cursor: 'pointer',
                  backgroundColor: dragOver ? 'rgba(0,110,250,.08)' : DARK.inputBg,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                }}
              >
                <CloudUpload sx={{ color: DARK.textSecondary, fontSize: 24 }} />
                <Typography sx={{ fontSize: 12, color: DARK.textSecondary }}>Click or drag an image here</Typography>
              </Box>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </Box>
        )}
      </Box>

      {/* Footer actions */}
      <Box sx={{ p: 2, borderTop: `1px solid ${DARK.border}`, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button size="small" onClick={onCancel} disabled={saving}
          sx={{ color: DARK.textSecondary, fontSize: 12, textTransform: 'none', border: `1px solid ${DARK.border}`, '&:hover': { backgroundColor: '#333' } }}>
          Cancel
        </Button>
        <Button size="small" onClick={submit} disabled={saving || !title.trim()}
          sx={{ backgroundColor: '#006efa', color: '#fff', fontSize: 12, textTransform: 'none', '&:hover': { backgroundColor: '#004cad' }, '&:disabled': { backgroundColor: '#333', color: '#555' } }}>
          {saving ? <CircularProgress size={13} color="inherit" /> : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
