import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, mock, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import app from './app.js';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const project = firebaseConfig.projectId;
const issuer = `https://securetoken.google.com/${project}`;
const googleKeysUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const redisUrl = 'https://caption-redis.test';
const user = 'test-google-user';
const userKey = createHash('sha256').update(user).digest('hex');
const signingKey = await generateKeyPair('RS256');
const wrongKey = await generateKeyPair('RS256');
const googleJwk = { ...await exportJWK(signingKey.publicKey), kid: 'test-google-key', alg: 'RS256' };

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const server = app.listen(0, '127.0.0.1');
let baseUrl: string;
let blobUrl: string;
let quotaResult: 'ok' | 'limit' | 'claimed' | 'unavailable' = 'ok';
let redisCalls: unknown[][] = [];
let providerCalls: string[] = [];
let uploadedPath = '';

const blobServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', blobUrl);
  providerCalls.push(`${req.method} ${url.origin}${url.pathname}`);
  res.setHeader('Content-Type', 'application/json');
  try {
    if (url.pathname === '/signed-token') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const scope = JSON.parse(Buffer.concat(chunks).toString());
      assert.match(scope.pathname, new RegExp(`^caption-transcription/${userKey}/[a-f0-9-]+$`));
      const encoded = Buffer.from(JSON.stringify({ ...scope, storeId: 'test' })).toString('base64url');
      res.end(JSON.stringify({ clientSigningToken: 'blob-test-signing', delegationToken: `${encoded}.signature` }));
    } else if (req.method === 'PUT') {
      const pathname = url.searchParams.get('pathname');
      assert(pathname);
      uploadedPath = pathname;
      req.resume();
      res.end(JSON.stringify({ pathname }));
    } else if (req.method === 'GET') {
      if (!uploadedPath || url.searchParams.get('url') !== uploadedPath) {
        res.writeHead(404).end(JSON.stringify({ error: { code: 'not_found', message: 'Missing blob' } }));
        return;
      }
      res.end(JSON.stringify({ pathname: uploadedPath, contentType: 'video/mp4', size: 5_000_000 }));
    } else {
      assert.equal(url.pathname, '/delete');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), { urls: [uploadedPath] });
      // Leave the fixture readable to model an overlapping request before deletion.
      res.end('{}');
    }
  } catch (error) {
    res.writeHead(400).end(JSON.stringify({ error: { code: 'bad_request', message: String(error) } }));
  }
}).listen(0, '127.0.0.1');

async function serverUrl(server: Server) {
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const now = () => Math.floor(Date.now() / 1000);
const signIn = (claims = {}, key = signingKey.privateKey) => new SignJWT({
  aud: project, iss: issuer, sub: user, iat: now(), auth_time: now() - 60, exp: now() + 60,
  email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...claims,
}).setProtectedHeader({ alg: 'RS256', kid: googleJwk.kid }).sign(key);

function post(path: string, token?: string, data: Record<string, unknown> | FormData = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(data instanceof FormData)) headers.set('Content-Type', 'application/json');
  return fetch(`${baseUrl}/api/${path}`, {
    method: 'POST', headers, body: data instanceof FormData ? data : JSON.stringify(data),
  });
}

before(async () => {
  [baseUrl, blobUrl] = await Promise.all([serverUrl(server), serverUrl(blobServer)]);
  for (const key of [
    'FIREBASE_SERVICE_ACCOUNT_JSON', 'BLOB_STORE_ID', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
    'AI_DAILY_REQUESTS_PER_USER', 'AI_DAILY_REQUESTS_TOTAL', 'AI_DAILY_UPLOADS_PER_USER', 'AI_DAILY_UPLOADS_TOTAL',
  ]) delete process.env[key];
  Object.assign(process.env, {
    UPSTASH_REDIS_REST_URL: redisUrl,
    UPSTASH_REDIS_REST_TOKEN: 'redis-write-test',
    DEEPGRAM_API_KEY: 'test-deepgram',
    INCEPTION_API_KEY: 'test-inception',
    VERCEL_BLOB_API_URL: blobUrl,
    VERCEL_BLOB_RETRIES: '0',
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test_secret',
  });

  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin === baseUrl || url.origin === blobUrl) return originalFetch(input, init);
    if (url.href === googleKeysUrl) return Response.json({ keys: [googleJwk] });
    if (url.origin === redisUrl) {
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer redis-write-test');
      const command = JSON.parse(String(init?.body));
      assert.equal(command[0], 'eval');
      redisCalls.push(command);
      return quotaResult === 'unavailable' ? Response.json({ error: 'Database unavailable' }, { status: 503 })
        : Response.json({ result: quotaResult });
    }
    providerCalls.push(`${init?.method} ${url.origin}${url.pathname}`);
    if (url.href.startsWith('https://api.deepgram.com/v1/listen?')) {
      if (typeof init?.body === 'string') {
        const media = new URL(JSON.parse(init.body).url);
        assert.equal(media.hostname, 'test.private.blob.vercel-storage.com');
        assert.equal(media.pathname, `/${uploadedPath}`);
        assert.equal(media.searchParams.get('cache'), '0');
      } else {
        assert(init?.body instanceof Uint8Array);
      }
      return Response.json({ results: { channels: [{ alternatives: [{ transcript: 'Hello.' }] }] } });
    }
    if (url.href.startsWith('https://api.deepgram.com/v1/speak?')) {
      return new Response('fake audio', { headers: { 'Content-Type': 'audio/mpeg' } });
    }
    if (url.href === 'https://api.inceptionlabs.ai/v1/chat/completions') {
      return Response.json({ choices: [{ message: { content: '["Hello."]' } }] });
    }
    throw new Error(`Unexpected test request to ${url.origin}${url.pathname}`);
  });
});

