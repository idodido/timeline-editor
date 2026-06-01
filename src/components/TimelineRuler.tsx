import { useCallback, useRef } from 'react';

export interface CuePoint {
  id: string;
  type: 'chapter' | 'slide';
  startTime: number; // ms
  title: string;
  description: string;
  tags: string;
  assetId?: string;
  objectType: string;
  subType?: number;
}

interface Props {
  duration: number;   // seconds
  currentTime: number; // seconds
  cuePoints: CuePoint[];
  onSeek: (t: number) => void;
  onMarkerClick: (cp: CuePoint) => void;
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${m}:${String(ss).padStart(2,'0')}`;
};

export const TimelineRuler = ({ duration, currentTime, cuePoints, onSeek, onMarkerClick }: Props) => {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = (t: number) => duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0;

  const ticks = duration > 0
    ? Array.from({ length: 7 }, (_, i) => (i / 6) * duration)
    : [];

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!barRef.current || duration === 0) return;
    const r = barRef.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
  }, [duration, onSeek]);

  return (
    <div style={{ padding: '8px 16px 12px', userSelect: 'none' }}>
      {/* Tick labels */}
      <div style={{ position: 'relative', height: 16, marginBottom: 4 }}>
        {ticks.map(t => (
          <span key={t} style={{
            position: 'absolute', left: `${pct(t)}%`, transform: 'translateX(-50%)',
            fontSize: 10, color: '#888', whiteSpace: 'nowrap',
          }}>{fmt(t)}</span>
        ))}
      </div>

      {/* Bar */}
      <div ref={barRef} onClick={handleClick} style={{
        position: 'relative', height: 8, borderRadius: 4,
        backgroundColor: '#ddd', cursor: 'pointer',
      }}>
        {/* Progress */}
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct(currentTime)}%`, borderRadius: 4, backgroundColor: '#006efa',
          pointerEvents: 'none',
        }} />

        {/* Playhead */}
        <div style={{
          position: 'absolute', top: -4, left: `${pct(currentTime)}%`,
          transform: 'translateX(-50%)', width: 16, height: 16, borderRadius: '50%',
          backgroundColor: '#006efa', boxShadow: '0 1px 4px rgba(0,0,0,.25)',
          pointerEvents: 'none', zIndex: 2,
        }} />

        {/* Markers */}
        {cuePoints.map(cp => (
          <div key={cp.id} title={cp.title || fmt(cp.startTime / 1000)}
            onClick={e => { e.stopPropagation(); onMarkerClick(cp); }}
            style={{
              position: 'absolute', left: `${pct(cp.startTime / 1000)}%`,
              top: -8, transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: 'pointer', zIndex: 3,
            }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
              borderTop: `10px solid ${cp.type === 'chapter' ? '#ff9800' : '#006efa'}`,
            }} />
            <div style={{ width: 2, height: 8, backgroundColor: cp.type === 'chapter' ? '#ff9800' : '#006efa' }} />
          </div>
        ))}
      </div>
    </div>
  );
};
