import { Button } from '@/ui/components/ui/button';
import { useAuthActions } from '@convex-dev/auth/react';

export function SignIn() {
  const { signIn } = useAuthActions();
  return (
    <Button
      className="flex-1 my-auto"
      variant="outline"
      type="button"
      onClick={() => void signIn('google')}
    >
      Sign in with Google
    </Button>
  );
}
