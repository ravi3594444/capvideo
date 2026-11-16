import React, { useRef, useState } from 'react';
import { Pipette, Sparkles, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { StyleConfig } from '../utils/captions';
import { analyzeReferenceVideo, rgbToHex, type ReferenceAnalysis } from '../utils/referenceMatch';

interface ReferenceMatchPanelProps {
  styleConfig: StyleConfig;
  onApplyLook: (next: StyleConfig) => void;
}

export function ReferenceMatchPanel({ styleConfig, onApplyLook }: ReferenceMatchPanelProps) {
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [detected, setDetected] = useState<ReferenceAnalysis | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [pickStatus, setPickStatus] = useState('');

  const refVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFile = (file: File) => {
    if (refUrl) URL.revokeObjectURL(refUrl);
    setRefUrl(URL.createObjectURL(file));
    setDetected(null);
    setFrozen(false);
    setReady(false);
    setStatus('Reference video loaded. Wait for metadata, then click “Read reference style”.');
  };

  const handleAnalyse = async () => {
    if (!refVideoRef.current) return;
    setStatus('Sampling frames locally on your device…');
    const result = await analyzeReferenceVideo(refVideoRef.current);
    if (!result) {
      setStatus(
        'Could not automatically isolate caption colors from those frames. Freeze a frame below and tap directly on a caption word.'
      );
      return;
    }
    setDetected(result);
    setStatus('Detected caption color, position, and closest built-in look.');
  };

  const handleFreeze = () => {
    const vid = refVideoRef.current;
    const cv = canvasRef.current;
    if (!vid || !vid.src || !cv) {
      setPickStatus('Load a reference video first.');
      return;
    }
    const vw = vid.videoWidth || 320;
    const vh = vid.videoHeight || 180;
    const scale = Math.min(1, 340 / vw);
    cv.width = Math.round(vw * scale);
    cv.height = Math.round(vh * scale);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, cv.width, cv.height);
    setFrozen(true);
    setPickStatus(
      'Frame frozen. Tap directly on a caption word in the image below to sample its exact color.'
    );
  };

  const handlePickPixel = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (cv.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (cv.height / rect.height));
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    try {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const hex = rgbToHex(d[0], d[1], d[2]);
      onApplyLook({ ...styleConfig, accentColor: hex });
      setPickStatus(`Picked ${hex} and set as your accent color.`);
    } catch {
      setPickStatus('Could not read pixel color. Try tapping another spot.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-heading text-sm font-bold text-foreground">
          Match a reference video (on-device)
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Load a clip whose caption look you like. Frame sampling runs locally in your browser (nothing is uploaded) to infer color, position, and closest animation style.
        </p>
      </div>

      <label className="w-full h-10 px-4 rounded-lg text-xs font-semibold border border-border bg-muted/40 hover:bg-muted text-foreground inline-flex items-center justify-center gap-2 cursor-pointer transition-colors">
        <Upload className="w-4 h-4" aria-hidden="true" />
        <span>Pick reference video (MP4 or WebM)</span>
        <input
          type="file"
          accept="video/mp4,video/webm,video/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {refUrl && (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden bg-zinc-950 max-w-[300px] mx-auto border border-border">
            <video
              ref={refVideoRef}
              src={refUrl}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={() => setReady(true)}
              className="w-full max-h-[260px] block"
            />
          </div>

          <Button
            type="button"
            size="lg"
            disabled={!ready}
            onClick={() => void handleAnalyse()}
            className="w-full font-semibold cursor-pointer"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Read reference style</span>
          </Button>
        </div>
      )}

      {status && (
        <Alert>
          <AlertDescription className="text-xs">{status}</AlertDescription>
        </Alert>
      )}

      {detected && (
        <div className="rounded-xl glass-subpanel p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <span>Detected color:</span>
            <span
              className="w-5 h-5 rounded border border-border inline-block"
              style={{ backgroundColor: detected.hex }}
            />
            <strong className="font-mono">{detected.hex}</strong>
          </div>
          <p className="text-xs text-foreground">
            Position: <strong>{detected.positionLabel}</strong> · Closest look:{' '}
            <strong>{detected.styleLabel}</strong>
          </p>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              onApplyLook({
                ...styleConfig,
                accentColor: detected.hex,
                position: detected.position,
                style: detected.style,
              });
              setStatus(`Applied ${detected.hex} and ${detected.styleLabel}.`);
            }}
            className="w-full font-semibold cursor-pointer"
          >
            Apply this look to my video
          </Button>
        </div>
      )}

      {refUrl && (
        <>
          <Separator />
          <div className="space-y-2.5">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleFreeze}
              className="w-full cursor-pointer"
            >
              <Pipette className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Color not right? Freeze frame &amp; pick by hand</span>
            </Button>

            <canvas
              ref={canvasRef}
              onClick={handlePickPixel}
              className={`mx-auto rounded-lg border border-border cursor-crosshair ${
                frozen ? 'block max-w-full' : 'hidden'
              }`}
            />

            {pickStatus && (
              <Alert>
                <AlertDescription className="text-xs">{pickStatus}</AlertDescription>
              </Alert>
            )}
          </div>
        </>
      )}
    </div>
  );
}
