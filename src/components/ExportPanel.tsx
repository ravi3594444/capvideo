import React, { useState } from 'react';
import { Copy, Download, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  buildPlainTranscript,
  buildSrt,
  buildVtt,
  type AspectRatio,
  type CaptionCue,
  type StyleConfig,
} from '../utils/captions';
import type { AudioGraphHandle, NoiseCleanStrength } from '../utils/audioEngine';
import { exportBurnedInWebM } from '../utils/videoExport';

interface ExportPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoLoaded: boolean;
  captions: CaptionCue[];
  aspect: AspectRatio;
  styleConfig: StyleConfig;
  trimStart: number;
  trimEnd: number;
  improveAudio: boolean;
  noiseStrength: NoiseCleanStrength;
  audioGraph: AudioGraphHandle | null;
  voiceoverBlob: Blob | null;
  voiceoverEnabled: boolean;
  replaceOriginalAudio: boolean;
  projectTitle: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 800);
}

export function ExportPanel({
  videoRef,
  videoLoaded,
  captions,
  aspect,
  styleConfig,
  trimStart,
  trimEnd,
  improveAudio,
  noiseStrength,
  audioGraph,
  voiceoverBlob,
  voiceoverEnabled,
  replaceOriginalAudio,
  projectTitle,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const safeSlug =
    (projectTitle || 'caption-lite')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'caption-lite';

  const handleExportVideo = async () => {
    if (!videoLoaded || !videoRef.current) {
      setStatus('Load a video first in section 01.');
      return;
    }

    setExporting(true);
    setProgress(0);
    setStatus('Recording trimmed clip with burned-in captions… keep this tab open.');

    try {
      const { blob, usedCleanAudio, usedAiVoice } = await exportBurnedInWebM({
        video: videoRef.current,
        captions,
        aspect,
        styleConfig,
        trimStart,
        trimEnd,
        improveAudio,
        noiseStrength,
        audioGraph,
        voiceoverBlob,
        voiceoverEnabled,
        replaceOriginalAudio,
        onProgress: (pct) => setProgress(pct),
      });
      triggerDownload(blob, `${safeSlug}.webm`);
      const audioNotes: string[] = [];
      if (usedAiVoice) audioNotes.push('with Deepgram AI voiceover');
      else if (usedCleanAudio) audioNotes.push('with background noise removed');
      setStatus(
        `Saved ${safeSlug}.webm (${(blob.size / 1048576).toFixed(1)} MB) without watermark${
          audioNotes.length ? `, ${audioNotes.join(' ')}.` : '.'
        }`
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSrt = () => {
    const valid = captions.some((c) => c.text.trim().length > 0);
    if (!valid) {
      setStatus('Add at least one caption with words before exporting .srt.');
      return;
    }
    const srt = buildSrt(captions, trimStart);
    triggerDownload(new Blob([srt], { type: 'text/plain;charset=utf-8' }), `${safeSlug}.srt`);
    setStatus(`Saved ${safeSlug}.srt. Timestamps start at your trim point.`);
  };

  const handleExportVtt = () => {
    const valid = captions.some((c) => c.text.trim().length > 0);
    if (!valid) {
      setStatus('Add at least one caption with words before exporting .vtt.');
      return;
    }
    const vtt = buildVtt(captions, trimStart);
    triggerDownload(new Blob([vtt], { type: 'text/vtt;charset=utf-8' }), `${safeSlug}.vtt`);
    setStatus(`Saved ${safeSlug}.vtt WebVTT subtitle file.`);
  };

  const handleExportTxt = async () => {
    const txt = buildPlainTranscript(captions);
    if (!txt) {
      setStatus('Add at least one caption with words before copying transcript.');
      return;
    }
    triggerDownload(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `${safeSlug}-transcript.txt`);
    try {
      await navigator.clipboard.writeText(txt);
      setStatus(`Saved ${safeSlug}-transcript.txt and copied plain transcript to clipboard.`);
    } catch {
      setStatus(`Saved ${safeSlug}-transcript.txt.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-heading text-sm font-bold text-foreground">
          Export without watermark
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Video exports render live onto a high-DPI canvas preserving your Reveal mode, Entrance effect, Spotlight key words, and cleaned or AI-voiced audio.
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={exporting}
        onClick={() => void handleExportVideo()}
        className="w-full h-10 font-semibold cursor-pointer"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>{exporting ? 'Recording video…' : 'Download video with burned-in captions'}</span>
      </Button>

      {exporting && (
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2" aria-label="Export progress" />
          <p className="font-mono text-xs text-muted-foreground tabular-nums text-right">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleExportSrt}
          className="cursor-pointer font-semibold"
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>Download .srt</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleExportVtt}
          className="cursor-pointer font-semibold"
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>Download .vtt</span>
        </Button>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => void handleExportTxt()}
        className="w-full cursor-pointer font-semibold"
      >
        <Copy className="w-4 h-4" aria-hidden="true" />
        <span>Export &amp; copy transcript (.txt)</span>
      </Button>

      {status && (
        <Alert>
          <AlertDescription className="text-xs">{status}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
