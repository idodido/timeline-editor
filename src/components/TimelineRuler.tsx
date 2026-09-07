import React, { useCallback, useEffect, useRef, useState } from 'react';

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
  duration: number;    // seconds
  currentTime: number; // seconds
  cuePoints: CuePoint[];
  selectedId: string | null;
  onSeek: (t: number) => void;
  onSegmentClick: (cp: CuePoint) => void;
  pid?: string;
  ks?: string;
  entryId?: string;
  showWaveform?: boolean;
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const DARK = {
  bg: '#1a1a1a',
  trackBg: '#2a2a2a',
  border: '#3a3a3a',
  text: '#aaaaaa',
  playhead: '#006efa',
};

const CHAPTER_COLOR  = '#3a3a3a';
const CHAPTER_BORDER = '#888';
const CHAPTER_SEL    = '#555';
const SLIDE_COLOR    = 'rgba(0,160,120,0.15)';
const SLIDE_SEL      = 'rgba(0,160,120,0.4)';
const CHAPTER_HEIGHT = 32;
const SLIDE_HEIGHT   = 40;
const FILM_HEIGHT    = 40;

interface Segment { cp: CuePoint; startPct: number; widthPct: number; }

function buildSegments(cps: CuePoint[], duration: number, type: 'chapter' | 'slide'): Segment[] {
  if (duration === 0) return [];
  const filtered = cps.filter(c => c.type === type).sort((a, b) => a.startTime - b.startTime);
  const durationMs = duration * 1000;
  return filtered.map((cp, i) => {
    const nextStart = filtered[i + 1]?.startTime ?? durationMs;
    return {
      cp,
      startPct: (cp.startTime / durationMs) * 100,
      widthPct: ((nextStart - cp.startTime) / durationMs) * 100,
    };
  });
}

const ChapterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="#888"/>
    <rect x="2" y="7" width="8" height="1.5" rx="0.75" fill="#888"/>
    <rect x="2" y="11" width="10" height="1.5" rx="0.75" fill="#888"/>
  </svg>
);

const SlideIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="2" width="14" height="10" rx="1.5" stroke="#888" strokeWidth="1.2" fill="none"/>
    <path d="M5 9L7.5 6L10 9" stroke="#888" strokeWidth="1.2" fill="none"/>
    <circle cx="5.5" cy="6.5" r="1" fill="#888" opacity="0.6"/>
  </svg>
);

const FilmIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="3" width="14" height="10" rx="1" stroke="#888" strokeWidth="1.2" fill="none"/>
    <rect x="1" y="5" width="2" height="2" fill="#888"/>
    <rect x="1" y="9" width="2" height="2" fill="#888"/>
    <rect x="13" y="5" width="2" height="2" fill="#888"/>
    <rect x="13" y="9" width="2" height="2" fill="#888"/>
    <rect x="4" y="3" width="1" height="10" fill="#888" opacity="0.3"/>
    <rect x="7.5" y="3" width="1" height="10" fill="#888" opacity="0.3"/>
    <rect x="11" y="3" width="1" height="10" fill="#888" opacity="0.3"/>
  </svg>
);

// ── Chapter track ─────────────────────────────────────────────────────────

