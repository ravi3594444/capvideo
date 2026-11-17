import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';

export type AppView = 'studio' | 'projects' | 'deploy' | 'guide';

interface TopNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  user: User | null;
  authLoading: boolean;
  savingProject: boolean;
  onPrimaryAction: () => void;
}

export function TopNav({
  activeView,
  onNavigate,
  user,
  authLoading,
  savingProject,
  onPrimaryAction,
}: TopNavProps) {
  const navItems: { id: AppView; label: string }[] = [
    { id: 'studio', label: 'Studio' },
    { id: 'projects', label: 'Projects' },
    { id: 'deploy', label: 'Deploy Guide' },
    { id: 'guide', label: 'How It Works' },
  ];

  const primaryLabel = authLoading
    ? 'Checking…'
    : user
      ? savingProject
        ? 'Saving…'
        : 'Save Project'
      : 'Sign in with Google';

  return (
    <header className="md:sticky md:top-0 z-30 border-b border-border/70 bg-card/80 backdrop-blur-xl">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('studio');
          }}
          className="font-display text-lg font-extrabold tracking-tight text-foreground whitespace-nowrap shrink-0"
        >
          Caption <span className="text-muted-foreground font-semibold">Lite</span>
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                aria-current={active ? 'page' : undefined}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  active
                    ? 'border-primary text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <Button
            type="button"
            size="sm"
            disabled={authLoading || savingProject}
            onClick={onPrimaryAction}
            className="px-3.5 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {primaryLabel}
          </Button>
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden border-t border-border/60 px-3 py-1 items-center justify-between gap-1 text-xs font-medium overflow-x-auto"
      >
        {navItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`min-h-[34px] px-2.5 rounded-md whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                active
                  ? 'text-foreground font-semibold bg-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
