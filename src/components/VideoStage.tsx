import React, { useRef, useState } from 'react';
import { Camera, Eye, Film, Mic2, PencilLine, Sparkles, Upload, Volume2 } from 'lucide-react';
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
  clampWordSpacing,
  classifyDroppedFile,
  findActiveCaption,
  findPreviousCaption,
  formatSec,
  getActiveWordIndex,
  getCaptionContainerSpec,
  getWordVisualSpec,
  isNegativeEmphasisWord,
  isWordSpotlightKey,
  resolveEffectiveEffect,
  resolveEffectiveReveal,
  type AspectRatio,
  type CaptionCue,
  type StyleConfig,
} from '../utils/captions';
import type { NoiseCleanStrength } from '../utils/audioEngine';

interface VideoStageProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoPickerRef: React.RefObject<HTMLInputElement | null>;
  videoUrl: string | null;
  fileInfo: string;
  duration: number;
  currentTime: number;
  timeline: React.ReactNode;
  trimStart: number;
  trimEnd: number;
  aspect: AspectRatio;
  captions: CaptionCue[];
  styleConfig: StyleConfig;
  previewLabel?: string | null;
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
  onAspectChange: (aspect: AspectRatio) => void;
  onTrimChange: (which: 'start' | 'end', value: number) => void;
  onToggleImproveAudio: () => void;
  onNoiseStrengthChange: (strength: NoiseCleanStrength) => void;
  onSelectCueForEdit: (cue: CaptionCue) => void;
  onSaveEditCue: (cueId: string, nextText: string) => void;
  onToggleCueKeyWord: (cueId: string, rawWord: string) => void;
  onCancelEditCue: () => void;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onSeeked: () => void;
  onPause: () => void;
  onEnded: () => void;
}

