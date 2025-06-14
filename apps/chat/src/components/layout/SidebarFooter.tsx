import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
} from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { SignIn } from '../../features/auth/components/SignInButton';
import { api } from '../../../convex/_generated/api';
import { User, LogOut, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu';

export function SidebarFooter() {
  const data = useQuery(api.user.currentUser);
  const { signOut } = useAuthActions();

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <div className="bg-sidebar-background">
      <div className="p-3 flex">
        <Authenticated>
          {data ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full hover:bg-sidebar-accent rounded-md p-2 transition-colors">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                    {data.image ? (
                      <Image
                        src={data.image}
                        alt={data.name || 'User'}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-sidebar-foreground/60" />
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-sidebar-foreground truncate">
                      {data.name || 'User'}
                    </div>
                    <div className="text-xs text-sidebar-foreground/60 truncate">
                      {data.email}
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronUp className="w-4 h-4 text-sidebar-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled>
                  <User className="w-4 h-4 mr-2" />
                  {data.name || 'User'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent/50"></div>
              <div className="flex-1 min-w-0">
                <div className="h-3 bg-sidebar-accent/50 rounded mb-1"></div>
                <div className="h-2 bg-sidebar-accent/30 rounded w-3/4"></div>
              </div>
            </div>
          )}
        </Authenticated>

        <Unauthenticated>
          <SignIn />
        </Unauthenticated>

        <AuthLoading>
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent/50"></div>
            <div className="flex-1 min-w-0">
              <div className="h-3 bg-sidebar-accent/50 rounded mb-1"></div>
              <div className="h-2 bg-sidebar-accent/30 rounded w-3/4"></div>
            </div>
          </div>
        </AuthLoading>
      </div>
    </div>
  );
}
