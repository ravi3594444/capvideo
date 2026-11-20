import React, { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Pause, PencilLine, Play, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  findActiveCaption,
  formatSec,
  getCaptionTimelineLayout,
  type CaptionCue,
} from '../utils/captions';

interface StudioTimelineBarProps {
  videoLoaded: boolean;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  isPlaying: boolean;
  loopClip: boolean;
  captions: CaptionCue[];
  previewLabel: string | null;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onSeekTo: (time: number, autoPlay?: boolean) => void;
  onEditActiveCue: (cue: CaptionCue) => void;
}

export function PlaybackScrubber({ currentTime, trimStart, trimEnd, duration, onSeekTo }: Pick<
  StudioTimelineBarProps, 'currentTime' | 'trimStart' | 'trimEnd' | 'duration' | 'onSeekTo'
>) {
  const seekEnd = Math.max(trimStart + 0.2, trimEnd || duration || 1);
  return (
    <Slider
      aria-label="Playback position"
      min={trimStart}
      max={seekEnd}
      step={0.05}
      value={[Math.min(Math.max(currentTime, trimStart), seekEnd)]}
      onValueChange={value => onSeekTo(typeof value === 'number' ? value : value[0], false)}
    />
  );
}

export function StudioTimelineBar({
  videoLoaded,
  duration,
  currentTime,
  trimStart,
  trimEnd,
  isPlaying,
  loopClip,
  captions,
  previewLabel,
  onTogglePlay,
  onToggleLoop,
  onSeekTo,
  onEditActiveCue,
}: StudioTimelineBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => captions.slice().sort((a, b) => a.start - b.start), [captions]);
  const maxCueEnd = sorted.reduce((acc, c) => Math.max(acc, c.end), 0);
  const timelineSpan = Math.max(1, duration || 0, trimEnd || 0, maxCueEnd);
  const activeCue = findActiveCaption(sorted, currentTime);
  const activeIdx = activeCue ? sorted.findIndex((c) => c.id === activeCue.id) : -1;
  const { clips, laneCount } = useMemo(() => getCaptionTimelineLayout(sorted, timelineSpan), [sorted, timelineSpan]);

  const jumpRelativeCue = (dir: -1 | 1) => {
    if (!sorted.length) return;
    if (activeIdx >= 0) {
      const targetIdx = Math.max(0, Math.min(sorted.length - 1, activeIdx + dir));
      onSeekTo(sorted[targetIdx].start, false);
      return;
    }
    if (dir > 0) {
      const next = sorted.find((c) => c.start > currentTime) ?? sorted[0];
      onSeekTo(next.start, false);
    } else {
      const prev =
        sorted
          .slice()
          .reverse()
          .find((c) => c.start < currentTime) ?? sorted[sorted.length - 1];
      onSeekTo(prev.start, false);
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = Math.round(ratio * timelineSpan * 100) / 100;
    onSeekTo(targetTime, false);
  };

  if (!videoLoaded && !captions.length) {
    return (
      <section aria-label="Timeline" className="workspace-timeline editor-timeline-empty">
        <h3 className="workspace-section-label">Timeline</h3>
        <p>Your clip and caption timings will appear here.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Timeline"
      className="workspace-timeline px-4 py-3 space-y-2.5"
    >
      <h3 className="workspace-section-label">Timeline</h3>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!videoLoaded}
            onClick={onTogglePlay}
            className="cursor-pointer font-semibold whitespace-nowrap"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Play</span>
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!sorted.length}
            aria-label="Jump to previous caption line"
            onClick={() => jumpRelativeCue(-1)}
            className="cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!sorted.length}
            aria-label="Jump to next caption line"
            onClick={() => jumpRelativeCue(1)}
            className="cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant={loopClip ? 'default' : 'outline'}
            size="sm"
            aria-pressed={loopClip}
            onClick={onToggleLoop}
            className="cursor-pointer whitespace-nowrap"
          >
            <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Loop</span>
          </Button>
          <span className="font-mono text-xs text-muted-foreground tabular-nums pl-1.5">
            {formatSec(currentTime)} / {formatSec(timelineSpan)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs min-w-0">
          {previewLabel ? (
            <span className="font-semibold text-foreground truncate max-w-[260px]">
              Previewing: {previewLabel} · Click card to apply
            </span>
          ) : activeCue ? (
            <button
              type="button"
              onClick={() => onEditActiveCue(activeCue)}
              className="inline-flex items-center gap-1.5 text-left text-foreground hover:text-primary transition-colors cursor-pointer max-w-[340px] truncate"
              title="Click to edit active caption line"
            >
              <PencilLine className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-medium">“{activeCue.text}”</span>
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="max-h-28 overflow-y-auto overflow-x-hidden rounded-lg border border-border/80 bg-zinc-950/90"
      >
        <div
          ref={trackRef}
          data-testid="phrase-timeline-track"
          onClick={handleTrackClick}
          className="relative cursor-pointer select-none"
          style={{ height: laneCount * 28 + 2 }}
        >
          {trimEnd > trimStart && timelineSpan > 0 && (
            <div
              aria-hidden="true"
              style={{
                left: `${Math.max(0, Math.min(100, (trimStart / timelineSpan) * 100))}%`,
                width: `${Math.max(0, Math.min(100, ((trimEnd - trimStart) / timelineSpan) * 100))}%`,
              }}
              className="pointer-events-none absolute inset-y-0 bg-white/[0.03] border-x border-white/15"
            />
          )}

          {clips.map(({ cue, left, width, lane }, i) => {
            const isActive = activeCue?.id === cue.id;
            return (
              <button
                key={`dock_${cue.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSeekTo(cue.start, false);
                }}
                title={`Line ${i + 1} (${formatSec(cue.start)}–${formatSec(cue.end)}): ${cue.text}`}
                aria-current={isActive ? 'true' : undefined}
                style={{ left: `${left}%`, width: `${width}%`, top: lane * 28 + 3 }}
                className={`absolute h-6 rounded px-1.5 text-[10px] font-semibold truncate text-left border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary z-10'
                    : 'bg-zinc-800/90 text-zinc-200 border-zinc-700/80 hover:bg-zinc-700'
                }`}
              >
                {cue.text || `Line ${i + 1}`}
              </button>
            );
          })}

          <div
            aria-hidden="true"
            style={{ left: `${Math.max(0, Math.min(100, (currentTime / timelineSpan) * 100))}%` }}
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white z-20"
          />
        </div>
      </div>
      {videoLoaded && (
        <PlaybackScrubber {...{ trimStart, trimEnd, duration, currentTime, onSeekTo }} />
      )}
    </section>
  );
}