export function VideoStage({
  videoRef,
  videoPickerRef,
  videoUrl,
  fileInfo,
  duration,
  currentTime,
  timeline,
  trimStart,
  trimEnd,
  aspect,
  captions,
  styleConfig,
  previewLabel = null,
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
  onAspectChange,
  onTrimChange,
  onToggleImproveAudio,
  onNoiseStrengthChange,
  onSelectCueForEdit,
  onSaveEditCue,
  onToggleCueKeyWord,
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
  const [showSafeGuides, setShowSafeGuides] = useState(false);
  const fileInputRef = videoPickerRef;
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (editingCue && editingCue.id !== lastEditingId) {
    setLastEditingId(editingCue.id);
    setDraftText(editingCue.text);
  } else if (!editingCue && lastEditingId !== null) {
    setLastEditingId(null);
  }

  const activeCue = findActiveCaption(captions, currentTime);
  const effectiveReveal = resolveEffectiveReveal(styleConfig);
  const effectiveEffect = resolveEffectiveEffect(styleConfig);
  const spotlightAuto = styleConfig.spotlightAuto ?? true;
  const pageLayout = styleConfig.pageLayout ?? 'replace';
  const prevCue =
    pageLayout === 'stack' && effectiveReveal !== 'pop'
      ? findPreviousCaption(captions, activeCue)
      : null;

  const words = activeCue ? activeCue.text.trim().split(/\s+/).filter(Boolean) : [];
  const activeWordIdx = activeCue ? getActiveWordIndex(activeCue, currentTime) : -1;

  const stageAspectClass =
    aspect === 'r916'
      ? 'aspect-[9/16] max-w-[min(320px,calc(52svh*0.5625))] lg:max-w-[320px]'
      : aspect === 'r11'
        ? 'aspect-square max-w-[min(400px,52svh)] lg:max-w-[400px]'
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

  const editingWords = editingCue ? draftText.trim().split(/\s+/).filter(Boolean) : [];

  return (
    <div className="@container/stage">
      <Card className="workspace-stage-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                <h2 className="font-display text-lg font-bold">Preview</h2>
              </CardTitle>
              <CardDescription className="text-xs tabular-nums mt-0.5">
                {previewLabel ? `Auditioning: ${previewLabel}` : fileInfo}
              </CardDescription>
            </div>
            {videoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Change video</span>
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.m4v,.webm"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelected(file);
                e.target.value = '';
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="video/*"
              capture="user"
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
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            data-testid="video-stage"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`workspace-media relative mx-auto w-full rounded-xl overflow-hidden bg-zinc-950 border transition-colors ${
              dragActive
                ? 'border-primary ring-2 ring-primary/50'
                : 'border-border'
            } ${videoUrl ? stageAspectClass : 'workspace-media-empty'}`}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                preload="auto"
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onSeeked={onSeeked}
                onPause={onPause}
                onEnded={onEnded}
                className="w-full h-full object-cover block"
              />
            ) : (
              <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-5 text-zinc-300">
                <div className="w-11 h-11 rounded-xl border border-zinc-800 bg-zinc-900/90 flex items-center justify-center mb-3">
                  <Film className="w-5 h-5 text-zinc-200" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-white">Add your video</p>
                <p className="text-xs text-zinc-300 mt-1 max-w-[16rem] leading-relaxed">
                  <span className="pointer-fine:hidden">
                    Pick a clip from your phone or record a new one. Captions are added next.
                  </span>
                  <span className="hidden pointer-fine:inline">
                    Drag a video or .srt file onto this frame, or pick a clip from your computer.
                  </span>
                </p>
                <div className="mt-4 flex w-full max-w-[15rem] flex-col gap-2">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer font-semibold"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Choose video</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => cameraInputRef.current?.click()}
                    className="cursor-pointer border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800 pointer-fine:hidden"
                  >
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Record with camera</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    disabled={loadingSample}
                    onClick={onLoadSampleClip}
                    className="cursor-pointer text-zinc-200 hover:bg-zinc-800 hover:text-white"
                  >
                    {loadingSample ? 'Creating sample…' : 'Try a sample clip'}
                  </Button>
                </div>
              </div>
            )}

            {showSafeGuides && (
              <div
                aria-hidden="true"
                data-testid="safe-area-guides"
                className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2"
              >
                <div className="h-[11%] border border-dashed border-white/40 rounded-md flex items-center justify-center">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/75 bg-black/50 px-1.5 py-0.5 rounded">
                    Top status safe margin
                  </span>
                </div>
                <div className="flex-1 flex justify-end items-center pr-1">
                  <div className="w-8 h-28 border border-dashed border-white/35 rounded-md flex items-center justify-center">
                    <span className="font-mono text-[8px] -rotate-90 text-white/65 whitespace-nowrap">
                      Reels / Shorts UI
                    </span>
                  </div>
                </div>
                <div className="h-[22%] border border-dashed border-white/40 rounded-md flex items-end justify-center pb-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/75 bg-black/50 px-1.5 py-0.5 rounded">
                    Lower UI &amp; caption zone
                  </span>
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

            {videoUrl && activeCue && words.length > 0 && (() => {
              const containerSpec = getCaptionContainerSpec(styleConfig.style);
              const cueElapsed = Math.max(0, currentTime - activeCue.start);
              const cueDuration = Math.max(0.2, activeCue.end - activeCue.start);
              const useDifference = styleConfig.blendMode === 'difference';
              const wordSpacingEm = clampWordSpacing(styleConfig.wordSpacing);

              const wordNodes = words
                .map((word, idx) => {
                  const isOn = idx === activeWordIdx;
                  const isKey = isWordSpotlightKey(word, activeCue, spotlightAuto);
                  const spec = getWordVisualSpec({
                    style: styleConfig.style,
                    fontFamily: styleConfig.fontFamily,
                    word,
                    wordIndex: idx,
                    activeWordIndex: activeWordIdx,
                    accentColor: styleConfig.accentColor,
                    revealMode: effectiveReveal,
                    effect: effectiveEffect,
                    cueElapsedSec: cueElapsed,
                    cueDurationSec: cueDuration,
                    isSpotlightKey: isKey,
                    isNegative: isNegativeEmphasisWord(word),
                    currentTimeSec: currentTime,
                  });
                  if (spec.isHidden) return null;

                  const transforms: string[] = [];
                  if (spec.scale !== 1) transforms.push(`scale(${spec.scale})`);
                  if (spec.translateYEm !== 0) transforms.push(`translateY(${spec.translateYEm}em)`);
                  if (spec.rotateDeg !== 0) transforms.push(`rotate(${spec.rotateDeg}deg)`);

                  let customShadow = spec.shadowMode === 'none' ? 'none' : undefined;
                  if (spec.glitchColorShift && spec.glitchDxPx) {
                    const dx = spec.glitchDxPx;
                    customShadow = `${-dx}px 0 rgba(255,45,85,0.8), ${dx}px 0 rgba(34,211,238,0.8)`;
                  }

                  const inlineStyle: React.CSSProperties = {
                    fontFamily: spec.fontCss,
                    fontWeight: spec.fontWeight,
                    fontStyle: spec.fontStyle,
                    color: spec.color,
                    opacity: spec.opacity,
                    backgroundColor: spec.backgroundColor ?? undefined,
                    marginInline:
                      spec.scale > 1.02 ? `${((spec.scale - 1) * 0.58).toFixed(2)}em` : undefined,
                    transform: transforms.length ? transforms.join(' ') : undefined,
                    textShadow: customShadow,
                  };

                  return (
                    <button
                      key={`${activeCue.id}_${idx}`}
                      type="button"
                      onClick={() => onSelectCueForEdit(activeCue)}
                      title="Tap to edit text or toggle Spotlight key word"
                      style={inlineStyle}
                      className={`w border-0 ${isOn ? 'on' : ''}`}
                    >
                      {spec.displayText}
                    </button>
                  );
                })
                .filter(Boolean);

              return (
                <div
                  data-testid="caption-overlay"
                  className={`cap-overlay ${styleConfig.position} ${styleConfig.style}`}
                  style={{
                    fontSize: `${styleConfig.fontSize}px`,
                    mixBlendMode: useDifference ? 'difference' : undefined,
                  }}
                >
                  {prevCue && (
                    <div
                      className="mb-1 text-[0.76em] font-semibold text-white/60 tracking-tight truncate px-3"
                      style={{ textShadow: '0 2px 5px rgba(0,0,0,0.85)' }}
                    >
                      {prevCue.text.trim()}
                    </div>
                  )}
                  {containerSpec.hasFullLineBackdrop ? (
                    <span
                      className="cap-line-backdrop inline-flex flex-wrap justify-center items-baseline gap-y-[0.14em] max-w-full"
                      style={{
                        columnGap: `${wordSpacingEm}em`,
                        backgroundColor: containerSpec.backdropColor ?? undefined,
                      }}
                    >
                      {wordNodes}
                    </span>
                  ) : (
                    <div
                      className="inline-flex flex-wrap justify-center items-baseline gap-y-[0.14em] max-w-full"
                      style={{ columnGap: `${wordSpacingEm}em` }}
                    >
                      {wordNodes}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {(videoUrl || captions.length > 0) && timeline}

          <details className="workspace-video-settings">
            <summary>Video settings</summary>
            <div className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={showSafeGuides ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={showSafeGuides}
                    onClick={() => setShowSafeGuides((v) => !v)}
                    className="cursor-pointer whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Safe guides</span>
                  </Button>
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

              <Separator />

              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">Frame shape</Label>
                  <Tabs
                    value={aspect}
                    onValueChange={(val) => onAspectChange(val as AspectRatio)}
                  >
                    <TabsList className="h-8">
                      <TabsTrigger value="r916" className="text-xs px-2.5 cursor-pointer">
                        9:16
                      </TabsTrigger>
                      <TabsTrigger value="r11" className="text-xs px-2.5 cursor-pointer">
                        1:1
                      </TabsTrigger>
                      <TabsTrigger value="r169" className="text-xs px-2.5 cursor-pointer">
                        16:9
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {duration > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
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
                        value={[trimStart]}
                        onValueChange={(val) => {
                          const next = Array.isArray(val) ? val[0] : val;
                          if (typeof next === 'number') onTrimChange('start', next);
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
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
                        value={[trimEnd]}
                        onValueChange={(val) => {
                          const next = Array.isArray(val) ? val[0] : val;
                          if (typeof next === 'number') onTrimChange('end', next);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                      <span>Remove background noise</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Cuts fan hum, room echo, and hiss during playback &amp; export.
                    </p>
                  </div>
                  <Switch
                    id="improve-audio-switch"
                    aria-label="Remove background noise"
                    checked={improveAudio}
                    onCheckedChange={() => onToggleImproveAudio()}
                  />
                </div>

                {improveAudio && (
                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Filter level
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
                          Natural
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
                    <Progress value={audioMeterPct} className="h-1.5" aria-label="Audio output level" />
                  </div>
                )}

                {audioStatus && !audioStatus.startsWith('Off') && (
                  <p role="status" aria-live="polite" className="text-[11px] text-muted-foreground">
                    {audioStatus}
                  </p>
                )}

                {voiceoverActive && (
                  <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 flex items-center gap-2 text-xs text-foreground">
                    <Mic2 className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                    <span>
                      AI Voiceover active ({replaceOriginalAudio ? 'original noisy audio muted' : 'blended over video audio'}).
                    </span>
                  </div>
                )}
              </div>
            </div>
          </details>
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
            <DialogTitle className="font-display">Fix caption line &amp; key words</DialogTitle>
            <DialogDescription className="font-mono text-xs tabular-nums">
              {editingCue ? `${formatSec(editingCue.start)} – ${formatSec(editingCue.end)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
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

            {editingCue && editingWords.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Tap words to Spotlight highlight</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {editingWords.map((w, wi) => {
                    const marked = isWordSpotlightKey(w, { ...editingCue, text: draftText }, spotlightAuto);
                    return (
                      <button
                        key={`${editingCue.id}_modal_${wi}`}
                        type="button"
                        aria-pressed={marked}
                        onClick={() => onToggleCueKeyWord(editingCue.id, w)}
                        className={`px-2 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                          marked
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
