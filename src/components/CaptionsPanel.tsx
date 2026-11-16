import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  FileText,
  Merge,
  Mic,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Wand2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  buildSrt,
  captionsFromSegments,
  captionsFromText,
  captionsFromWords,
  createCueId,
  createNextCue,
  createSampleCaptions,
  formatSec,
  mergeCaptionWithNext,
  parseSrt,
  shiftCaptions,
  snapCueStartToTime,
  splitCaption,
  type CaptionCue,
} from '../utils/captions';
import { extractTrimmedWav } from '../utils/audioEngine';

export interface ServerCapabilities {
  deepgram: boolean;
  inception: boolean;
}

interface CaptionsPanelProps {
  videoFile: File | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  language: string;
  captions: CaptionCue[];
  capabilities: ServerCapabilities | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onLanguageChange: (lang: string) => void;
  onCaptionsChange: (next: CaptionCue[]) => void;
  onSeekTo: (time: number, autoPlay?: boolean) => void;
  onOpenDeployGuide: () => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'hi-IN-hinglish', label: 'Hinglish (Hindi + English)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'pt-BR', label: 'Portuguese' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'ar-SA', label: 'Arabic' },
];

export function CaptionsPanel({
  videoFile,
  videoRef,
  duration,
  currentTime,
  trimStart,
  trimEnd,
  language,
  captions,
  capabilities,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onLanguageChange,
  onCaptionsChange,
  onSeekTo,
  onOpenDeployGuide,
}: CaptionsPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [liveInterim, setLiveInterim] = useState('');
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptDraft, setScriptDraft] = useState('');
  const [copiedSrt, setCopiedSrt] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const srtInputRef = useRef<HTMLInputElement | null>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);
  const watcherRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    const el = document.getElementById(`cap-text-${pendingFocusId}`) as HTMLTextAreaElement | null;
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setPendingFocusId(null);
    }
  }, [captions, pendingFocusId]);

  interface SpeechRecInstance {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((ev: unknown) => void) | null;
    onerror: ((ev: unknown) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  }

  const SpeechRec =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: new () => SpeechRecInstance }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecInstance })
          .webkitSpeechRecognition
      : undefined;

  const shortLang = language === 'hi-IN-hinglish' ? 'hi' : language.split('-')[0];
  const hasVideo = Boolean(videoFile || videoRef.current?.src);

  const handleAutoGenerate = async () => {
    if (!videoFile) {
      setStatusMsg('Step 1: Drop or pick a video clip on the left first, or paste a script on the right.');
      return;
    }

    setGenerating(true);
    setMissingEnv(null);
    setStatusMsg('Preparing audio track from your video file…');

    try {
      let uploadBlob: Blob = videoFile;
      let uploadName = videoFile.name || 'clip.mp4';
      let offset = 0;

      if (videoFile.size > 24 * 1048576) {
        setStatusMsg('Compressing trimmed audio to 16 kHz mono WAV in browser…');
        const wav = await extractTrimmedWav(videoFile, trimStart, trimEnd || duration || 60);
        uploadBlob = wav.blob;
        uploadName = wav.name;
        offset = wav.offset;
      }

      setStatusMsg('Transcribing speech with Deepgram Nova-2…');
      const fd = new FormData();
      fd.append('file', uploadBlob, uploadName);
      fd.append('language', shortLang);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.missingEnvVar) setMissingEnv(String(data.missingEnvVar));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      let made: CaptionCue[] = [];
      const effectiveEnd = trimEnd > trimStart ? trimEnd : duration || Number.POSITIVE_INFINITY;

      if (Array.isArray(data.words) && data.words.length > 0) {
        made = captionsFromWords(data.words, offset, trimStart, effectiveEnd);
      }
      if (!made.length && Array.isArray(data.utterances) && data.utterances.length > 0) {
        made = captionsFromSegments(
          data.utterances.map((u: { transcript?: string; start: number; end: number }) => ({
            text: u.transcript || '',
            start: u.start,
            end: u.end,
          })),
          offset,
          trimStart,
          effectiveEnd
        );
      }
      if (!made.length && typeof data.transcript === 'string' && data.transcript.trim()) {
        made = captionsFromText(data.transcript, trimStart, duration || trimStart + 10);
      }

      if (!made.length) {
        setStatusMsg(
          'No spoken words were detected in this clip. Try pasting your script or adding lines manually below.'
        );
      } else {
        onCaptionsChange(made);
        setStatusMsg(
          `Done! Added ${made.length} timed captions via Deepgram Nova-2. Edit any line below or click words on the video.`
        );
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Deepgram transcription failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleQuickAiPolish = async () => {
    const valid = captions.some((c) => c.text.trim().length > 0);
    if (!valid) {
      setStatusMsg('Write or generate at least one caption before polishing with AI.');
      return;
    }

    setPolishing(true);
    setMissingEnv(null);
    setStatusMsg('Fixing punctuation and typos with Inception Mercury 3…');
    try {
      const res = await fetch('/api/captions/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: captions.map((c) => c.text),
          action: 'cleanup',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.missingEnvVar) setMissingEnv(String(data.missingEnvVar));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const nextTexts: string[] = data.texts;
      onCaptionsChange(
        captions.map((c, idx) => ({
          ...c,
          text:
            typeof nextTexts[idx] === 'string' && nextTexts[idx].trim()
              ? nextTexts[idx].trim()
              : c.text,
        }))
      );
      setStatusMsg('Polished spelling and punctuation across all lines via Mercury 3. Click Undo to revert.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Mercury 3 polish failed.');
    } finally {
      setPolishing(false);
    }
  };

  const stopBrowserListening = (msg?: string) => {
    setListening(false);
    setLiveInterim('');
    if (watcherRef.current) {
      window.clearInterval(watcherRef.current);
      watcherRef.current = null;
    }
    if (recogRef.current) {
      try {
        recogRef.current.stop();
      } catch {
        // ignore
      }
      recogRef.current = null;
    }
    videoRef.current?.pause();
    if (msg) setStatusMsg(msg);
  };

  const startBrowserListening = () => {
    const vid = videoRef.current;
    if (!SpeechRec || !vid || !vid.src) {
      setStatusMsg('Load a video first before starting browser mic listening.');
      return;
    }

    const recog = new SpeechRec();
    recog.lang = language === 'hi-IN-hinglish' ? 'hi-IN' : language;
    recog.continuous = true;
    recog.interimResults = true;
    recogRef.current = recog;

    const collected: CaptionCue[] = [];
    onCaptionsChange([]);
    vid.currentTime = trimStart;

    recog.onresult = (rawEv: unknown) => {
      const ev = rawEv as {
        resultIndex: number;
        results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
      };
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const txt = res[0].transcript.trim();
        if (!txt) continue;
        if (res.isFinal) {
          const now = vid.currentTime;
          const prevEnd = collected.length ? collected[collected.length - 1].end : trimStart;
          const st = Math.max(
            prevEnd,
            now - Math.min(4, Math.max(1.2, txt.split(/\s+/).length * 0.38))
          );
          collected.push({
            id: createCueId(collected.length),
            start: Math.round(st * 100) / 100,
            end: Math.round((now + 0.4) * 100) / 100,
            text: txt,
          });
          onCaptionsChange([...collected]);
          setStatusMsg(`Listening… ${collected.length} phrases captured.`);
        } else {
          interim = txt;
        }
      }
      setLiveInterim(interim);
    };

    recog.onerror = (rawErr: unknown) => {
      const err = rawErr as { error?: string };
      if (err.error === 'not-allowed') {
        stopBrowserListening('Microphone blocked. Allow mic access or type captions manually below.');
      }
    };

    recog.onend = () => {
      if (vid.currentTime < trimEnd - 0.3 && !vid.paused) {
        try {
          recog.start();
        } catch {
          // ignore
        }
      }
    };

    setListening(true);
    setStatusMsg('Browser listening active — keep your speaker audible while the clip plays.');
    try {
      recog.start();
    } catch {
      // ignore
    }
    void vid.play();

    watcherRef.current = window.setInterval(() => {
      if (vid.currentTime >= trimEnd - 0.15 || vid.ended) {
        stopBrowserListening(`Done. ${collected.length} phrases captured via browser listening.`);
      }
    }, 300);
  };

  const handleAddRow = () => {
    const nextCue = createNextCue(captions, currentTime, trimStart, duration, hasVideo);
    onCaptionsChange([...captions, nextCue]);
    setPendingFocusId(nextCue.id);
    setStatusMsg(
      `Added Line ${captions.length + 1} (${formatSec(nextCue.start)} – ${formatSec(nextCue.end)}). Start typing below.`
    );
  };

  const handleImportSrt = async (file: File) => {
    const text = await file.text();
    const parsed = parseSrt(text, trimStart);
    if (!parsed.length) {
      setStatusMsg('Could not find valid subtitle cues inside that .srt file.');
      return;
    }
    onCaptionsChange(parsed);
    setStatusMsg(`Imported ${parsed.length} captions from ${file.name}.`);
  };

  const handleCopySrt = async () => {
    const srt = buildSrt(captions, trimStart);
    if (!srt.trim()) {
      setStatusMsg('Add at least one caption with text before copying .srt.');
      return;
    }
    try {
      await navigator.clipboard.writeText(srt);
      setCopiedSrt(true);
      setStatusMsg('Copied .srt subtitle cues to clipboard.');
      window.setTimeout(() => setCopiedSrt(false), 1800);
    } catch {
      setStatusMsg('Clipboard permission unavailable in this browser.');
    }
  };

  const sortedCaptions = captions.slice().sort((a, b) => a.start - b.start);

  return (
    <div className="space-y-5 @container/captions">
      <div className="grid grid-cols-1 @lg/captions:grid-cols-2 gap-4">
        <div className="rounded-xl glass-subpanel p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-bold text-foreground whitespace-nowrap">
              1. Auto-caption your video
            </h2>
            <span className="font-mono text-[11px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
              {capabilities === null
                ? 'Checking server…'
                : capabilities.deepgram
                  ? 'Deepgram ready'
                  : 'Needs API key'}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Automatically transcribe speech into timed 5-word lines using Deepgram Nova-2. Your API key stays securely on the server.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="caption-lang-trigger" className="text-xs">
              Spoken language
            </Label>
            <Select
              value={language}
              onValueChange={(val) => {
                if (val) onLanguageChange(val);
              }}
            >
              <SelectTrigger id="caption-lang-trigger" className="w-full h-9 bg-background">
                <SelectValue>
                  {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label ?? 'English'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={generating}
            onClick={handleAutoGenerate}
            className="w-full font-semibold cursor-pointer"
          >
            <Wand2 className="w-4 h-4" aria-hidden="true" />
            <span>
              {generating
                ? 'Transcribing speech…'
                : videoFile
                  ? 'Auto-caption video'
                  : 'Generate with Deepgram'}
            </span>
          </Button>

          {SpeechRec && (
            <div className="pt-2 border-t border-border">
              {!listening ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startBrowserListening}
                  className="w-full cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Use browser mic instead</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => stopBrowserListening('Browser listening stopped.')}
                  className="w-full cursor-pointer"
                >
                  Stop browser listening
                </Button>
              )}
              {liveInterim && (
                <p className="mt-2 text-xs text-foreground bg-background rounded-md px-2.5 py-1.5 border border-border">
                  Hearing: “{liveInterim}”
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl glass-subpanel p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <h2 className="font-heading text-sm font-bold text-foreground">
              2. Or paste, type, or import
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Already have a script? Paste it to auto-time across your clip in one click, add individual lines, or drop in an <code className="font-mono">.srt</code> file.
            </p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setScriptOpen(true)}
              className="w-full font-semibold cursor-pointer"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Paste script → Auto-time</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleAddRow}
              className="w-full font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add caption line</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => srtInputRef.current?.click()}
              className="w-full cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import .srt subtitles</span>
            </Button>
            <input
              ref={srtInputRef}
              type="file"
              accept=".srt,text/plain"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportSrt(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </div>

      {statusMsg && (
        <Alert role="status" aria-live="polite">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>{statusMsg}</span>
            {missingEnv && (
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={onOpenDeployGuide}
                className="p-0 h-auto font-semibold cursor-pointer"
              >
                View {missingEnv} Vercel setup
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">
              Edit caption lines
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Edit text directly, snap timing to the video playhead, or fix spelling with AI Polish.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {sortedCaptions.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={polishing}
                onClick={() => void handleQuickAiPolish()}
                aria-label="Fix spelling and punctuation with Mercury 3 AI"
                className="cursor-pointer font-semibold"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>{polishing ? 'Polishing…' : 'AI Polish'}</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo caption edit"
              title="Undo (Ctrl+Z)"
              className="cursor-pointer"
            >
              <Undo2 className="w-3 h-3" aria-hidden="true" />
              <span>Undo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!canRedo}
              onClick={onRedo}
              aria-label="Redo caption edit"
              title="Redo (Ctrl+Shift+Z)"
              className="cursor-pointer"
            >
              <Redo2 className="w-3 h-3" aria-hidden="true" />
              <span>Redo</span>
            </Button>

            {sortedCaptions.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    onCaptionsChange(shiftCaptions(captions, -0.2, duration || undefined));
                    setStatusMsg('Shifted all caption timings 0.2s earlier.');
                  }}
                  title="Move all captions 0.2s earlier"
                  className="font-mono cursor-pointer"
                >
                  -0.2s
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    onCaptionsChange(shiftCaptions(captions, 0.2, duration || undefined));
                    setStatusMsg('Shifted all caption timings 0.2s later.');
                  }}
                  title="Move all captions 0.2s later"
                  className="font-mono cursor-pointer"
                >
                  +0.2s
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => void handleCopySrt()}
                  aria-label="Copy .srt subtitles"
                  className="cursor-pointer"
                >
                  {copiedSrt ? (
                    <Check className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3 h-3" aria-hidden="true" />
                  )}
                  <span>{copiedSrt ? 'Copied' : 'Copy .srt'}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    onCaptionsChange([]);
                    setStatusMsg('Cleared timeline. Click Undo to restore captions.');
                  }}
                  aria-label="Clear all captions"
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <span>Clear</span>
                </Button>
              </>
            )}

            <span className="font-mono text-xs text-muted-foreground tabular-nums ml-1">
              {sortedCaptions.length} {sortedCaptions.length === 1 ? 'cue' : 'cues'}
            </span>
          </div>
        </div>

        {sortedCaptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 glass-subpanel p-8 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No captions yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Click Auto-caption video above, paste a script to auto-time, or add your first line right here.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add first line</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onCaptionsChange(createSampleCaptions());
                  setStatusMsg('Loaded 4 sample caption cues.');
                }}
                className="cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Restore sample cues</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-2.5">
                {sortedCaptions.map((cue, index) => {
                  const isActive = currentTime >= cue.start && currentTime < cue.end;
                  const wordCount = cue.text.trim() ? cue.text.trim().split(/\s+/).length : 0;
                  return (
                    <div
                      key={cue.id}
                      data-testid={`caption-row-${index}`}
                      className={`cue-row-opt rounded-xl border p-3.5 space-y-2.5 backdrop-blur-md transition-colors ${
                        isActive
                          ? 'border-primary bg-accent/60'
                          : 'border-border/70 glass-subpanel'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-foreground tabular-nums">
                            Line {index + 1}
                          </span>
                          {isActive && (
                            <span className="text-[11px] font-semibold text-primary">
                              · Playing now
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            · {wordCount} {wordCount === 1 ? 'word' : 'words'}
                            {wordCount > 6 ? ' (Split for Reels)' : ''}
                          </span>
                        </div>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                disabled={!hasVideo}
                                onClick={() => {
                                  const snapped = snapCueStartToTime(
                                    cue,
                                    currentTime,
                                    duration || undefined
                                  );
                                  onCaptionsChange(
                                    captions.map((c) => (c.id === cue.id ? snapped : c))
                                  );
                                  setStatusMsg(
                                    `Snapped Line ${index + 1} start to ${formatSec(snapped.start)}.`
                                  );
                                }}
                                aria-label={`Snap line ${index + 1} start to current video time`}
                                className="cursor-pointer font-mono text-[11px]"
                              />
                            }
                          >
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            <span>Start at playhead</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Move this line’s start time to match the current video position
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`cap-start-${cue.id}`}
                            className="text-[11px] text-muted-foreground"
                          >
                            Start (s)
                          </Label>
                          <Input
                            id={`cap-start-${cue.id}`}
                            type="number"
                            step={0.1}
                            min={0}
                            value={Number(cue.start.toFixed(1))}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              onCaptionsChange(
                                captions.map((c) =>
                                  c.id === cue.id
                                    ? { ...c, start: val, end: c.end <= val ? val + 0.5 : c.end }
                                    : c
                                )
                              );
                            }}
                            className="font-mono text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`cap-end-${cue.id}`}
                            className="text-[11px] text-muted-foreground"
                          >
                            End (s)
                          </Label>
                          <Input
                            id={`cap-end-${cue.id}`}
                            type="number"
                            step={0.1}
                            min={0.2}
                            value={Number(cue.end.toFixed(1))}
                            onChange={(e) => {
                              const val = Math.max(
                                cue.start + 0.2,
                                parseFloat(e.target.value) || cue.end
                              );
                              onCaptionsChange(
                                captions.map((c) => (c.id === cue.id ? { ...c, end: val } : c))
                              );
                            }}
                            className="font-mono text-xs tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`cap-text-${cue.id}`} className="sr-only">
                          Caption {index + 1} text
                        </Label>
                        <Textarea
                          id={`cap-text-${cue.id}`}
                          rows={2}
                          placeholder="Type what is spoken in this line…"
                          value={cue.text}
                          onChange={(e) => {
                            const text = e.target.value;
                            onCaptionsChange(
                              captions.map((c) => (c.id === cue.id ? { ...c, text } : c))
                            );
                          }}
                          className="text-sm"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!hasVideo}
                                onClick={() => onSeekTo(cue.start, true)}
                                className="cursor-pointer"
                              />
                            }
                          >
                            <Play className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Play line</span>
                          </TooltipTrigger>
                          <TooltipContent>Jump to this line on the video and play</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const split = splitCaption(cue);
                                  if (!split) {
                                    setStatusMsg(
                                      'Add at least two words before splitting a caption.'
                                    );
                                    return;
                                  }
                                  onCaptionsChange(
                                    captions.flatMap((c) =>
                                      c.id === cue.id ? [split[0], split[1]] : [c]
                                    )
                                  );
                                }}
                                className="cursor-pointer"
                              />
                            }
                          >
                            <Scissors className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Split</span>
                          </TooltipTrigger>
                          <TooltipContent>Split this cue evenly into two shorter lines</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={index >= sortedCaptions.length - 1}
                                onClick={() => {
                                  onCaptionsChange(mergeCaptionWithNext(sortedCaptions, cue.id));
                                }}
                                className="cursor-pointer"
                              />
                            }
                          >
                            <Merge className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Merge next</span>
                          </TooltipTrigger>
                          <TooltipContent>Combine this caption with the next line</TooltipContent>
                        </Tooltip>

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Delete caption ${index + 1}`}
                          onClick={() => onCaptionsChange(captions.filter((c) => c.id !== cue.id))}
                          className="ml-auto cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleAddRow}
              className="w-full border-dashed cursor-pointer font-semibold"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add next caption line</span>
            </Button>
          </div>
        )}
      </div>

      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">
              Paste script → Auto-time captions
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste your voiceover or dialogue below. It will be split into punchy 5-word caption cues evenly paced across your active trim window ({Math.max(2, Math.round((trimEnd > trimStart ? trimEnd - trimStart : duration || 10) * 10) / 10)}s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="paste-script-textarea" className="text-xs">
              Voiceover script
            </Label>
            <Textarea
              id="paste-script-textarea"
              rows={5}
              placeholder="Stop scrolling right now. Watch how crisp black and white captions make every word effortless to follow..."
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScriptOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const clean = scriptDraft.trim();
                if (!clean) return;
                const spanEnd =
                  trimEnd > trimStart
                    ? trimEnd
                    : duration > 0
                      ? duration
                      : Math.max(4, clean.split(/\s+/).length * 0.42);
                const generated = captionsFromText(clean, trimStart, spanEnd);
                onCaptionsChange(generated);
                setScriptDraft('');
                setScriptOpen(false);
                setStatusMsg(
                  `Created ${generated.length} timed captions across your clip. Fine-tune timing or style below.`
                );
              }}
            >
              Generate timed captions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
