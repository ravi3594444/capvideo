import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CAPTION_FAQ, CAPTION_STEPS } from '../utils/publicContent';

export function HowItWorksView({ onOpenStudio }: { onOpenStudio: () => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display heading-editorial font-bold text-foreground">
          How to Add Captions to a Video
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Built for bloggers, Reels, Shorts, and TikTok creators. Your video stays on your device for frame cropping, Web Audio clean-up, reference color matching, and watermark-free WebM export.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <h2 className="font-display text-base font-bold">
              Step-by-step workflow
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            {CAPTION_STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <h2 className="font-display text-base font-bold">
              Audio and reference matching
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Audio Clean-up:</strong> Runs 100% locally via the Web Audio API (90 Hz high-pass filter, RMS noise gate, dynamics compressor, makeup gain). It reduces steady room hum and pauses well, though it is not an AI stem separator for heavy music or barking dogs.
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
              Frequently asked questions
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {CAPTION_FAQ.map((item) => (
            <div key={item.question} className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{item.question}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
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