after(async () => {
  mock.restoreAll();
  process.env = originalEnv;
  await Promise.all([server, blobServer].map(instance => new Promise<void>((resolve, reject) => {
    instance.close(error => error ? reject(error) : resolve());
  })));
});

test('advertises and serves configured AI routes with a Firebase ID token and no service account', async () => {
  assert.equal(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, undefined);
  const capabilities = await fetch(`${baseUrl}/api/capabilities`);
  assert.equal(capabilities.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await capabilities.json(), { quotaStorage: true, deepgram: true, inception: true, largeUploads: true });
  const token = await signIn();
  const file = new FormData();
  file.set('file', new Blob(['sample'], { type: 'audio/wav' }), 'sample.wav');
  const transcription = await post('transcribe', token, file);
  assert.equal(transcription.status, 200);
  assert.deepEqual(await transcription.json(), { provider: 'deepgram', words: [], utterances: [], transcript: 'Hello.' });
  const refinement = await post('captions/refine', token, { texts: ['hello'] });
  assert.equal(refinement.status, 200);
  assert.deepEqual(await refinement.json(), { providerUsed: 'inception-mercury-3', texts: ['Hello.'] });
  const voiceover = await post('voiceover', token, { text: 'Hello.' });
  assert.equal(voiceover.status, 200);
  assert.equal(voiceover.headers.get('content-type'), 'audio/mpeg');
  assert.equal(redisCalls.length, 3);
  for (const call of redisCalls) {
    assert.equal(Number(call[2]), 2);
    assert.match(String(call[3]), /:\d{4}-\d\d-\d\d:request:total$/);
    assert.equal(call[4], String(call[3]).replace('total', `user:${userKey}`));
    assert.deepEqual(call.slice(5, 7).map(Number), [100, 10]);
    assert(Number(call[7]) > 0 && Number(call[7]) <= 86400);
  }
});

test('rejects missing, forged, expired, wrong-project and unauthorized sign-ins before reserving quota', async () => {
  const previousCalls = redisCalls.length;
  for (const [token, status] of [
    [undefined, 401],
    ['malformed', 401],
    [await signIn({}, wrongKey.privateKey), 401],
    [await signIn({ exp: now() - 1 }), 401],
    [await signIn({ aud: 'a-different-project' }), 401],
    [await signIn({ iss: 'https://securetoken.google.com/a-different-project' }), 401],
    [await signIn({ auth_time: now() + 3600 }), 401],
    [await signIn({ sub: '' }), 401],
    [await signIn({ email_verified: false }), 403],
    [await signIn({ firebase: { sign_in_provider: 'password' } }), 403],
  ] as const) {
    assert.equal((await post('voiceover', token, { text: 'Hello' })).status, status);
  }
  assert.equal(redisCalls.length, previousCalls);
});

test('issues a scoped private upload, transcribes it and handles an already claimed upload', async () => {
  const token = await signIn();
  const grant = await post('transcription-upload', token, { size: 5_000_000, contentType: 'video/mp4' });
  assert.equal(grant.status, 200);
  const { url, uploadId } = await grant.json();
  assert.equal(new URL(url).searchParams.get('pathname'), `caption-transcription/${userKey}/${uploadId}`);
  assert.equal((await fetch(url, { method: 'PUT', body: 'sample' })).status, 200);
  const otherUser = await signIn({ sub: 'a-different-google-user' });
  assert.equal((await post('transcribe', otherUser, { uploadId })).status, 400);
  const transcription = await post('transcribe', token, { uploadId });
  assert.equal(transcription.status, 200);
  assert(providerCalls.includes(`POST ${blobUrl}/delete`));

  quotaResult = 'claimed';
  const upstreamCalls = providerCalls.filter(call => call.includes('api.deepgram.com')).length;
  try {
    assert.equal((await post('transcribe', token, { uploadId })).status, 409);
    const claim = redisCalls.at(-1);
    assert(claim);
    assert.equal(Number(claim[2]), 3);
    assert.match(String(claim[5]), new RegExp(`:claim:${userKey}:${uploadId}$`));
    assert(Number(claim[9]) > 86400);
    assert.equal(providerCalls.filter(call => call.includes('api.deepgram.com')).length, upstreamCalls);
  } finally {
    quotaResult = 'ok';
  }
});

test('fails closed on quota limits, unavailable Redis and missing credentials', async () => {
  const token = await signIn();
  const upstreamCalls = providerCalls.length;
  const postVoice = () => post('voiceover', token, { text: 'Hello' });
  quotaResult = 'limit';
  try {
    assert.equal((await postVoice()).status, 429);
    assert.equal((await post('transcription-upload', token, { size: 5_000_000, contentType: 'video/mp4' })).status, 429);
    quotaResult = 'unavailable';
    assert.equal((await postVoice()).status, 503);
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const attemptedReservations = redisCalls.length;
    assert.deepEqual(await (await fetch(`${baseUrl}/api/capabilities`)).json(), {
      quotaStorage: false, deepgram: false, inception: false, largeUploads: false,
    });
    assert.equal((await postVoice()).status, 503);
    assert.equal(redisCalls.length, attemptedReservations);
    assert.equal(providerCalls.length, upstreamCalls);

    process.env.KV_REST_API_URL = redisUrl;
    process.env.KV_REST_API_TOKEN = 'redis-write-test';
    quotaResult = 'ok';
    assert.equal((await postVoice()).status, 200);
  } finally {
    process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-write-test';
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    quotaResult = 'ok';
  }
});
