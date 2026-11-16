import { type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AspectRatio, CaptionCue, CaptionFont, CaptionPosition, CaptionStyle } from '../utils/captions';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  clampFontSize,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  sanitizeCaptionText,
  sanitizeHexColor,
  sanitizePresetName,
  sanitizeTitle,
} from './validation';

export interface CloudProject {
  id: string;
  ownerId: string;
  title: string;
  aspectRatio: AspectRatio;
  duration: number;
  trimStart: number;
  trimEnd: number;
  language: string;
  style: CaptionStyle;
  fontFamily: CaptionFont;
  position: CaptionPosition;
  accentColor: string;
  fontSize: number;
  audioCleanEnabled: boolean;
  captionsCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CloudStylePreset {
  id: string;
  ownerId: string;
  name: string;
  style: CaptionStyle;
  fontFamily: CaptionFont;
  position: CaptionPosition;
  accentColor: string;
  fontSize: number;
  updatedAtMs: number;
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export async function upsertUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const email = (user.email || 'creator@example.com').slice(0, MAX_EMAIL_LENGTH);
  const displayName = (user.displayName || email.split('@')[0] || 'Creator')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
  const photoURL = (user.photoURL || '').slice(0, 500);

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email,
        displayName,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email,
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProjects(
  uid: string,
  onData: (projects: CloudProject[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'projects';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CloudProject[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || uid),
          title: String(data.title || 'Untitled Clip'),
          aspectRatio: (data.aspectRatio as AspectRatio) || 'r916',
          duration: Number(data.duration) || 0,
          trimStart: Number(data.trimStart) || 0,
          trimEnd: Number(data.trimEnd) || 0,
          language: String(data.language || 'en-US'),
          style: (data.style as CaptionStyle) || 'st-highlight',
          fontFamily: (data.fontFamily as CaptionFont) || 'manrope',
          position: (data.position as CaptionPosition) || 'pos-bottom',
          accentColor: String(data.accentColor || '#ffd60a'),
          fontSize: Number(data.fontSize) || 22,
          audioCleanEnabled: Boolean(data.audioCleanEnabled),
          captionsCount: Number(data.captionsCount) || 0,
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function loadProjectCaptions(projectId: string, uid: string): Promise<CaptionCue[]> {
  const path = `projects/${projectId}/captions`;
  try {
    const q = query(collection(db, 'projects', projectId, 'captions'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        start: Number(data.start) || 0,
        end: Number(data.end) || 0.5,
        text: String(data.text || ''),
        orderIndex: Number(data.orderIndex) || 0,
      };
    });
    items.sort((a, b) => a.start - b.start || a.orderIndex - b.orderIndex);
    return items.map(({ id, start, end, text }) => ({ id, start, end, text }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveProjectToFirestore(
  uid: string,
  input: {
    id?: string;
    title: string;
    aspectRatio: AspectRatio;
    duration: number;
    trimStart: number;
    trimEnd: number;
    language: string;
    style: CaptionStyle;
    fontFamily?: CaptionFont;
    position: CaptionPosition;
    accentColor: string;
    fontSize: number;
    audioCleanEnabled: boolean;
  },
  captions: CaptionCue[]
): Promise<string> {
  const projectId = input.id && /^[a-zA-Z0-9_-]{1,128}$/.test(input.id)
    ? input.id
    : generateSafeId('proj');
  const projectPath = `projects/${projectId}`;
  const projectRef = doc(db, 'projects', projectId);

  const safeDuration = Math.max(0, Math.min(7200, Number(input.duration) || 0));
  const safeTrimStart = Math.max(0, Math.min(safeDuration, Number(input.trimStart) || 0));
  const safeTrimEnd = Math.max(safeTrimStart, Math.min(safeDuration, Number(input.trimEnd) || safeDuration));
  const safeCaptions = captions.slice(0, 450);

  const payloadBase = {
    id: projectId,
    ownerId: uid,
    title: sanitizeTitle(input.title),
    aspectRatio: input.aspectRatio,
    duration: safeDuration,
    trimStart: safeTrimStart,
    trimEnd: safeTrimEnd,
    language: (input.language || 'en-US').slice(0, 32),
    style: input.style,
    fontFamily: input.fontFamily || 'manrope',
    position: input.position,
    accentColor: sanitizeHexColor(input.accentColor),
    fontSize: clampFontSize(input.fontSize),
    audioCleanEnabled: Boolean(input.audioCleanEnabled),
    captionsCount: safeCaptions.length,
  };

  try {
    const existing = await getDoc(projectRef);
    if (!existing.exists()) {
      await setDoc(projectRef, {
        ...payloadBase,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(projectRef, {
        title: payloadBase.title,
        aspectRatio: payloadBase.aspectRatio,
        duration: payloadBase.duration,
        trimStart: payloadBase.trimStart,
        trimEnd: payloadBase.trimEnd,
        language: payloadBase.language,
        style: payloadBase.style,
        fontFamily: payloadBase.fontFamily,
        position: payloadBase.position,
        accentColor: payloadBase.accentColor,
        fontSize: payloadBase.fontSize,
        audioCleanEnabled: payloadBase.audioCleanEnabled,
        captionsCount: payloadBase.captionsCount,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, projectPath);
  }

  const captionsPath = `projects/${projectId}/captions`;
  try {
    const existingCapsSnap = await getDocs(
      query(collection(db, 'projects', projectId, 'captions'), where('ownerId', '==', uid))
    );
    const existingMap = new Map<string, boolean>();
    existingCapsSnap.docs.forEach((d) => existingMap.set(d.id, true));

    const nextIds = new Set<string>();
    const batch = writeBatch(db);

    safeCaptions.forEach((cue, idx) => {
      const cueId = /^[a-zA-Z0-9_-]{1,128}$/.test(cue.id) ? cue.id : generateSafeId(`cap_${idx}`);
      nextIds.add(cueId);
      const cueRef = doc(db, 'projects', projectId, 'captions', cueId);
      const safeStart = Math.max(0, Math.min(7200, Number(cue.start) || 0));
      const safeEnd = Math.max(safeStart, Math.min(7200, Number(cue.end) || safeStart + 0.5));
      const safeText = sanitizeCaptionText(cue.text);

      if (existingMap.has(cueId)) {
        batch.update(cueRef, {
          start: safeStart,
          end: safeEnd,
          text: safeText,
          orderIndex: idx,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(cueRef, {
          id: cueId,
          projectId,
          ownerId: uid,
          start: safeStart,
          end: safeEnd,
          text: safeText,
          orderIndex: idx,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    existingCapsSnap.docs.forEach((d) => {
      if (!nextIds.has(d.id)) {
        batch.delete(d.ref);
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, captionsPath);
  }

  return projectId;
}

export async function deleteProjectFromFirestore(projectId: string, uid: string): Promise<void> {
  const projectPath = `projects/${projectId}`;
  try {
    const capsSnap = await getDocs(
      query(collection(db, 'projects', projectId, 'captions'), where('ownerId', '==', uid))
    );
    if (!capsSnap.empty) {
      const batch = writeBatch(db);
      capsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, projectPath);
  }
}

export function subscribeUserPresets(
  uid: string,
  onData: (presets: CloudStylePreset[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/presets`;
  const q = query(collection(db, 'users', uid, 'presets'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CloudStylePreset[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || uid),
          name: String(data.name || 'Custom Style'),
          style: (data.style as CaptionStyle) || 'st-highlight',
          fontFamily: (data.fontFamily as CaptionFont) || 'manrope',
          position: (data.position as CaptionPosition) || 'pos-bottom',
          accentColor: String(data.accentColor || '#ffd60a'),
          fontSize: Number(data.fontSize) || 22,
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function saveStylePresetToFirestore(
  uid: string,
  input: {
    name: string;
    style: CaptionStyle;
    fontFamily?: CaptionFont;
    position: CaptionPosition;
    accentColor: string;
    fontSize: number;
  }
): Promise<void> {
  const presetId = generateSafeId('preset');
  const path = `users/${uid}/presets/${presetId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'presets', presetId), {
      id: presetId,
      ownerId: uid,
      name: sanitizePresetName(input.name),
      style: input.style,
      fontFamily: input.fontFamily || 'manrope',
      position: input.position,
      accentColor: sanitizeHexColor(input.accentColor),
      fontSize: clampFontSize(input.fontSize),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteStylePresetFromFirestore(uid: string, presetId: string): Promise<void> {
  const path = `users/${uid}/presets/${presetId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'presets', presetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
