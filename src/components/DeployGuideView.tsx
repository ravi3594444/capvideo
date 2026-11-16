import { useState } from 'react';
import { Check, CheckCircle2, CircleAlert, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ServerCapabilities } from './CaptionsPanel';

interface DeployGuideViewProps {
  capabilities: ServerCapabilities | null;
}

const ENV_ROWS = [
  {
    key: 'DEEPGRAM_API_KEY',
    purpose: 'Server-side audio transcription with word-level timestamps via Deepgram Nova-2 (/api/transcribe)',
    required: 'Required for Auto-Captions',
    statusKey: 'deepgram' as const,
  },
  {
    key: 'INCEPTION_API_KEY',
    purpose: 'Server-side AI caption clean-up, short & punchy restyle, and translation via Inception Mercury 3 (/api/captions/refine)',
    required: 'Required for Mercury 3 AI',
    statusKey: 'inception' as const,
  },
];

const ENV_SNIPPET = `# Vercel Project Settings -> Environment Variables (Server-side only, never VITE_ or NEXT_PUBLIC_)
DEEPGRAM_API_KEY="dg_your_deepgram_server_key"
INCEPTION_API_KEY="inc_your_inception_mercury3_key"
APP_URL="https://your-app.vercel.app"`;

export function DeployGuideView({ capabilities }: DeployGuideViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ENV_SNIPPET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard restriction
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display heading-editorial font-bold text-foreground">
          Vercel Backend API Keys &amp; Firebase Setup
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          All transcription (Deepgram Nova-2) and caption refinement (Inception Mercury 3) API keys remain strictly on your backend via server proxy routes (<code className="font-mono">/api/transcribe</code> and <code className="font-mono">/api/captions/refine</code>). Add these secrets in Vercel Project Settings → Environment Variables.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="font-display text-base">
                01. Backend Environment Variables (Secrets)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Live server environment status
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Variable name</TableHead>
                <TableHead className="px-5">What it powers</TableHead>
                <TableHead className="px-5">Requirement</TableHead>
                <TableHead className="px-5 text-right">Current server</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENV_ROWS.map((row) => {
                const isReady = capabilities ? capabilities[row.statusKey] : false;
                return (
                  <TableRow key={row.key}>
                    <TableCell className="px-5 py-3.5 font-mono font-semibold text-foreground whitespace-nowrap">
                      {row.key}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-xs text-muted-foreground whitespace-normal">
                      {row.purpose}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-xs font-medium text-foreground whitespace-nowrap">
                      {row.required}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right whitespace-nowrap">
                      {capabilities === null ? (
                        <span className="text-xs text-muted-foreground">Checking…</span>
                      ) : isReady ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Configured</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <CircleAlert className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Not set</span>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-display text-base">
              02. Ready-to-paste Vercel Environment Template
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopy()}
              className="cursor-pointer font-semibold"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy template</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-zinc-950 text-zinc-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
            {ENV_SNIPPET}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">
            03. Firebase Auth Domain Allowlist for Vercel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              Your Firebase Web SDK config (<code className="font-mono">firebase-applet-config.json</code>) is already bundled safely for client-side Auth &amp; Firestore — Firebase Web API keys are public identifiers secured by your <code className="font-mono">firestore.rules</code>.
            </li>
            <li>
              Once deployed to Vercel, copy your production domain (e.g. <code className="font-mono">your-app.vercel.app</code>) and add it in{' '}
              <strong className="text-foreground">Firebase Console → Authentication → Settings → Authorized domains</strong> so Google Sign-In popups work on your live domain.
            </li>
            <li>
              Keep <code className="font-mono">DEEPGRAM_API_KEY</code> and <code className="font-mono">INCEPTION_API_KEY</code> strictly on the backend (never prefix them with <code className="font-mono">VITE_</code> or <code className="font-mono">NEXT_PUBLIC_</code>).
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
