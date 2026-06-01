import { Bookmark, Image } from '@mui/icons-material';
import { CuePoint } from './TimelineRuler';

interface Props {
  cuePoints: CuePoint[];
  selectedId: string | null;
  onSelect: (cp: CuePoint) => void;
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
};

export const CuePointList = ({ cuePoints, selectedId, onSelect }: Props) => {
  if (cuePoints.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: 13 }}>
        No chapters or slides yet. Pause the player and click + Chapter or + Slide.
      </div>
    );
  }

  return (
    <div>
      {cuePoints.map(cp => {
        const selected = cp.id === selectedId;
        return (
          <div key={cp.id} onClick={() => onSelect(cp)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', cursor: 'pointer',
            borderBottom: '1px solid #eee',
            backgroundColor: selected ? '#f0f6ff' : 'transparent',
            transition: 'background 0.1s',
          }}>
            {cp.type === 'chapter'
              ? <Bookmark style={{ color: '#ff9800', fontSize: 18, flexShrink: 0 }} />
              : <Image style={{ color: '#006efa', fontSize: 18, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#333',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {cp.title || '(untitled)'}
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>
                {fmt(cp.startTime)} · {cp.type === 'chapter' ? 'Chapter' : 'Slide'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
