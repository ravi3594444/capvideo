import React, { useRef, useState } from 'react';
import { Film, Mic2, Pause, PencilLine, Play, Repeat, Upload, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  classifyDroppedFile,
  findActiveCaption,
  formatSec,
  getActiveWordIndex,
  getCaptionContainerSpec,
  getWordVisualSpec,
  type AspectRatio,
  type CaptionCue,
  type StyleConfig,
} from '../utils/captions';
import type { NoiseCleanStrength } from '../utils/audioEngine';

interface VideoStageProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string | null;
  fileInfo: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  loopClip: boolean;
  trimStart: number;
  trimEnd: number;
  aspect: AspectRatio;
  captions: CaptionCue[];
  styleConfig: StyleConfig;
  improveAudio: boolean;
  noiseStrength: NoiseCleanStrength;
  audioMeterPct: number;
  audioStatus: string;
  voiceoverActive: boolean;
  replaceOriginalAudio: boolean;
  editingCue: CaptionCue | null;
  loadingSample: boolean;
  onFileSelected: (file: File) => void;
  onSrtFileDropped: (file: File) => void;
  onDropError: (message: string) => void;
  onLoadSampleClip: () => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onAspectChange: (aspect: AspectRatio) => void;
  onTrimChange: (which: 'start' | 'end', value: number) => void;
  onSeekTo: (time: number) => void;
  onToggleImproveAudio: () => void;
  onNoiseStrengthChange: (strength: NoiseCleanStrength) => void;
  onSelectCueForEdit: (cue: CaptionCue) => void;
  onSaveEditCue: (cueId: string, nextText: string) => void;
  onCancelEditCue: () => void;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onSeeked: () => void;
  onPause: () => void;
  onEnded: () => void;
}

