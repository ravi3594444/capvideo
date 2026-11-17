import type { User } from 'firebase/auth';
import { auth } from './firebase';

export async function aiHeaders(signIn?: () => Promise<User | null>) {
  const user = auth.currentUser ?? await signIn?.();
  if (!user) throw new Error('Sign in with Google to use AI tools.');
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}
