import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/capabilities', (_req: Request, res: Response) => {
  res.json({
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    inception: Boolean(process.env.INCEPTION_API_KEY),
  });
});

app.post('/api/transcribe', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No audio or video file uploaded.' });
      return;
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'DEEPGRAM_API_KEY is not configured in server environment variables. Add it in Vercel Project Settings -> Environment Variables, or use Browser Listening / manual captioning below.',
        missingEnvVar: 'DEEPGRAM_API_KEY',
      });
      return;
    }

    const language = String(req.body.language || 'en').trim();
    const model = String(req.body.model || 'nova-2').trim();

    const dgUrl = new URL('https://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('model', model || 'nova-2');
    dgUrl.searchParams.set('smart_format', 'true');
    dgUrl.searchParams.set('punctuate', 'true');
    dgUrl.searchParams.set('utterances', 'true');
    if (language) dgUrl.searchParams.set('language', language);

    const dgRes = await fetch(dgUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
      body: new Uint8Array(file.buffer),
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      res.status(dgRes.status).json({
        error: `Deepgram error (${dgRes.status}): ${errText.slice(0, 220)}`,
      });
      return;
    }

    const data = await dgRes.json();
    const alt = data?.results?.channels?.[0]?.alternatives?.[0];
    res.json({
      provider: 'deepgram',
      words: alt?.words || [],
      utterances: data?.results?.utterances || [],
      transcript: alt?.transcript || '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected Deepgram transcription error';
    res.status(500).json({ error: message });
  }
});

app.post('/api/captions/refine', async (req: Request, res: Response) => {
  try {
    const { texts, action, targetLanguage } = req.body || {};
    if (!Array.isArray(texts) || texts.length === 0) {
      res.status(400).json({ error: 'Provide a non-empty array of caption texts.' });
      return;
    }

    const apiKey = process.env.INCEPTION_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'INCEPTION_API_KEY is not configured in server environment variables. Add your Inception Mercury 3 key in Vercel Project Settings -> Environment Variables.',
        missingEnvVar: 'INCEPTION_API_KEY',
      });
      return;
    }

    const safeTexts = texts.slice(0, 300).map((t) => String(t ?? '').slice(0, 500));
    let instruction =
      'Fix punctuation, capitalisation, and obvious misheard words in each caption. Keep the same language and roughly the same length. Do not add new information.';
    if (action === 'punchy') {
      instruction =
        'Restyle each caption for short-form video: make it short, punchy, and easy to read at a glance, ideally 2 to 5 words per caption, keeping the speaker meaning and language. Do not add hashtags or emojis.';
    } else if (action === 'translate') {
      const lang = String(targetLanguage || '').trim();
      if (!lang) {
        res.status(400).json({ error: 'Select a target language for translation.' });
        return;
      }
      instruction = `Translate each caption into ${lang}. Keep it short and natural for short-form video subtitles, preserving the exact array length and order.`;
    }

    const upstream = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mercury-3',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You edit short-video caption text. Reply with ONLY a JSON array of strings, same length and order as the input.',
          },
          {
            role: 'user',
            content: `${instruction}\n\nCaptions JSON:\n${JSON.stringify(safeTexts)}`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({
        error: `Inception Mercury 3 error (${upstream.status}): ${errText.slice(0, 200)}`,
      });
      return;
    }

    const json = await upstream.json();
    const content = json?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    if (!Array.isArray(parsed) || parsed.length !== safeTexts.length) {
      throw new Error('Inception Mercury 3 response shape mismatch.');
    }

    res.json({
      providerUsed: 'inception-mercury-3',
      texts: parsed.map((item, idx) =>
        typeof item === 'string' && item.trim() ? item.trim().slice(0, 500) : safeTexts[idx]
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI refinement failed';
    res.status(500).json({ error: message });
  }
});

const ALLOWED_DEEPGRAM_VOICES = new Set([
  'aura-2-thalia-en',
  'aura-2-apollo-en',
  'aura-asteria-en',
  'aura-luna-en',
  'aura-orion-en',
  'aura-arcas-en',
]);

app.post('/api/voiceover', async (req: Request, res: Response) => {
  try {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const requestedVoice = typeof req.body?.voice === 'string' ? req.body.voice.trim() : 'aura-2-thalia-en';

    if (!rawText) {
      res.status(400).json({ error: 'Enter script text or load your captions before generating AI voice.' });
      return;
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'DEEPGRAM_API_KEY is not configured in server environment variables. Add it in Vercel Project Settings -> Environment Variables.',
        missingEnvVar: 'DEEPGRAM_API_KEY',
      });
      return;
    }

    const safeVoice = ALLOWED_DEEPGRAM_VOICES.has(requestedVoice)
      ? requestedVoice
      : 'aura-2-thalia-en';
    const safeText = rawText.slice(0, 1900);

    const dgUrl = new URL('https://api.deepgram.com/v1/speak');
    dgUrl.searchParams.set('model', safeVoice);

    const dgRes = await fetch(dgUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text: safeText }),
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      res.status(dgRes.status).json({
        error: `Deepgram voice error (${dgRes.status}): ${errText.slice(0, 220)}`,
      });
      return;
    }

    const audioArrayBuffer = await dgRes.arrayBuffer();
    res.setHeader('Content-Type', dgRes.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(audioArrayBuffer));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected Deepgram AI voiceover error';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Caption Lite server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
