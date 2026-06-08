import React, { useCallback, useRef } from 'react';

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
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${String(m).padStart(2,'0')}:${String(ss).padStart(2, '0')}`;
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
const SLIDE_COLOR    = 'rgba(0,160,120,0.25)';
const SLIDE_SEL      = 'rgba(0,160,120,0.5)';
const TRACK_HEIGHT         = 32;
const SLIDE_TRACK_HEIGHT   = 48; // taller so thumbnails are clearly visible

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

// Row icon for chapters
const ChapterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="#888"/>
    <rect x="2" y="7" width="8" height="1.5" rx="0.75" fill="#888"/>
    <rect x="2" y="11" width="10" height="1.5" rx="0.75" fill="#888"/>
  </svg>
);

// Row icon for slides
const SlideIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="2" width="14" height="10" rx="1.5" stroke="#888" strokeWidth="1.2" fill="none"/>
    <path d="M5 9L7.5 6L10 9" stroke="#888" strokeWidth="1.2" fill="none"/>
    <circle cx="5.5" cy="6.5" r="1" fill="#888" opacity="0.6"/>
  </svg>
);

function Track({
  segments, duration, currentTime, selectedId, emptyLabel,
  isSlide, color, selectedColor, borderColor, trackHeight,
  onSegmentClick, onRulerClick, rulerRef, pid, ks,
}: {
  segments: Segment[];
  duration: number;
  currentTime: number;
  selectedId: string | null;
  emptyLabel: string;
  isSlide: boolean;
  color: string;
  selectedColor: string;
  borderColor: string;
  trackHeight: number;
  onSegmentClick: (cp: CuePoint) => void;
  onRulerClick: (e: React.MouseEvent) => void;
  rulerRef: React.RefObject<HTMLDivElement>;
  pid?: string;
  ks?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      {/* Icon */}
      <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {isSlide ? <SlideIcon /> : <ChapterIcon />}
      </div>

      {/* Track */}
      <div
        ref={rulerRef}
        onClick={onRulerClick}
        style={{
          position: 'relative', flex: 1, height: trackHeight,
          backgroundColor: DARK.trackBg,
          borderRadius: 4,
          cursor: 'crosshair',
          overflow: 'hidden',
          border: `1px solid ${DARK.border}`,
        }}
      >
        {/* Empty state label */}
        {segments.length === 0 && duration > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#555', pointerEvents: 'none',
          }}>
            {emptyLabel}
          </div>
        )}

        {/* Playhead */}
        {duration > 0 && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: 2,
            left: `${(currentTime / duration) * 100}%`,
            backgroundColor: DARK.playhead,
            pointerEvents: 'none', zIndex: 10,
          }} />
        )}

        {segments.map(({ cp, startPct, widthPct }) => {
          const isSelected = cp.id === selectedId;
          // Use a tall thumbnail (height=80) so tiling looks good at track height
          const thumbUrl = cp.assetId && pid && ks
            ? `https://cdnapisec.kaltura.com/p/${pid}/thumbnail/thumb_asset_id/${cp.assetId}/height/80/ks/${ks}`
            : null;

          const hasThumbnail = isSlide && thumbUrl;

          return (
            <div
              key={cp.id}
              onClick={e => { e.stopPropagation(); onSegmentClick(cp); }}
              title={cp.title || fmt(cp.startTime / 1000)}
              style={{
                position: 'absolute',
                left: `${startPct}%`,
                width: `${widthPct}%`,
                top: 2, bottom: 2,
                backgroundColor: isSelected ? selectedColor : color,
                border: `2px solid ${isSelected ? '#006efa' : borderColor}`,
                borderRadius: 4,
                display: 'flex', alignItems: 'center',
                padding: hasThumbnail ? 0 : '0 6px',
                cursor: 'pointer',
                boxSizing: 'border-box',
                overflow: 'hidden',
                transition: 'border-color 0.1s',
                // Tile the thumbnail across the segment width
                backgroundImage: hasThumbnail ? `url(${thumbUrl})` : 'none',
                backgroundSize: 'auto 100%',
                backgroundRepeat: 'repeat-x',
                backgroundPosition: 'left center',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = '#006efa'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}
            >
              {/* Show title for chapters, or for slides without a thumbnail */}
              {!hasThumbnail && (
                <span style={{
                  fontSize: 11, fontWeight: 500, color: '#fff',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  pointerEvents: 'none',
                }}>
                  {cp.title || fmt(cp.startTime / 1000)}
                </span>
              )}
              {/* Selection overlay for slides with thumbnails */}
              {hasThumbnail && isSelected && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundColor: 'rgba(0,110,250,0.25)',
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TimelineRuler = ({ duration, currentTime, cuePoints, selectedId, onSeek, onSegmentClick, pid, ks }: Props) => {
  const chaptersRulerRef = useRef<HTMLDivElement>(null);
  const slidesRulerRef   = useRef<HTMLDivElement>(null);

  const pct = (t: number) => duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0;

  const handleRulerClick = useCallback((e: React.MouseEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || duration === 0) return;
    const r = ref.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
  }, [duration, onSeek]);

  // Ticks — aim for ~7, adapt based on duration
  const tickCount = 7;
  const ticks = duration > 0 ? Array.from({ length: tickCount }, (_, i) => (i / (tickCount - 1)) * duration) : [];

  const chapterSegments = buildSegments(cuePoints, duration, 'chapter');
  const slideSegments   = buildSegments(cuePoints, duration, 'slide');

  return (
    <div style={{ padding: '6px 12px 8px', userSelect: 'none', backgroundColor: DARK.bg }}>

      {/* Tick row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 20, flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: 14 }}>
          {/* Playhead dot above ruler */}
          {duration > 0 && (
            <div style={{
              position: 'absolute', top: 2,
              left: `${pct(currentTime)}%`,
              transform: 'translateX(-50%)',
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: DARK.playhead,
              pointerEvents: 'none', zIndex: 5,
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

      <Track
        segments={chapterSegments}
        duration={duration}
        currentTime={currentTime}
        selectedId={selectedId}
        emptyLabel="Click to add chapter"
        isSlide={false}
        color={CHAPTER_COLOR}
        selectedColor={CHAPTER_SEL}
        borderColor={CHAPTER_BORDER}
        trackHeight={TRACK_HEIGHT}
        onSegmentClick={onSegmentClick}
        onRulerClick={e => handleRulerClick(e, chaptersRulerRef)}
        rulerRef={chaptersRulerRef}
        pid={pid}
        ks={ks}
      />

      <Track
        segments={slideSegments}
        duration={duration}
        currentTime={currentTime}
        selectedId={selectedId}
        emptyLabel="Upload slide deck"
        isSlide={true}
        color={SLIDE_COLOR}
        selectedColor={SLIDE_SEL}
        borderColor="rgba(0,160,120,0.5)"
        trackHeight={SLIDE_TRACK_HEIGHT}
        onSegmentClick={onSegmentClick}
        onRulerClick={e => handleRulerClick(e, slidesRulerRef)}
        rulerRef={slidesRulerRef}
        pid={pid}
        ks={ks}
      />
    </div>
  );
};
