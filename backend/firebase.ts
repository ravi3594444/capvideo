import { createHash } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { cert, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const appName = 'caption-lite';
const aiCountersCollection = '_captionLiteAiUsage';
const claimedUploadsCollection = '_captionLiteClaimedUploads';

function getFirebaseApp() {
  try {
    return getApp(appName);
  } catch {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
    if (credentials.project_id !== firebaseConfig.projectId) {
      throw new Error('Firebase service account project mismatch');
    }
    return initializeApp({ credential: cert(credentials), projectId: firebaseConfig.projectId }, appName);
  }
}

export function firebaseReady() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

export function aiUserKey(res: Response) {
  return createHash('sha256').update(res.locals.uid as string).digest('hex');
}

export const requireAiUser: RequestHandler = async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const token = /^Bearer (\S+)$/i.exec(req.get('Authorization') || '')?.[1];
  if (!token) {
    res.status(401).json({ error: 'Sign in with Google to use AI tools.' });
    return;
  }

  let auth;
  try {
    auth = getAuth(getFirebaseApp());
  } catch {
    res.status(503).json({ error: 'AI sign-in is unavailable. Try again later.' });
    return;
  }

  try {
    const user = await auth.verifyIdToken(token);
    if (!user.email_verified || user.firebase.sign_in_provider !== 'google.com') {
      res.status(403).json({ error: 'Use a verified Google account to access AI tools.' });
      return;
    }
    res.locals.uid = user.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Your sign-in expired. Sign in again and retry.' });
  }
};

function limit(name: string, fallback: number) {
  const setting = process.env[name];
  if (setting === undefined) return fallback;
  const value = Number(setting);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export async function allowAiUsage(
  res: Response, kind: 'upload' | 'request', uploadId?: string
) {
  const personalLimit = kind === 'upload'
    ? limit('AI_DAILY_UPLOADS_PER_USER', 5)
    : limit('AI_DAILY_REQUESTS_PER_USER', 10);
  const globalLimit = kind === 'upload'
    ? limit('AI_DAILY_UPLOADS_TOTAL', 50)
    : limit('AI_DAILY_REQUESTS_TOTAL', 100);
  const userKey = aiUserKey(res);
  const day = new Date().toISOString().slice(0, 10);

  try {
    const db = getFirestore(getFirebaseApp(), firebaseConfig.firestoreDatabaseId);
    const counters = db.collection(aiCountersCollection);
    const globalCounter = counters.doc(`${day}_${kind}`);
    const userCounter = counters.doc(`${day}_${kind}_${userKey}`);
    const claim = uploadId ? db.collection(claimedUploadsCollection).doc(`${userKey}_${uploadId}`) : undefined;

    const result = await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(globalCounter, userCounter, ...(claim ? [claim] : []));
      if (snapshots[2]?.exists) return 'claimed';
      const globalCount = Number(snapshots[0].get('count') || 0);
      const userCount = Number(snapshots[1].get('count') || 0);
      if (globalCount >= globalLimit || userCount >= personalLimit) return 'limit';

      transaction.set(globalCounter, { count: globalCount + 1 });
      transaction.set(userCounter, { count: userCount + 1 });
      if (claim) transaction.create(claim, { createdAt: new Date() });
      return 'ok';
    });

    if (result === 'ok') return true;
    if (result === 'claimed') {
      res.status(409).json({ error: 'This upload was already used. Upload your clip again to retry.' });
      return false;
    }
    res.status(429).json({ error: 'Today’s AI limit has been reached. Try again tomorrow.' });
  } catch (error) {
    console.error('Could not reserve AI usage', error instanceof Error ? error.name : 'unknown');
    res.status(503).json({ error: 'AI usage could not be checked. Try again later.' });
  }
  return false;
}
