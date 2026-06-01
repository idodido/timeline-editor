import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, CircularProgress, IconButton, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { Close, Delete, CloudUpload } from '@mui/icons-material';
import { CuePoint } from './TimelineRuler';

interface Props {
  initial: Partial<CuePoint> & { startTime: number } | null;
  editingId: string | null;
  saving: boolean;
  onSave: (data: { type: 'chapter' | 'slide'; startTime: number; title: string; description: string; tags: string; imageFile: File | null }) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const msToDisplay = (ms: number) => {
  const s = Math.floor(ms / 1000), frac = ms % 1000;
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${String(ss).padStart(2,'0')}.${String(frac).padStart(3,'0')}`;
};

const displayToMs = (v: string): number => {
  const [left, fracStr = '0'] = v.split('.');
  const parts = left.split(':').map(Number);
  let secs = 0;
  if (parts.length === 3) secs = parts[0]*3600 + parts[1]*60 + parts[2];
  else if (parts.length === 2) secs = parts[0]*60 + parts[1];
  else secs = parts[0] || 0;
  return secs * 1000 + parseInt(fracStr.padEnd(3,'0').slice(0,3));
};

export const CuePointForm = ({ initial, editingId, saving, onSave, onDelete, onCancel }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<'chapter' | 'slide'>(initial?.type ?? 'chapter');
  const [timeStr, setTimeStr] = useState(msToDisplay(initial?.startTime ?? 0));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tags, setTags] = useState(initial?.tags ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setType(initial?.type ?? 'chapter');
    setTimeStr(msToDisplay(initial?.startTime ?? 0));
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setTags(initial?.tags ?? '');
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

  const submit = () => onSave({ type, startTime: displayToMs(timeStr), title, description, tags, imageFile });

  return (
    <Box sx={{
      borderTop: '1px solid #e0e0e0', backgroundColor: '#fafafa',
      p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flexShrink: 0,
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {editingId ? 'Edit marker' : 'Add marker'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {editingId && (
            <IconButton size="small" onClick={() => onDelete(editingId)} sx={{ color: '#ca1c2d' }}>
              <Delete fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={onCancel}><Close fontSize="small" /></IconButton>
        </Box>
      </Box>

      {/* Type */}
      <ToggleButtonGroup value={type} exclusive size="small"
        onChange={(_, v) => v && setType(v)}
        sx={{ '& .MuiToggleButton-root': { flex: 1, textTransform: 'none', fontSize: 13 } }}>
        <ToggleButton value="chapter">Chapter</ToggleButton>
        <ToggleButton value="slide">Slide</ToggleButton>
      </ToggleButtonGroup>

      {/* Time */}
      <TextField label="Time" value={timeStr} size="small" fullWidth
        onChange={e => setTimeStr(e.target.value)} placeholder="0:00.000" />

      {/* Title */}
      <TextField label="Title" value={title} size="small" fullWidth
        onChange={e => setTitle(e.target.value)} />

      {/* Description */}
      <TextField label="Description" value={description} size="small" fullWidth multiline rows={2}
        onChange={e => setDescription(e.target.value)} />

      {/* Tags */}
      <TextField label="Tags" value={tags} size="small" fullWidth
        placeholder="tag1, tag2" onChange={e => setTags(e.target.value)} />

      {/* Image upload — slides only */}
      {type === 'slide' && (
        <Box>
          <Typography variant="caption" color="text.secondary">Slide image (optional)</Typography>
          <Box
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              mt: 0.5, border: `2px dashed ${dragOver ? '#006efa' : '#ccc'}`,
              borderRadius: 2, p: 1.5, textAlign: 'center', cursor: 'pointer',
              minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: dragOver ? 'rgba(0,110,250,.05)' : '#fff',
              transition: 'all .15s',
            }}>
            {imagePreview
              ? <img src={imagePreview} alt="preview"
                  style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 4, objectFit: 'cover' }} />
              : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <CloudUpload sx={{ color: '#bbb', fontSize: 28 }} />
                  <Typography variant="caption" color="text.secondary">Click or drag an image here</Typography>
                </Box>
            }
          </Box>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" variant="outlined" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button size="small" variant="contained" onClick={submit}
          disabled={saving || !title.trim()}
          sx={{ backgroundColor: '#006efa', '&:hover': { backgroundColor: '#004cad' } }}>
          {saving ? <CircularProgress size={14} color="inherit" /> : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
