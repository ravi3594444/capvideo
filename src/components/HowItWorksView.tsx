import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FAQ_ITEMS = [
  {
    q: 'Does Caption Lite add watermarks to exported videos?',
    a: 'No. Caption Lite renders burned-in animated captions onto an offscreen high-DPI canvas and records your trimmed clip as a clean WebM video or .srt subtitle file without watermarks.',
  },
  {
    q: 'Which backend API keys are required when deploying on Vercel?',
    a: 'Set DEEPGRAM_API_KEY for Deepgram Nova-2 audio transcription (/api/transcribe) and INCEPTION_API_KEY for Inception Mercury 3 caption cleanup and translation (/api/captions/refine) as server-only Vercel environment variables.',
  },
  {
    q: 'How are videos larger than 24 MB handled for transcription?',
    a: 'Files over 24 MB are decoded locally in your browser and re-encoded as a compact 16 kHz mono WAV covering your active trim window before calling /api/transcribe, keeping uploads fast within Vercel payload limits.',
  },
  {
    q: 'Does Reference Style Matching upload my reference clip?',
    a: 'No. Reference Style Matching samples frames locally on an in-browser canvas to infer accent color, vertical placement, and closest animation look without uploading reference video files.',
  },
];

export function HowItWorksView({ onOpenStudio }: { onOpenStudio: () => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display heading-editorial font-bold text-foreground">
          How Caption Lite Works
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Built for bloggers, Reels, Shorts, and TikTok creators. Your video stays on your device for frame cropping, Web Audio clean-up, reference color matching, and watermark-free WebM export.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <h2 className="font-display text-base font-bold">
              01. Step-by-Step Workflow
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              <strong className="text-foreground">Upload &amp; frame:</strong> Drop an MP4 or WebM video onto the Video Stage (or load the sample clip), choose 9:16, 1:1, or 16:9, and set your trim window.
            </li>
            <li>
              <strong className="text-foreground">Deepgram Auto-Captions or manual:</strong> Choose a video from your phone or computer, then tap Auto-caption video to transcribe with word-level timestamps via <code className="font-mono">/api/transcribe</code>, use free browser listening, paste a script, import an <code className="font-mono">.srt</code>, or add rows manually.
            </li>
            <li>
              <strong className="text-foreground">Tap any word &amp; Mercury 3 AI:</strong> Tap directly on any caption word inside the video stage to fix spelling, use Undo/Redo (<code className="font-mono">Ctrl+Z</code>), or run Inception Mercury 3 clean-up and translation on caption text.
            </li>
            <li>
              <strong className="text-foreground">Style &amp; Reference Match:</strong> Pick from Classic, Highlight, Pop, Colour Cycle, Karaoke, Bounce, or Neon — or sample colors from a reference clip locally.
            </li>
            <li>
              <strong className="text-foreground">Save &amp; Export:</strong> Local drafts auto-save automatically; sign in with Google to sync projects and style presets to Firestore, then export a watermark-free WebM or <code className="font-mono">.srt</code> file.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <h2 className="font-display text-base font-bold">
              02. Honest Engineering Limits
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Audio Clean-up:</strong> Runs 100% locally via the Web Audio API (90 Hz high-pass filter, RMS noise gate, dynamics compressor, makeup gain). It reduces steady room hum and pauses well, though it is not an AI stem separator for heavy music or barking dogs.
          </p>
          <p>
            <strong className="text-foreground">Files over 24 MB:</strong> Automatically decoded in your browser and re-encoded as a compact 16 kHz mono WAV of your trimmed window before reaching <code className="font-mono">/api/transcribe</code>, keeping uploads fast within Vercel serverless payload limits.
          </p>
          <p>
            <strong className="text-foreground">Reference Matching:</strong> Samples frames locally on an offscreen canvas to infer dominant caption hue and placement. Use the manual freeze-frame eyedropper when a reference video has complex gradients.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <h2 className="font-display text-base font-bold">
              03. Frequently Asked Questions
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{item.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Button
          type="button"
          size="lg"
          onClick={onOpenStudio}
          className="px-5 font-semibold cursor-pointer"
        >
          Back to Studio
        </Button>
      </div>
    </div>
  );
}
