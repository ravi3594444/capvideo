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
    key: 'Upstash Redis',
    purpose: 'Shared daily request and upload limits',
    required: 'Required for AI tools',
    statusKey: 'quotaStorage' as const,
  },
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
# Supplied by the Upstash Redis connection. Use a read/write token.
UPSTASH_REDIS_REST_URL="https://your-database.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_redis_rest_token"
# KV_REST_API_URL and KV_REST_API_TOKEN also work as a pair.
# Optional private Vercel Blob for larger clips. The connection supplies
# BLOB_STORE_ID (with Vercel OIDC) or BLOB_READ_WRITE_TOKEN.`;

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
          Connect Upstash Redis for shared AI limits and enable the providers you want to use. The API verifies Google sign-ins for the Firebase project in <code className="font-mono">firebase-applet-config.json</code> using Google’s public signing keys. You can remove <code className="font-mono">FIREBASE_SERVICE_ACCOUNT_JSON</code> from this project’s Vercel settings.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="font-display text-base">
                AI service status
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Server configuration reported by <code className="font-mono">/api/capabilities</code>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Service or variable</TableHead>
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
                          <span>Unavailable</span>
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
              Production environment variables
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
            Connect the Production services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              In Vercel Marketplace, open <strong className="text-foreground">Upstash Redis</strong> and install it. Create or select a Redis database, open its <strong className="text-foreground">Settings</strong>, and connect it to the Caption Lite project for <strong className="text-foreground">Production</strong>. Use the same database for every Production instance and keep Redis eviction disabled. Use a separate database for Preview if you enable AI there.
            </li>
            <li>
              In Vercel Project Settings → Environment Variables, confirm Production has <code className="font-mono">UPSTASH_REDIS_REST_URL</code> and <code className="font-mono">UPSTASH_REDIS_REST_TOKEN</code>. If the integration uses <code className="font-mono">KV_REST_API_URL</code> and <code className="font-mono">KV_REST_API_TOKEN</code>, keep that pair. If neither pair was added, copy the REST URL and read/write token from Upstash into the first pair.
            </li>
            <li>
              Keep <code className="font-mono">DEEPGRAM_API_KEY</code> in Production for Auto-caption and voiceover. Add <code className="font-mono">INCEPTION_API_KEY</code> for optional refinement. For clips over 4 MB, connect a private Vercel Blob store to Production.
            </li>
            <li>
              Keep your live domain in <strong className="text-foreground">Firebase Console → Authentication → Settings → Authorized domains</strong> for Google Sign-In. Redeploy after saving the Production settings. Check <code className="font-mono">/api/capabilities</code> for <code className="font-mono">quotaStorage</code> and the enabled providers, then sign in with Google and try Auto-caption.
            </li>
          </ol>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Quotas reset at midnight UTC. The defaults are 10 AI requests and 5 upload grants per user, and 100 AI requests and 50 upload grants total. The four <code className="font-mono">AI_DAILY_*</code> settings in <code className="font-mono">.env.example</code> can override those limits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