export function VideoStage({
  videoRef,
  videoUrl,
  fileInfo,
  duration,
  currentTime,
  isPlaying,
  loopClip,
  trimStart,
  trimEnd,
  aspect,
  captions,
  styleConfig,
  improveAudio,
  noiseStrength,
  audioMeterPct,
  audioStatus,
  voiceoverActive,
  replaceOriginalAudio,
  editingCue,
  loadingSample,
  onFileSelected,
  onSrtFileDropped,
  onDropError,
  onLoadSampleClip,
  onTogglePlay,
  onToggleLoop,
  onAspectChange,
  onTrimChange,
  onSeekTo,
  onToggleImproveAudio,
  onNoiseStrengthChange,
  onSelectCueForEdit,
  onSaveEditCue,
  onCancelEditCue,
  onLoadedMetadata,
  onTimeUpdate,
  onSeeked,
  onPause,
  onEnded,
}: VideoStageProps) {
  const [draftText, setDraftText] = useState('');
  const [lastEditingId, setLastEditingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (editingCue && editingCue.id !== lastEditingId) {
    setLastEditingId(editingCue.id);
    setDraftText(editingCue.text);
  } else if (!editingCue && lastEditingId !== null) {
    setLastEditingId(null);
  }

  const activeCue = findActiveCaption(captions, currentTime);
  const words = activeCue ? activeCue.text.trim().split(/\s+/).filter(Boolean) : [];
  const activeWordIdx = activeCue ? getActiveWordIndex(activeCue, currentTime) : -1;

  const stageAspectClass =
    aspect === 'r916'
      ? 'aspect-[9/16] max-w-[320px]'
      : aspect === 'r11'
        ? 'aspect-square max-w-[400px]'
        : 'aspect-video max-w-full';

  const handleOpenActiveFix = () => {
    const target = activeCue || captions.slice().sort((a, b) => a.start - b.start)[0];
    if (target) onSelectCueForEdit(target);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const kind = classifyDroppedFile(file);
    if (kind === 'video') {
      onFileSelected(file);
    } else if (kind === 'srt') {
      onSrtFileDropped(file);
    } else {
      onDropError(`Unsupported file “${file.name}”. Drop an MP4, WebM, MOV, or .srt subtitle file.`);
    }
  };

  return (
    <div className="space-y-4 @container/stage">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                <h2 className="font-display text-lg font-bold">01. Video Stage</h2>
              </CardTitle>
              <CardDescription className="text-xs tabular-nums mt-0.5">{fileInfo}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingSample}
                onClick={onLoadSampleClip}
                className="cursor-pointer whitespace-nowrap"
              >
                {loadingSample ? 'Creating…' : 'Load sample clip'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer whitespace-nowrap font-semibold"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Pick video</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/*"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelected(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            data-testid="video-stage"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative mx-auto w-full rounded-xl overflow-hidden bg-zinc-950 border transition-colors ${
              dragActive
                ? 'border-primary ring-2 ring-primary/50'
                : 'border-border'
            } ${stageAspectClass}`}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                preload="metadata"
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onSeeked={onSeeked}
                onPause={onPause}
                onEnded={onEnded}
                className="w-full h-full object-cover block"
              />
            ) : (
              <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 text-zinc-300">
                <div className="w-11 h-11 rounded-xl border border-zinc-800 bg-zinc-900/90 flex items-center justify-center mb-3">
                  <Film className="w-5 h-5 text-zinc-200" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-white">Drop video or .srt here</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                  Drag an MP4 or WebM clip onto this stage, pick a file from your device, or launch the instant sample clip.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer font-semibold"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Choose video</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingSample}
                    onClick={onLoadSampleClip}
                    className="cursor-pointer border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800"
                  >
                    {loadingSample ? 'Creating…' : 'Try sample clip'}
                  </Button>
                </div>
              </div>
            )}

            {dragActive && (
              <div className="pointer-events-none absolute inset-0 z-20 bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-4 text-center">
                <div className="rounded-xl border border-dashed border-white/60 px-5 py-4 bg-zinc-900/90">
                  <p className="text-sm font-bold text-white">Drop to load</p>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Accepts MP4 / WebM video or .srt captions
                  </p>
                </div>
              </div>
            )}

            {activeCue && words.length > 0 && (() => {
              const containerSpec = getCaptionContainerSpec(styleConfig.style);
              const wordNodes = words.map((word, idx) => {
                const isOn = idx === activeWordIdx;
                const spec = getWordVisualSpec({
                  style: styleConfig.style,
                  fontFamily: styleConfig.fontFamily,
                  word,
                  wordIndex: idx,
                  activeWordIndex: activeWordIdx,
                  accentColor: styleConfig.accentColor,
                });
                const transforms: string[] = [];
                if (spec.scale !== 1) transforms.push(`scale(${spec.scale})`);
                if (spec.translateYEm !== 0) transforms.push(`translateY(${spec.translateYEm}em)`);
                if (spec.rotateDeg !== 0) transforms.push(`rotate(${spec.rotateDeg}deg)`);

                const inlineStyle: React.CSSProperties = {
                  fontFamily: spec.fontCss,
                  fontWeight: spec.fontWeight,
                  fontStyle: spec.fontStyle,
                  color: spec.color,
                  opacity: spec.opacity,
                  backgroundColor: spec.backgroundColor ?? undefined,
                  transform: transforms.length ? transforms.join(' ') : undefined,
                  textShadow: spec.shadowMode === 'none' ? 'none' : undefined,
                };

                return (
                  <button
                    key={`${activeCue.id}_${idx}`}
                    type="button"
                    onClick={() => onSelectCueForEdit(activeCue)}
                    title="Tap to fix this caption"
                    style={inlineStyle}
                    className={`w border-0 ${isOn ? 'on' : ''}`}
                  >
                    {spec.displayText}
                  </button>
                );
              });

              return (
                <div
                  data-testid="caption-overlay"
                  className={`cap-overlay ${styleConfig.position} ${styleConfig.style}`}
                  style={{ fontSize: `${styleConfig.fontSize}px` }}
                >
                  {containerSpec.hasFullLineBackdrop ? (
                    <span
                      className="cap-line-backdrop"
                      style={{ backgroundColor: containerSpec.backdropColor ?? undefined }}
                    >
                      {wordNodes}
                    </span>
                  ) : (
                    wordNodes
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="default"
                disabled={!videoUrl}
                onClick={onTogglePlay}
                className="cursor-pointer whitespace-nowrap font-semibold"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" aria-hidden="true" />
                    <span>Play clip</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant={loopClip ? 'default' : 'outline'}
                size="sm"
                aria-pressed={loopClip}
                aria-label="Loop trim selection"
                onClick={onToggleLoop}
                className="cursor-pointer whitespace-nowrap"
              >
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Loop</span>
              </Button>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {formatSec(Math.max(0, currentTime - trimStart))} /{' '}
                {formatSec(Math.max(0, trimEnd - trimStart))}
              </span>
            </div>

            {captions.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenActiveFix}
                className="cursor-pointer whitespace-nowrap"
              >
                <PencilLine className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tap-to-fix</span>
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Slider
              aria-label="Playback position"
              min={trimStart}
              max={Math.max(trimStart + 0.2, trimEnd || duration || 1)}
              step={0.05}
              disabled={!videoUrl}
              value={[Math.min(Math.max(currentTime, trimStart), Math.max(trimStart + 0.2, trimEnd || duration || 1))]}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? val[0] : val;
                if (typeof next === 'number') onSeekTo(next);
              }}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>Scrub timeline</span>
              <span>Space: Play · ←/→: ±1s · Ctrl+Z: Undo</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Frame shape (centre-cropped, never stretched)
              </Label>
              <Tabs
                value={aspect}
                onValueChange={(val) => onAspectChange(val as AspectRatio)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="r916" className="text-xs cursor-pointer">
                    9:16 Vertical
                  </TabsTrigger>
                  <TabsTrigger value="r11" className="text-xs cursor-pointer">
                    1:1 Square
                  </TabsTrigger>
                  <TabsTrigger value="r169" className="text-xs cursor-pointer">
                    16:9 Wide
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid grid-cols-1 @sm/stage:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <Label htmlFor="trim-start-slider">Trim start</Label>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {formatSec(trimStart)}
                  </span>
                </div>
                <Slider
                  id="trim-start-slider"
                  aria-label="Trim start"
                  min={0}
                  max={Math.max(0.2, duration)}
                  step={0.1}
                  disabled={!duration}
                  value={[trimStart]}
                  onValueChange={(val) => {
                    const next = Array.isArray(val) ? val[0] : val;
                    if (typeof next === 'number') onTrimChange('start', next);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <Label htmlFor="trim-end-slider">Trim end</Label>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {formatSec(trimEnd)}
                  </span>
                </div>
                <Slider
                  id="trim-end-slider"
                  aria-label="Trim end"
                  min={0}
                  max={Math.max(0.2, duration)}
                  step={0.1}
                  disabled={!duration}
                  value={[trimEnd]}
                  onValueChange={(val) => {
                    const next = Array.isArray(val) ? val[0] : val;
                    if (typeof next === 'number') onTrimChange('end', next);
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>
                <h3 className="font-heading text-sm font-bold flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Sound: Remove background noise</span>
                </h3>
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Multi-stage voice isolator cuts fan hum, room echo, and static hiss while boosting speech clarity for preview and export.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              <Switch
                id="improve-audio-switch"
                aria-label="Remove background noise"
                checked={improveAudio}
                onCheckedChange={() => onToggleImproveAudio()}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {improveAudio && (
            <div className="flex items-center justify-between gap-2 pb-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Noise filter level
              </span>
              <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-0.5 border border-border">
                <button
                  type="button"
                  aria-pressed={noiseStrength === 'clean'}
                  onClick={() => onNoiseStrengthChange('clean')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    noiseStrength === 'clean'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Natural clean
                </button>
                <button
                  type="button"
                  aria-pressed={noiseStrength === 'strong'}
                  onClick={() => onNoiseStrengthChange('strong')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    noiseStrength === 'strong'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Strong isolate
                </button>
              </div>
            </div>
          )}
          <Progress value={audioMeterPct} className="h-2" aria-label="Audio output level" />
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {audioStatus}
          </p>
          {voiceoverActive && (
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 flex items-center gap-2 text-xs text-foreground">
              <Mic2 className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>
                AI Voiceover active ({replaceOriginalAudio ? 'original noisy audio muted' : 'blended over video audio'}).
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingCue)}
        onOpenChange={(open) => {
          if (!open) onCancelEditCue();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Fix caption line</DialogTitle>
            <DialogDescription className="font-mono text-xs tabular-nums">
              {editingCue ? `${formatSec(editingCue.start)} – ${formatSec(editingCue.end)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="tap-fix-textarea">Caption words (press Enter to save)</Label>
            <Textarea
              id="tap-fix-textarea"
              rows={3}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && editingCue && draftText.trim()) {
                  e.preventDefault();
                  onSaveEditCue(editingCue.id, draftText.trim());
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancelEditCue}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (editingCue && draftText.trim()) {
                  onSaveEditCue(editingCue.id, draftText.trim());
                }
              }}
            >
              Save fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
