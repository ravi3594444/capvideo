import type { RequestHandler, Response } from 'express';
import { Redis } from '@upstash/redis';
import { aiUserKey } from './firebase.js';

const quotaUnavailable = 'AI usage could not be checked. Try again later.';
const prefix = '{caption-lite:ai}';
const claimTtlSeconds = 2 * 24 * 60 * 60;

// Check both limits and claim the upload in the same operation. The claim
// outlives the one-day private blob so it also prevents reuse across midnight.
const reserveUsage = `
  if KEYS[3] and redis.call('EXISTS', KEYS[3]) == 1 then return 'claimed' end
  local total = tonumber(redis.call('GET', KEYS[1]) or '0')
  local personal = tonumber(redis.call('GET', KEYS[2]) or '0')
  if total >= tonumber(ARGV[1]) or personal >= tonumber(ARGV[2]) then return 'limit' end
  redis.call('SET', KEYS[1], total + 1, 'EX', ARGV[3])
  redis.call('SET', KEYS[2], personal + 1, 'EX', ARGV[3])
  if KEYS[3] then redis.call('SET', KEYS[3], '1', 'EX', ARGV[4]) end
  return 'ok'
`;

function redisCredentials() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    return { url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN };
  }
  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    return { url: KV_REST_API_URL, token: KV_REST_API_TOKEN };
  }
}

export function quotaReady() {
  return Boolean(redisCredentials());
}

export const requireAiQuota: RequestHandler = (_req, res, next) => {
  if (!quotaReady()) {
    res.status(503).json({ error: quotaUnavailable });
    return;
  }
  next();
};

function limit(name: string, fallback: number) {
  const setting = process.env[name];
  if (!setting?.trim()) return fallback;
  const value = Number(setting);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export async function allowAiUsage(res: Response, kind: 'upload' | 'request', uploadId?: string) {
  const personalLimit = kind === 'upload'
    ? limit('AI_DAILY_UPLOADS_PER_USER', 5)
    : limit('AI_DAILY_REQUESTS_PER_USER', 10);
  const globalLimit = kind === 'upload'
    ? limit('AI_DAILY_UPLOADS_TOTAL', 50)
    : limit('AI_DAILY_REQUESTS_TOTAL', 100);
  const userKey = aiUserKey(res);
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const dayMs = 24 * 60 * 60 * 1000;
  const secondsUntilMidnight = Math.ceil((dayMs - now % dayMs) / 1000);
  const keys = [`${prefix}:${day}:${kind}:total`, `${prefix}:${day}:${kind}:user:${userKey}`];
  if (uploadId) keys.push(`${prefix}:claim:${userKey}:${uploadId}`);

  try {
    const credentials = redisCredentials();
    if (!credentials) throw new Error('Missing Redis credentials');
    const redis = new Redis({
      ...credentials,
      // A lost response may already have reserved a slot. Avoid retrying the write.
      retry: { retries: 0 },
      enableAutoPipelining: false,
      responseEncoding: false,
      signal: AbortSignal.timeout(5_000),
    });
    const result = await redis.eval(reserveUsage, keys, [globalLimit, personalLimit, secondsUntilMidnight, claimTtlSeconds]);

    if (result === 'ok') return true;
    if (result === 'claimed') {
      res.status(409).json({ error: 'This upload was already used. Upload your clip again to retry.' });
      return false;
    }
    if (result !== 'limit') throw new Error('Unexpected Redis reservation result');
    res.status(429).json({ error: 'Today’s AI limit has been reached. Try again tomorrow.' });
  } catch (error) {
    console.error('Could not reserve AI usage', error instanceof Error ? error.name : 'unknown');
    res.status(503).json({ error: quotaUnavailable });
  }
  return false;
}