function ChapterTrack({ segments, duration, currentTime, selectedId, onSegmentClick, onRulerClick, rulerRef }: {
  segments: Segment[];
  duration: number;
  currentTime: number;
  selectedId: string | null;
  onSegmentClick: (cp: CuePoint) => void;
  onRulerClick: (e: React.MouseEvent) => void;
  rulerRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <ChapterIcon />
      </div>
      <div ref={rulerRef} onClick={onRulerClick} style={{
        position: 'relative', flex: 1, height: CHAPTER_HEIGHT,
        backgroundColor: DARK.trackBg, borderRadius: 4,
        cursor: 'crosshair', overflow: 'hidden', border: `1px solid ${DARK.border}`,
      }}>
        {segments.length === 0 && duration > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#555', pointerEvents: 'none' }}>
            Click to add chapter
          </div>
        )}
        {duration > 0 && <Playhead currentTime={currentTime} duration={duration} />}
        {segments.map(({ cp, startPct, widthPct }) => {
          const isSelected = cp.id === selectedId;
          return (
            <div key={cp.id}
              onClick={e => { e.stopPropagation(); onSegmentClick(cp); }}
              title={cp.title}
              style={{
                position: 'absolute', left: `${startPct}%`, width: `${widthPct}%`,
                top: 2, bottom: 2,
                backgroundColor: isSelected ? CHAPTER_SEL : CHAPTER_COLOR,
                border: `1px solid ${isSelected ? '#006efa' : CHAPTER_BORDER}`,
                borderRadius: 3, cursor: 'pointer', boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', padding: '0 6px', overflow: 'hidden',
                transition: 'border-color 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = '#006efa'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = CHAPTER_BORDER; }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                {cp.title || fmt(cp.startTime / 1000)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide track ───────────────────────────────────────────────────────────

function SlideTrack({ segments, duration, currentTime, selectedId, onSegmentClick, onRulerClick, rulerRef, pid, ks }: {
  segments: Segment[];
  duration: number;
  currentTime: number;
  selectedId: string | null;
  onSegmentClick: (cp: CuePoint) => void;
  onRulerClick: (e: React.MouseEvent) => void;
  rulerRef: React.RefObject<HTMLDivElement>;
  pid?: string;
  ks?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <SlideIcon />
      </div>
      <div ref={rulerRef} onClick={onRulerClick} style={{
        position: 'relative', flex: 1, height: SLIDE_HEIGHT,
        backgroundColor: DARK.trackBg, borderRadius: 4,
        cursor: 'crosshair', overflow: 'hidden', border: `1px solid ${DARK.border}`,
      }}>
        {segments.length === 0 && duration > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#555', pointerEvents: 'none' }}>
            Upload slide deck
          </div>
        )}
        {duration > 0 && <Playhead currentTime={currentTime} duration={duration} />}
        {segments.map(({ cp, startPct, widthPct }) => {
          const isSelected = cp.id === selectedId;
          const thumbUrl = cp.assetId && ks
            ? `https://cdnapisec.kaltura.com/api_v3/service/thumbAsset/action/serve?thumbAssetId=${cp.assetId}&ks=${encodeURIComponent(ks)}`
            : null;

          return (
            <div key={cp.id}
              onClick={e => { e.stopPropagation(); onSegmentClick(cp); }}
              title={cp.title}
              style={{
                position: 'absolute', left: `${startPct}%`, width: `${widthPct}%`,
                top: 2, bottom: 2,
                backgroundColor: isSelected ? SLIDE_SEL : SLIDE_COLOR,
                border: `2px solid ${isSelected ? '#006efa' : 'rgba(0,160,120,0.5)'}`,
                borderRadius: 3, cursor: 'pointer', boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', gap: 4,
                overflow: 'hidden', padding: '0 4px',
                transition: 'border-color 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = '#006efa'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,160,120,0.5)'; }}
            >
              {/* Thumbnail on the left */}
              {thumbUrl && (
                <img
                  src={thumbUrl} alt=""
                  style={{ height: '100%', width: 'auto', flexShrink: 0, objectFit: 'cover', borderRadius: 2, pointerEvents: 'none' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              {/* Title */}
              <span style={{ fontSize: 11, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                {cp.title || fmt(cp.startTime / 1000)}
              </span>
              {/* Selection overlay */}
              {isSelected && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,110,250,0.15)', pointerEvents: 'none' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Audio waveform overlay ────────────────────────────────────────────────

function Waveform({ entryId, ks, duration, width }: {
  entryId: string;
  ks: string;
  duration: number;
  width: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!entryId || !ks || duration === 0 || width === 0) return;

    const API = 'https://cdnapisec.kaltura.com/api_v3';
    fetch(`${API}/service/media/action/getVolumeMap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ks, format: 1, entryId }),
    })
      .then(r => r.text())
      .then(csv => {
        // Parse CSV: skip header, get pts (ms) and rms_level (dB, -90..0)
        const points: { t: number; db: number }[] = [];
        csv.split('\n').slice(1).forEach(line => {
          const [pts, rms] = line.split(',');
          if (pts && rms) {
            const t = parseFloat(pts);
            const db = parseFloat(rms);
            if (!isNaN(t) && !isNaN(db)) points.push({ t, db });
          }
        });
        if (points.length === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const HEIGHT = canvas.height;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, width, HEIGHT);

        // dB range: -90 (silence) to 0 (max). Map to 0..1 amplitude
        const dbToAmp = (db: number) => Math.max(0, Math.min(1, (db + 90) / 90));
        const durationMs = duration * 1000;

        // Draw waveform as filled path from center
        ctx.beginPath();
        const midY = HEIGHT / 2;

        points.forEach((p, i) => {
          const x = (p.t / durationMs) * width;
          const amp = dbToAmp(p.db);
          const h = amp * midY;
          if (i === 0) {
            ctx.moveTo(x, midY - h);
          } else {
            ctx.lineTo(x, midY - h);
          }
        });
        // Mirror bottom half
        for (let i = points.length - 1; i >= 0; i--) {
          const p = points[i];
          const x = (p.t / durationMs) * width;
          const amp = dbToAmp(p.db);
          const h = amp * midY;
          ctx.lineTo(x, midY + h);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 200, 120, 0.45)';
        ctx.fill();

        // Draw center line
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.strokeStyle = 'rgba(0, 200, 120, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        setLoaded(true);
      })
      .catch(() => {}); // silently ignore if unavailable
  }, [entryId, ks, duration, width]);

  if (!loaded && !canvasRef.current) {
    // pre-render canvas even before data loads
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={FILM_HEIGHT}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 2,
      }}
    />
  );
}

// ── Video filmstrip ───────────────────────────────────────────────────────

function Filmstrip({ duration, currentTime, pid, ks, entryId, onSeek }: {
  duration: number;
  currentTime: number;
  pid?: string;
  ks?: string;
  entryId?: string;
  onSeek: (t: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!ref.current || duration === 0) return;
    const r = ref.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
  }, [duration, onSeek]);

  // Generate ~20 evenly spaced frame thumbnails
  const FRAME_W = 60;
  const frameCount = 20;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <FilmIcon />
      </div>
      <div ref={ref} onClick={handleClick} style={{
        position: 'relative', flex: 1, height: FILM_HEIGHT,
        backgroundColor: '#111', borderRadius: 4,
        cursor: 'crosshair', overflow: 'hidden', border: `1px solid ${DARK.border}`,
        display: 'flex',
      }}>
        {duration > 0 && pid && entryId
          ? Array.from({ length: frameCount }, (_, i) => {
              const sec = Math.round((i / (frameCount - 1)) * duration);
              const url = `https://cdnapisec.kaltura.com/p/${pid}/thumbnail/entry_id/${entryId}/vid_sec/${sec}/width/${FRAME_W}/height/${FILM_HEIGHT}`;
              return (
                <img key={i} src={url} alt=""
                  style={{ flex: 1, height: '100%', objectFit: 'cover', pointerEvents: 'none', minWidth: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              );
            })
          : <div style={{ flex: 1, backgroundColor: '#222' }} />
        }
        {/* Waveform overlay — on top of thumbnails, below playhead */}
        {duration > 0 && ks && entryId && containerWidth > 0 && (
          <Waveform entryId={entryId} ks={ks} duration={duration} width={containerWidth} />
        )}
        {/* Playhead */}
        {duration > 0 && <Playhead currentTime={currentTime} duration={duration} />}
      </div>
    </div>
  );
}

// ── Shared playhead ───────────────────────────────────────────────────────

function Playhead({ currentTime, duration }: { currentTime: number; duration: number }) {
  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0, width: 2,
      left: `${(currentTime / duration) * 100}%`,
      backgroundColor: DARK.playhead,
      pointerEvents: 'none', zIndex: 10,
    }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────

export const TimelineRuler = ({ duration, currentTime, cuePoints, selectedId, onSeek, onSegmentClick, pid, ks, entryId }: Props) => {
  const chaptersRulerRef = useRef<HTMLDivElement>(null);
  const slidesRulerRef   = useRef<HTMLDivElement>(null);

  const pct = (t: number) => duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0;

  const handleRulerClick = useCallback((e: React.MouseEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || duration === 0) return;
    const r = ref.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
  }, [duration, onSeek]);

  const tickCount = 7;
  const ticks = duration > 0 ? Array.from({ length: tickCount }, (_, i) => (i / (tickCount - 1)) * duration) : [];
  const chapterSegments = buildSegments(cuePoints, duration, 'chapter');
  const slideSegments   = buildSegments(cuePoints, duration, 'slide');

  return (
    <div style={{ padding: '6px 12px 8px', userSelect: 'none', backgroundColor: DARK.bg }}>

      {/* Tick row with playhead dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 20, flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: 14 }}>
          {duration > 0 && (
            <div style={{
              position: 'absolute', top: 2, left: `${pct(currentTime)}%`,
              transform: 'translateX(-50%)',
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: DARK.playhead, pointerEvents: 'none', zIndex: 5,
            }} />
          )}
          {ticks.map(t => (
            <span key={t} style={{
              position: 'absolute', left: `${pct(t)}%`, transform: 'translateX(-50%)',
              fontSize: 9, color: DARK.text, whiteSpace: 'nowrap', top: 0,
            }}>{fmt(t)}</span>
          ))}
        </div>
      </div>

      <ChapterTrack
        segments={chapterSegments}
        duration={duration}
        currentTime={currentTime}
        selectedId={selectedId}
        onSegmentClick={onSegmentClick}
        onRulerClick={e => handleRulerClick(e, chaptersRulerRef)}
        rulerRef={chaptersRulerRef}
      />

      <SlideTrack
        segments={slideSegments}
        duration={duration}
        currentTime={currentTime}
        selectedId={selectedId}
        onSegmentClick={onSegmentClick}
        onRulerClick={e => handleRulerClick(e, slidesRulerRef)}
        rulerRef={slidesRulerRef}
        pid={pid}
        ks={ks}
      />

      <Filmstrip
        duration={duration}
        currentTime={currentTime}
        pid={pid}
        ks={ks}
        entryId={entryId}
        onSeek={onSeek}
      />
    </div>
  );
};
