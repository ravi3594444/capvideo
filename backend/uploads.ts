import { randomUUID } from 'node:crypto';
import { BlobNotFoundError, del, head, issueSignedToken, presignUrl } from '@vercel/blob';
import type { Request, Response } from 'express';
import { aiUserKey, allowAiUsage } from './firebase.js';
import { MAX_TRANSCRIPTION_BYTES, TRANSCRIPTION_CONTENT_TYPES } from '../shared/transcription.js';

export function blobReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function pathnameFor(res: Response, id: string) {
  return `caption-transcription/${aiUserKey(res)}/${id}`;
}

export async function createTranscriptionUpload(req: Request, res: Response) {
  if (!process.env.DEEPGRAM_API_KEY || !blobReady()) {
    res.status(503).json({ error: 'Large clip uploads are unavailable. Try a smaller clip or import captions manually.' });
    return;
  }
  const { size, contentType } = req.body || {};
  if (!Number.isInteger(size) || size <= 0 || size > MAX_TRANSCRIPTION_BYTES ||
      !TRANSCRIPTION_CONTENT_TYPES.has(contentType)) {
    res.status(400).json({ error: 'Choose a supported video or audio file up to 50 MB.' });
    return;
  }

  if (!await allowAiUsage(res, 'upload')) return;

  try {
    const uploadId = randomUUID();
    const pathname = pathnameFor(res, uploadId);
    const limits = { allowedContentTypes: [contentType], maximumSizeInBytes: size };
    const validUntil = Date.now() + 10 * 60 * 1000;
    const token = await issueSignedToken({ pathname, operations: ['put'], validUntil, ...limits });
    const { presignedUrl } = await presignUrl(token, {
      pathname, operation: 'put', access: 'private', allowOverwrite: false,
      addRandomSuffix: false, ttlDays: 1, ...limits,
    });
    res.json({ uploadId, url: presignedUrl });
  } catch {
    res.status(503).json({ error: 'Could not prepare the clip upload. Try again later.' });
  }
}

export async function prepareTranscriptionUpload(res: Response, uploadId: string) {
  if (!blobReady() || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/.test(uploadId)) {
    res.status(400).json({ error: 'Invalid clip upload.' });
    return;
  }
  const pathname = pathnameFor(res, uploadId);
  try {
    const blob = await head(pathname);
    if (!TRANSCRIPTION_CONTENT_TYPES.has(blob.contentType) || blob.size > MAX_TRANSCRIPTION_BYTES) {
      res.status(400).json({ error: 'Choose a supported video or audio file up to 50 MB.' });
      return;
    }

    const token = await issueSignedToken({
      pathname, operations: ['get'], validUntil: Date.now() + 5 * 60 * 1000,
    });
    const { presignedUrl } = await presignUrl(token, {
      pathname, operation: 'get', access: 'private', useCache: false,
    });
    return { url: presignedUrl, pathname };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      res.status(400).json({ error: 'The clip was not uploaded. Choose the video and try again.' });
    } else {
      res.status(503).json({ error: 'Could not read the uploaded clip. Try again later.' });
    }
  }
}

export async function removeTranscriptionUpload(pathname: string) {
  try {
    await del(pathname);
  } catch {
    console.error('Could not remove a transcription upload. Its expiry remains active.');
  }
}
