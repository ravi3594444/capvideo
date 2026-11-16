import { useState } from 'react';
import { Download, Languages, Mic2, Sparkles, Volume2, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { CaptionCue } from '../utils/captions';
import type { ServerCapabilities } from './CaptionsPanel';

interface AIRefinePanelProps {
  captions: CaptionCue[];
  capabilities: ServerCapabilities | null;
  voiceoverUrl: string | null;
  voiceoverEnabled: boolean;
  replaceOriginalAudio: boolean;
  onVoiceoverGenerated: (blob: Blob) => void;
  onToggleVoiceoverEnabled: (enabled: boolean) => void;
  onChangeReplaceOriginalAudio: (replace: boolean) => void;
  onCaptionsChange: (next: CaptionCue[]) => void;
  onOpenDeployGuide: () => void;
}

const DEEPGRAM_VOICES = [
  { id: 'aura-2-thalia-en', label: 'Thalia · Clear narrator' },
  { id: 'aura-2-apollo-en', label: 'Apollo · Warm storytelling' },
  { id: 'aura-asteria-en', label: 'Asteria · Upbeat Reels' },
  { id: 'aura-luna-en', label: 'Luna · Calm vlog' },
  { id: 'aura-orion-en', label: 'Orion · Deep baritone' },
  { id: 'aura-arcas-en', label: 'Arcas · Conversational' },
];

const TRANSLATE_LANGUAGES = [
  'English',
  'Hindi',
  'Spanish',
  'Portuguese',
  'French',
  'German',
  'Arabic',
];

export function AIRefinePanel({
  captions,
  capabilities,
  voiceoverUrl,
  voiceoverEnabled,
  replaceOriginalAudio,
  onVoiceoverGenerated,
  onToggleVoiceoverEnabled,
  onChangeReplaceOriginalAudio,
  onCaptionsChange,
  onOpenDeployGuide,
}: AIRefinePanelProps) {
  const [targetLang, setTargetLang] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [missingEnv, setMissingEnv] = useState<string | null>(null);

  // AI Voiceover state
  const [selectedVoice, setSelectedVoice] = useState('aura-2-thalia-en');
  const [voiceScript, setVoiceScript] = useState('');
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [voiceMissingEnv, setVoiceMissingEnv] = useState<string | null>(null);

  const captionsJoined = captions
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join(' ');

  const handleLoadFromCaptions = () => {
    if (!captionsJoined) {
      setVoiceStatus('Add or generate captions first, then load them into the voice script.');
      return;
    }
    setVoiceScript(captionsJoined);
    setVoiceStatus('Loaded current caption lines into voiceover script.');
  };

  const handleGenerateVoiceover = async () => {
    const textToSpeak = (voiceScript.trim() || captionsJoined).trim();
    if (!textToSpeak) {
      setVoiceStatus('Type a script or add caption lines first.');
      return;
    }
    if (!voiceScript.trim()) {
      setVoiceScript(textToSpeak);
    }

    setGeneratingVoice(true);
    setVoiceMissingEnv(null);
    setVoiceStatus('Synthesizing natural AI voice with Deepgram Aura…');

    try {
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          voice: selectedVoice,
        }),
      });
      if (!res.ok) {
        let data: { error?: string; missingEnvVar?: string } = {};
        try {
          data = await res.json();
        } catch {
          // ignore
        }
        if (data.missingEnvVar) setVoiceMissingEnv(String(data.missingEnvVar));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      onVoiceoverGenerated(blob);
      const voiceLabel =
        DEEPGRAM_VOICES.find((v) => v.id === selectedVoice)?.label.split(' · ')[0] || 'AI';
      setVoiceStatus(
        `AI voiceover ready (${voiceLabel}). Activated on video preview & burned-in WebM export.`
      );
    } catch (err) {
      setVoiceStatus(err instanceof Error ? err.message : 'Deepgram AI voice generation failed.');
    } finally {
      setGeneratingVoice(false);
    }
  };

  const runRefine = async (action: 'cleanup' | 'punchy' | 'translate') => {
    if (!captions.length) {
      setStatus('Add or generate captions before running Inception Mercury 3 clean-up.');
      return;
    }
    if (action === 'translate' && !targetLang) {
      setStatus('Pick a target language first.');
      return;
    }

    setLoading(true);
    setMissingEnv(null);
    setStatus('Sending caption text only to Inception Mercury 3 (/api/captions/refine)…');

    try {
      const res = await fetch('/api/captions/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: captions.map((c) => c.text),
          action,
          targetLanguage: targetLang || undefined,
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
      setStatus(
        action === 'translate'
          ? `Captions translated to ${targetLang} via Inception Mercury 3.`
          : action === 'punchy'
            ? 'Captions restyled short and punchy via Inception Mercury 3.'
            : 'Punctuation and misheard words cleaned up via Inception Mercury 3.'
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Inception Mercury 3 refinement failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl glass-subpanel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>AI Voiceover (Deepgram Aura)</span>
          </h3>
          <span className="font-mono text-[11px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
            {capabilities === null
              ? 'Checking server…'
              : capabilities.deepgram
                ? 'Deepgram Voice ready'
                : 'Needs DEEPGRAM_API_KEY'}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Turn your captions or script into a studio-clear AI voiceover and swap out noisy background recording in preview &amp; export.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="ai-voice-select" className="text-xs font-semibold">
            AI voice style
          </Label>
          <Select value={selectedVoice} onValueChange={(v) => { if (v) setSelectedVoice(v); }}>
            <SelectTrigger id="ai-voice-select" className="w-full h-9 bg-background">
              <SelectValue>
                {DEEPGRAM_VOICES.find((v) => v.id === selectedVoice)?.label ?? 'Thalia · Clear narrator'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DEEPGRAM_VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ai-voice-script" className="text-xs font-semibold">
              Voiceover script
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleLoadFromCaptions}
              className="text-xs cursor-pointer h-auto py-0.5 px-1.5"
            >
              Load text from captions
            </Button>
          </div>
          <Textarea
            id="ai-voice-script"
            rows={3}
            placeholder={
              captionsJoined
                ? `Leave blank to speak your ${captions.length} caption lines automatically, or type custom narration…`
                : 'Type what the AI voice should read aloud…'
            }
            value={voiceScript}
            onChange={(e) => setVoiceScript(e.target.value)}
            className="text-sm bg-background/60"
          />
        </div>

        <Button
          type="button"
          size="lg"
          disabled={generatingVoice}
          onClick={() => void handleGenerateVoiceover()}
          className="w-full font-semibold cursor-pointer"
        >
          <Volume2 className="w-4 h-4" aria-hidden="true" />
          <span>{generatingVoice ? 'Generating AI voice…' : 'Generate AI voiceover'}</span>
        </Button>

        {voiceoverUrl && (
          <div className="rounded-lg border border-border bg-background/70 p-3 space-y-3">
            <audio controls preload="metadata" src={voiceoverUrl} className="w-full h-9" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="use-ai-voice-switch" className="text-xs font-semibold cursor-pointer">
                Use AI voice on video preview &amp; export
              </Label>
              <Switch
                id="use-ai-voice-switch"
                checked={voiceoverEnabled}
                onCheckedChange={(checked) => onToggleVoiceoverEnabled(Boolean(checked))}
              />
            </div>
            {voiceoverEnabled && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Audio mix</span>
                <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-0.5 border border-border">
                  <button
                    type="button"
                    aria-pressed={replaceOriginalAudio}
                    onClick={() => onChangeReplaceOriginalAudio(true)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      replaceOriginalAudio
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Replace noisy audio
                  </button>
                  <button
                    type="button"
                    aria-pressed={!replaceOriginalAudio}
                    onClick={() => onChangeReplaceOriginalAudio(false)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      !replaceOriginalAudio
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Blend with video
                  </button>
                </div>
              </div>
            )}
            <a
              href={voiceoverUrl}
              download="caption-lite-ai-voice.mp3"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground underline underline-offset-4 hover:text-primary"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download voiceover (.mp3)</span>
            </a>
          </div>
        )}

        {voiceStatus && (
          <Alert role="status" aria-live="polite">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>{voiceStatus}</span>
              {voiceMissingEnv && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={onOpenDeployGuide}
                  className="p-0 h-auto font-semibold cursor-pointer"
                >
                  Configure {voiceMissingEnv}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      <div className="rounded-xl glass-subpanel p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-sm font-bold text-foreground">
            Inception Mercury 3 Clean-up &amp; Translation
          </h3>
          <span className="font-mono text-[11px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
            {capabilities === null
              ? 'Checking server…'
              : capabilities.inception
                ? 'Mercury 3 ready'
                : 'Needs INCEPTION_API_KEY'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Only caption text strings are sent to your server proxy (<code className="font-mono">/api/captions/refine</code>) powered by Inception Mercury 3 — never video or audio. Your API key stays strictly in Vercel backend environment variables.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={loading}
          onClick={() => void runRefine('cleanup')}
          className="cursor-pointer font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>Clean up punctuation</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={loading}
          onClick={() => void runRefine('punchy')}
          className="cursor-pointer font-semibold"
        >
          <Zap className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>Style: short &amp; punchy</span>
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-translate-trigger" className="text-xs font-semibold">
          Translate captions via Mercury 3
        </Label>
        <div className="flex items-center gap-2">
          <Select
            value={targetLang}
            onValueChange={(val) => {
              if (val) setTargetLang(val);
            }}
          >
            <SelectTrigger id="ai-translate-trigger" className="flex-1 h-9 bg-background">
              <SelectValue placeholder="Pick a language…" />
            </SelectTrigger>
            <SelectContent>
              {TRANSLATE_LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="lg"
            disabled={loading}
            onClick={() => void runRefine('translate')}
            className="whitespace-nowrap shrink-0 font-semibold cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Translate</span>
          </Button>
        </div>
      </div>

      {status && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>{status}</span>
            {missingEnv && (
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={onOpenDeployGuide}
                className="p-0 h-auto font-semibold cursor-pointer"
              >
                Configure {missingEnv}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
