import { useAuth } from '../auth/AuthContext';

/** Where the person's records are kept, in plain words, for the notes shown on each page. */
export function useStorageNote(): string {
  const auth = useAuth();
  return auth.user ? 'saved to your account' : 'saved on this device until you sign in';
}
