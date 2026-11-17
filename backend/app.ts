import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { allowAiUsage, firebaseReady, requireAiUser } from './firebase';
import { blobReady, createTranscriptionUpload, prepareTranscriptionUpload, removeTranscriptionUpload } from './uploads';
import { DIRECT_TRANSCRIPTION_BYTES, TRANSCRIPTION_CONTENT_TYPES } from '../shared/transcription';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DIRECT_TRANSCRIPTION_BYTES, fields: 2, parts: 4, fieldSize: 100 },
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

app.get('/api/capabilities', (_req: Request, res: Response) => {
  res.json({
    deepgram: firebaseReady() && Boolean(process.env.DEEPGRAM_API_KEY),
    inception: firebaseReady() && Boolean(process.env.INCEPTION_API_KEY),
    largeUploads: firebaseReady() && Boolean(process.env.DEEPGRAM_API_KEY) && blobReady(),
  });
});

app.post('/api/transcription-upload', requireAiUser, createTranscriptionUpload);

app.post('/api/transcribe', requireAiUser, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'Automatic captions are unavailable. You can still add or import captions manually.' });
      return;
    }

    const uploadId = typeof req.body?.uploadId === 'string' ? req.body.uploadId : '';
    const file = req.file;
    if (!uploadId && (!file || !TRANSCRIPTION_CONTENT_TYPES.has(file.mimetype))) {
      res.status(400).json({ error: 'Choose a supported audio or video file.' });
      return;
    }
    const stored = uploadId ? await prepareTranscriptionUpload(res, uploadId) : undefined;
    if (uploadId && !stored) return;
    if (!await allowAiUsage(res, 'request', uploadId)) return;

    const requestedLanguage = String(req.body?.language || 'en').toLowerCase();
    const language = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(requestedLanguage) ? requestedLanguage : 'en';
    const dgUrl = new URL('https://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('model', 'nova-2');
    dgUrl.searchParams.set('smart_format', 'true');
    dgUrl.searchParams.set('punctuate', 'true');
    dgUrl.searchParams.set('utterances', 'true');
    dgUrl.searchParams.set('language', language);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(dgUrl, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': stored ? 'application/json' : (file?.mimetype || 'application/octet-stream'),
        },
        body: stored ? JSON.stringify({ url: stored.url }) : new Uint8Array(file!.buffer),
        signal: AbortSignal.timeout(90_000),
      });
    } finally {
      if (stored) await removeTranscriptionUpload(stored.pathname);
    }

    if (!upstream.ok) {
      res.status(502).json({ error: 'Deepgram could not transcribe this clip. Try a shorter clip or a different format.' });
      return;
    }

    const data = await upstream.json();
    const alt = data?.results?.channels?.[0]?.alternatives?.[0];
    res.json({
      provider: 'deepgram',
      words: alt?.words || [],
      utterances: data?.results?.utterances || [],
      transcript: alt?.transcript || '',
    });
  } catch {
    res.status(502).json({ error: 'Transcription could not finish. Try again or import captions manually.' });
  }
});

app.post('/api/captions/refine', requireAiUser, async (req: Request, res: Response) => {
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

    const language = typeof targetLanguage === 'string' ? targetLanguage.trim().slice(0, 40) : '';
    if (action === 'translate' && !/^[a-zA-Z -]{2,40}$/.test(language)) {
      res.status(400).json({ error: 'Select a supported target language.' });
      return;
    }
    if (!await allowAiUsage(res, 'request')) return;
    const safeTexts = texts.slice(0, 300).map((t) => String(t ?? '').slice(0, 500));
    if (action === 'keywords') {
      const upstream = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
        signal: AbortSignal.timeout(90_000),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mercury-3',
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content:
                'Select 1 to 2 high-impact Spotlight key words per caption (numbers, prices, dates, proper names, places, contrasting or power nouns). Never pick filler words or common verbs like is/will/has. Reply ONLY with a JSON array of string arrays matching input length.',
            },
            {
              role: 'user',
              content: `Captions JSON:\n${JSON.stringify(safeTexts)}`,
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
        throw new Error('Inception Mercury 3 keyword response shape mismatch.');
      }
      res.json({
        providerUsed: 'inception-mercury-3',
        keyWordsList: parsed.map((entry) =>
          Array.isArray(entry)
            ? entry.filter((w): w is string => typeof w === 'string' && w.trim().length > 0).slice(0, 6)
            : []
        ),
      });
      return;
    }

    let instruction =
      'Fix punctuation, capitalisation, and obvious misheard words in each caption. Keep the same language and roughly the same length. Do not add new information.';
    if (action === 'punchy') {
      instruction =
        'Restyle each caption for short-form video: make it short, punchy, and easy to read at a glance, ideally 2 to 5 words per caption, keeping the speaker meaning and language. Do not add hashtags or emojis.';
    } else if (action === 'translate') {
      instruction = `Translate each caption into ${language}. Keep it short and natural for short-form video subtitles, preserving the exact array length and order.`;
    }

    const upstream = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
      signal: AbortSignal.timeout(90_000),
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

app.post('/api/voiceover', requireAiUser, async (req: Request, res: Response) => {
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
    if (!await allowAiUsage(res, 'request')) return;

    const dgUrl = new URL('https://api.deepgram.com/v1/speak');
    dgUrl.searchParams.set('model', safeVoice);

    const dgRes = await fetch(dgUrl.toString(), {
      signal: AbortSignal.timeout(90_000),
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

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

const handleApiError: express.ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const tooLarge = error.code === 'LIMIT_FILE_SIZE' || error.status === 413;
  if (tooLarge) {
    res.status(413).json({ error: 'This upload is too large. Choose a smaller clip and try again.' });
    return;
  }
  res.status(400).json({ error: 'The request could not be read.' });
};

app.use('/api', handleApiError);

export default app;
