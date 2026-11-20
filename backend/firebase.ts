import { createHash } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const projectId = firebaseConfig.projectId;
const googleKeys = createRemoteJWKSet(new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
));

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

  try {
    const { payload } = await jwtVerify(token, (header, jws) => {
      if (typeof header.kid !== 'string' || !header.kid) {
        throw new errors.JWSInvalid('Firebase ID token is missing its signing key ID');
      }
      return googleKeys(header, jws);
    }, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      requiredClaims: ['exp', 'iat', 'auth_time', 'sub'],
    });

    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
        typeof payload.iat !== 'number' || !Number.isSafeInteger(payload.iat) || payload.iat > now ||
        typeof payload.auth_time !== 'number' || !Number.isSafeInteger(payload.auth_time) || payload.auth_time > now ||
        !Number.isSafeInteger(payload.exp)) {
      throw new errors.JWTInvalid('Invalid Firebase ID token claims');
    }

    const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined;
    if (payload.email_verified !== true || firebase?.sign_in_provider !== 'google.com') {
      res.status(403).json({ error: 'Use a verified Google account to access AI tools.' });
      return;
    }
    res.locals.uid = payload.sub;
  } catch (error) {
    if (error instanceof errors.JWSInvalid || error instanceof errors.JWTInvalid ||
        error instanceof errors.JWTClaimValidationFailed || error instanceof errors.JWTExpired ||
        error instanceof errors.JOSEAlgNotAllowed || error instanceof errors.JWSSignatureVerificationFailed ||
        error instanceof errors.JWKSNoMatchingKey || error instanceof errors.JOSENotSupported) {
      res.status(401).json({ error: 'Your sign-in is invalid or expired. Sign in again and retry.' });
    } else {
      res.status(503).json({ error: 'AI sign-in is unavailable. Try again later.' });
    }
    return;
  }
  next();
};
