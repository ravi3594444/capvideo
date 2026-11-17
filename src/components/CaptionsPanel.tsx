import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Eraser,
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
  buildPlainTranscript,
  buildSrt,
  captionsFromSegments,
  captionsFromText,
  captionsFromWords,
  createCueId,
  createNextCue,
  createSampleCaptions,
  extractAutoKeyWords,
  formatSec,
  isWordSpotlightKey,
  mergeCaptionWithNext,
  parseSrt,
  regroupCaptionsSmart,
  removeFillerWordsFromCues,
  shiftCaptions,
  snapCueStartToTime,
  splitCaption,
  toggleCueKeyWord,
  type CaptionCue,
  type WordsPerPage,
} from '../utils/captions';
import { aiHeaders } from '../lib/aiAccess';
import { useAuth } from '../contexts/AuthContext';
import {
  DIRECT_TRANSCRIPTION_BYTES,
  MAX_TRANSCRIPTION_BYTES,
  getTranscriptionContentType,
} from '../../shared/transcription';

export interface ServerCapabilities {
  deepgram: boolean;
  inception: boolean;
  largeUploads: boolean;
}

interface CaptionsPanelProps {
  videoFile: File | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  language: string;
  wordsPerPage: WordsPerPage;
  spotlightAuto: boolean;
  captions: CaptionCue[];
  capabilities: ServerCapabilities | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onLanguageChange: (lang: string) => void;
  onWordsPerPageChange: (density: WordsPerPage) => void;
  onCaptionsChange: (next: CaptionCue[]) => void;
  onSeekTo: (time: number, autoPlay?: boolean) => void;
  onOpenDeployGuide: () => void;
  onRequestVideo: () => void;
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

const DENSITY_OPTIONS: { value: WordsPerPage; label: string }[] = [
  { value: '2', label: '2 words' },
  { value: '3', label: '3 words' },
  { value: '4', label: '4 words' },
  { value: 'auto', label: 'Auto break' },
];

export function CaptionsPanel({
  videoFile,
  videoRef,
  duration,
  currentTime,
  trimStart,
  trimEnd,
  language,
  wordsPerPage,
  spotlightAuto,
  captions,
  capabilities,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onLanguageChange,
  onWordsPerPageChange,
  onCaptionsChange,
  onSeekTo,
  onOpenDeployGuide,
  onRequestVideo,
}: CaptionsPanelProps) {
  const { user, signInWithGoogle } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [pickingKeywords, setPickingKeywords] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [liveInterim, setLiveInterim] = useState('');
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptDraft, setScriptDraft] = useState('');
  const [copiedSrt, setCopiedSrt] = useState(false);
  const [copiedTxt, setCopiedTxt] = useState(false);
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
      setStatusMsg('Choose a video first, then tap Auto-caption. You can also type or paste captions without one.');
      onRequestVideo();
      return;
    }

    const contentType = getTranscriptionContentType(videoFile);
    if (!contentType || !videoFile.size || videoFile.size > MAX_TRANSCRIPTION_BYTES) {
      setStatusMsg('Choose a supported clip up to 50 MB for automatic captions.');
      return;
    }
    if (capabilities && !capabilities.deepgram) {
      setStatusMsg('Automatic captions are unavailable. You can still add or import captions manually.');
      return;
    }
    if (videoFile.size > DIRECT_TRANSCRIPTION_BYTES && capabilities && !capabilities.largeUploads) {
      setStatusMsg('Large clip uploads are unavailable. Try a clip under 4 MB or import captions.');
      return;
    }

    setGenerating(true);
    setMissingEnv(null);
    setStatusMsg(user ? 'Preparing to upload your clip…' : 'Sign in with Google to start…');

    try {
      const headers = await aiHeaders(signInWithGoogle);
      let request: RequestInit;
      setStatusMsg('Uploading your clip for Deepgram transcription…');
      if (videoFile.size > DIRECT_TRANSCRIPTION_BYTES) {
        const grant = await fetch('/api/transcription-upload', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ size: videoFile.size, contentType }),
        });
        const { url, uploadId, error } = await grant.json();
        if (!grant.ok) throw new Error(error || 'Could not prepare the upload.');
        const uploaded = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: videoFile,
        });
        if (!uploaded.ok) throw new Error('The clip upload failed. Try again.');
        request = {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, language: shortLang }),
        };
      } else {
        const form = new FormData();
        form.append('file', new Blob([videoFile], { type: contentType }), videoFile.name || 'clip.mp4');
        form.append('language', shortLang);
        request = { method: 'POST', headers, body: form };
      }

      setStatusMsg('Transcribing speech with Deepgram Nova-2…');
      const res = await fetch('/api/transcribe', request);
      const data = await res.json();
      if (!res.ok) {
        if (data?.missingEnvVar) setMissingEnv(String(data.missingEnvVar));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      let made: CaptionCue[] = [];
      const effectiveEnd = trimEnd > trimStart ? trimEnd : duration || Number.POSITIVE_INFINITY;

      if (Array.isArray(data.words) && data.words.length > 0) {
        made = captionsFromWords(data.words, 0, trimStart, effectiveEnd, wordsPerPage);
      }
      if (!made.length && Array.isArray(data.utterances) && data.utterances.length > 0) {
        made = captionsFromSegments(
          data.utterances.map((u: { transcript?: string; start: number; end: number }) => ({
            text: u.transcript || '',
            start: u.start,
            end: u.end,
          })),
          0,
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
          `Done! Added ${made.length} smart-broken captions via Deepgram Nova-2. Tap any word chip below to mark Spotlight key words.`
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
    setStatusMsg(user ? 'Fixing punctuation and typos with Inception Mercury 3…' : 'Sign in with Google to start…');
    try {
      const headers = await aiHeaders(signInWithGoogle);
      setStatusMsg('Fixing punctuation and typos with Inception Mercury 3…');
      const res = await fetch('/api/captions/refine', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
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

  const handleAutoPickSpotlightKeywords = async () => {
    const valid = captions.some((c) => c.text.trim().length > 0);
    if (!valid) {
      setStatusMsg('Add or generate captions first to pick Spotlight key words.');
      return;
    }

    setPickingKeywords(true);
    try {
      if (capabilities?.inception && user) {
        const headers = await aiHeaders();
        const res = await fetch('/api/captions/refine', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: captions.map((c) => c.text),
            action: 'keywords',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.keyWordsList)) {
            onCaptionsChange(
              captions.map((c, idx) => ({
                ...c,
                keyWords: Array.isArray(data.keyWordsList[idx]) && data.keyWordsList[idx].length > 0
                  ? data.keyWordsList[idx]
                  : extractAutoKeyWords(c.text),
              }))
            );
            setStatusMsg('Updated Spotlight key words across every caption via Mercury 3.');
            return;
          }
        }
      }
    } catch {
      // Fall back to the local keyword picker when cloud AI is unavailable.
    } finally {
      setPickingKeywords(false);
    }

    onCaptionsChange(
      captions.map((c) => ({
        ...c,
        keyWords: extractAutoKeyWords(c.text),
      }))
    );
    setStatusMsg('Highlighted Spotlight key words (numbers, entities & power nouns) across all cues.');
  };

  const handleDensityRegroup = (nextDensity: WordsPerPage) => {
    onWordsPerPageChange(nextDensity);
    if (!captions.length) {
      setStatusMsg(`Set phrase length to ${nextDensity === 'auto' ? 'Auto break' : `${nextDensity} words per screen`}.`);
      return;
    }
    const regrouped = regroupCaptionsSmart(captions, nextDensity, 0.75);
    onCaptionsChange(regrouped);
    setStatusMsg(
      `Regrouped ${regrouped.length} smart lines (${nextDensity === 'auto' ? 'Auto clause breaks' : `max ${nextDensity} words`}, keeping numbers & titles intact).`
    );
  };

  const handleRemoveFillers = () => {
    if (!captions.length) return;
    const cleaned = removeFillerWordsFromCues(captions);
    onCaptionsChange(cleaned);
    setStatusMsg('Removed filler pauses (“um”, “uh”, “like”, “you know”). Click Undo if needed.');
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

  const handleCopyTranscript = async () => {
    const txt = buildPlainTranscript(captions);
    if (!txt.trim()) {
      setStatusMsg('Add captions first before copying plain transcript.');
      return;
    }
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedTxt(true);
      setStatusMsg('Copied clean plain-text transcript to clipboard.');
      window.setTimeout(() => setCopiedTxt(false), 1800);
    } catch {
      setStatusMsg('Clipboard permission unavailable in this browser.');
    }
  };

  const sortedCaptions = captions.slice().sort((a, b) => a.start - b.start);

  return (
    <div className="space-y-4 @container/captions">
      {/* Unified Source & Capture Action Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[148px] shrink-0 space-y-1">
            <Label htmlFor="caption-lang-trigger" className="text-[11px] font-medium text-muted-foreground">
              Language
            </Label>
            <Select
              value={language}
              onValueChange={(val) => {
                if (val) onLanguageChange(val);
              }}
            >
              <SelectTrigger id="caption-lang-trigger" className="w-full h-9 bg-background text-xs">
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
            size="default"
            disabled={generating}
            onClick={handleAutoGenerate}
            className="h-9 flex-1 min-w-[185px] font-semibold cursor-pointer"
          >
            <Wand2 className="w-4 h-4" aria-hidden="true" />
            <span>
              {generating
                ? 'Transcribing speech…'
                : videoFile
                  ? 'Auto-caption video'
                  : 'Choose a video to auto-caption'}
            </span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Auto-caption sends your clip to Deepgram. Editing and export happen on your device.
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setScriptOpen(true)}
            className="cursor-pointer font-medium"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Paste script / .srt</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => srtInputRef.current?.click()}
            className="cursor-pointer font-medium"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Import .srt</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleAddRow}
            className="cursor-pointer font-medium"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add line</span>
          </Button>

          {SpeechRec && (
            !listening ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={startBrowserListening}
                className="cursor-pointer font-medium"
              >
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mic</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() => stopBrowserListening('Browser listening stopped.')}
                className="cursor-pointer font-medium"
              >
                Stop mic
              </Button>
            )
          )}


        </div>

        <input
          ref={srtInputRef}
          type="file"
          accept=".srt,application/x-subrip,text/plain"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportSrt(file);
            e.target.value = '';
          }}
        />

        {liveInterim && (
          <p className="text-xs text-foreground bg-muted/60 rounded-md px-2.5 py-1.5 border border-border">
            Hearing: “{liveInterim}”
          </p>
        )}
      </div>

      {statusMsg && (
        <Alert role="status" aria-live="polite" className="py-2.5">
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

      {/* Caption Lines Header & Controls */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="font-heading text-sm font-bold text-foreground">
              Captions
            </h3>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {sortedCaptions.length} {sortedCaptions.length === 1 ? 'cue' : 'cues'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
              Per screen
            </span>
            <div
              role="group"
              aria-label="Words per screen"
              className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 border border-border"
            >
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={wordsPerPage === opt.value}
                  onClick={() => handleDensityRegroup(opt.value)}
                  className={`cap-word-chip px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    wordsPerPage === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(sortedCaptions.length > 0 || canUndo || canRedo) && (
          <div className="flex flex-wrap items-center gap-1 border-b border-border/70 pb-2.5">
            {sortedCaptions.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={pickingKeywords}
                  onClick={() => void handleAutoPickSpotlightKeywords()}
                  className="cursor-pointer font-semibold"
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  <span>{pickingKeywords ? 'Highlighting…' : 'Auto Key Words'}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleRemoveFillers}
                  className="cursor-pointer"
                >
                  <Eraser className="w-3 h-3" aria-hidden="true" />
                  <span>Remove fillers</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={polishing}
                  onClick={() => void handleQuickAiPolish()}
                  className="cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" aria-hidden="true" />
                  <span>{polishing ? 'Polishing…' : 'AI Polish'}</span>
                </Button>
              </>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!canUndo}
                onClick={onUndo}
                aria-label="Undo caption edit"
                title="Undo (Ctrl+Z)"
                className="cursor-pointer px-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!canRedo}
                onClick={onRedo}
                aria-label="Redo caption edit"
                title="Redo (Ctrl+Shift+Z)"
                className="cursor-pointer px-1.5"
              >
                <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>

              {sortedCaptions.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      onCaptionsChange(shiftCaptions(captions, -0.2, duration || undefined));
                      setStatusMsg('Shifted all caption timings 0.2s earlier.');
                    }}
                    title="Shift all lines 0.2s earlier"
                    className="font-mono cursor-pointer px-1.5"
                  >
                    -0.2s
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      onCaptionsChange(shiftCaptions(captions, 0.2, duration || undefined));
                      setStatusMsg('Shifted all caption timings 0.2s later.');
                    }}
                    title="Shift all lines 0.2s later"
                    className="font-mono cursor-pointer px-1.5"
                  >
                    +0.2s
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => void handleCopyTranscript()}
                    title="Copy plain transcript"
                    className="cursor-pointer"
                  >
                    {copiedTxt ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                    <span>{copiedTxt ? 'Copied' : '.txt'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => void handleCopySrt()}
                    title="Copy .srt subtitles"
                    className="cursor-pointer"
                  >
                    {copiedSrt ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                    <span>{copiedSrt ? 'Copied' : '.srt'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      onCaptionsChange([]);
                      setStatusMsg('Cleared timeline. Click Undo to restore captions.');
                    }}
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {sortedCaptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2.5">
            <p className="text-sm font-semibold text-foreground">No captions yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Auto-caption a video, paste a script, or add your first line manually.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
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
                <span>Load sample cues</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-border/80 divide-y divide-border/70 lg:max-h-[520px] lg:overflow-y-auto scroll-contain bg-background/30">
              {sortedCaptions.map((cue, index) => {
                const isActive = currentTime >= cue.start && currentTime < cue.end;
                const cueWords = cue.text.trim() ? cue.text.trim().split(/\s+/) : [];
                return (
                  <div
                    key={cue.id}
                    data-testid={`caption-row-${index}`}
                    className={`cue-row-opt px-3 py-2.5 space-y-2 transition-colors ${
                      isActive ? 'bg-accent/55' : 'hover:bg-accent/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-mono font-bold text-foreground tabular-nums w-5">
                          #{index + 1}
                        </span>
                        {isActive && (
                          <span className="text-[11px] font-semibold text-primary">
                            Playing
                          </span>
                        )}
                        <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Label htmlFor={`cap-start-${cue.id}`} className="sr-only">
                            Line {index + 1} start seconds
                          </Label>
                          <Input
                            id={`cap-start-${cue.id}`}
                            type="number"
                            step={0.1}
                            min={0}
                            aria-label={`Line ${index + 1} start time in seconds`}
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
                            className="w-14 h-7 px-1.5 text-center font-mono text-xs tabular-nums bg-background"
                          />
                          <span aria-hidden="true">–</span>
                          <Label htmlFor={`cap-end-${cue.id}`} className="sr-only">
                            Line {index + 1} end seconds
                          </Label>
                          <Input
                            id={`cap-end-${cue.id}`}
                            type="number"
                            step={0.1}
                            min={0.2}
                            aria-label={`Line ${index + 1} end time in seconds`}
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
                            className="w-14 h-7 px-1.5 text-center font-mono text-xs tabular-nums bg-background"
                          />
                          <span>s</span>
                        </div>
                        {cueWords.length > 6 && (
                          <span className="text-[11px] text-muted-foreground">
                            · Split recommended
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
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
                                aria-label={`Start line ${index + 1} at playhead`}
                                className="cursor-pointer"
                              />
                            }
                          >
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Set start time to current playhead</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={!hasVideo}
                                onClick={() => onSeekTo(cue.start, true)}
                                aria-label={`Play line ${index + 1}`}
                                className="cursor-pointer"
                              />
                            }
                          >
                            <Play className="w-3.5 h-3.5" aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Play from this line</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
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
                                aria-label={`Split line ${index + 1}`}
                                className="cursor-pointer"
                              />
                            }
                          >
                            <Scissors className="w-3.5 h-3.5" aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Split into two lines</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={index >= sortedCaptions.length - 1}
                                onClick={() => {
                                  onCaptionsChange(mergeCaptionWithNext(sortedCaptions, cue.id));
                                }}
                                aria-label={`Merge line ${index + 1} with next`}
                                className="cursor-pointer"
                              />
                            }
                          >
                            <Merge className="w-3.5 h-3.5" aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Merge with next line</TooltipContent>
                        </Tooltip>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete caption ${index + 1}`}
                          onClick={() => onCaptionsChange(captions.filter((c) => c.id !== cue.id))}
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`cap-text-${cue.id}`} className="sr-only">
                        Caption {index + 1} text
                      </Label>
                      <Textarea
                        id={`cap-text-${cue.id}`}
                        rows={1}
                        placeholder="Type what is spoken in this line…"
                        value={cue.text}
                        onChange={(e) => {
                          const text = e.target.value;
                          onCaptionsChange(
                            captions.map((c) => (c.id === cue.id ? { ...c, text } : c))
                          );
                        }}
                        className="min-h-[38px] py-1.5 text-sm bg-background/80"
                      />
                    </div>

                    {cueWords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground mr-0.5">
                          Spotlight:
                        </span>
                        {cueWords.map((word, wi) => {
                          const marked = isWordSpotlightKey(word, cue, spotlightAuto);
                          return (
                            <button
                              key={`${cue.id}_chip_${wi}`}
                              type="button"
                              aria-pressed={marked}
                              onClick={() => {
                                const updated = toggleCueKeyWord(cue, word, spotlightAuto);
                                onCaptionsChange(
                                  captions.map((c) => (c.id === cue.id ? updated : c))
                                );
                              }}
                              title="Click to toggle Spotlight key word emphasis"
                              className={`cap-word-chip px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                                marked
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background/60 text-muted-foreground border-border/70 hover:text-foreground'
                              }`}
                            >
                              {word}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="w-full border-dashed cursor-pointer font-semibold"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add next line</span>
            </Button>
          </div>
        )}
      </div>

      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">
              Paste a script or .srt text
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste plain text and it is timed across your trim window ({Math.max(2, Math.round((trimEnd > trimStart ? trimEnd - trimStart : duration || 10) * 10) / 10)}s) with smart phrase breaks. Paste .srt text and its own timings are kept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="paste-script-textarea" className="text-xs">
              Script or .srt text
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
                if (clean.includes('-->')) {
                  const fromSrt = parseSrt(clean, trimStart);
                  if (fromSrt.length) {
                    onCaptionsChange(fromSrt);
                    setScriptDraft('');
                    setScriptOpen(false);
                    setStatusMsg(`Imported ${fromSrt.length} captions from pasted .srt text.`);
                    return;
                  }
                }
                const spanEnd =
                  trimEnd > trimStart
                    ? trimEnd
                    : duration > 0
                      ? duration
                      : Math.max(4, clean.split(/\s+/).length * 0.42);
                const raw = captionsFromText(clean, trimStart, spanEnd);
                const generated = regroupCaptionsSmart(raw, wordsPerPage, 0.75);
                onCaptionsChange(generated);
                setScriptDraft('');
                setScriptOpen(false);
                setStatusMsg(
                  `Created ${generated.length} smart-broken captions across your clip. Fine-tune timing or style below.`
                );
              }}
            >
              Add captions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
