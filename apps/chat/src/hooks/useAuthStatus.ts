import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useAuthStatus() {
  // undefined while loading, null if not signed in, user doc otherwise
  const user = useQuery(api.user.currentUser);
  return {
    isLoaded: user !== undefined,
    isSignedIn: !!user,
  } as const;
}
