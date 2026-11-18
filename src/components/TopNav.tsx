import { Button } from '@astryxdesign/core/Button';
import { Captions, CloudUpload, LogIn } from 'lucide-react';
import type { User } from 'firebase/auth';

import { VIEW_HREFS, type SeoViewId as AppView } from '../utils/seo';
export { VIEW_HREFS, type SeoViewId as AppView } from '../utils/seo';

interface TopNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  user: User | null;
  authLoading: boolean;
  savingProject: boolean;
  onPrimaryAction: () => void;
}

const navItems = [
  { id: 'gallery', label: 'Gallery' },
  { id: 'studio', label: 'Workspace' },
  { id: 'projects', label: 'Projects' },
  { id: 'guide', label: 'Help' },
] as const;

export function TopNav({ activeView, onNavigate, user, authLoading, savingProject, onPrimaryAction }: TopNavProps) {
  const saveProject = Boolean(user) && activeView === 'studio';

  return (
    <header className={`workspace-nav glassy-chrome${activeView === 'studio' ? ' workspace-nav-editor' : ''}`}>
      <div className="workspace-nav-inner">
        <a href="/" className="workspace-brand" onClick={(event) => {
          event.preventDefault();
          onNavigate('landing');
        }}>
          <span className="workspace-brand-mark"><Captions size={19} aria-hidden="true" /></span>
          <span>Caption Lite</span>
        </a>
        <nav aria-label="Main navigation" className="workspace-nav-links">
          {navItems.filter(({ id }) => activeView !== 'landing' || id !== 'studio').map(({ id, label }) => (
            <a key={id} href={VIEW_HREFS[id]} aria-current={activeView === id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(id);
              }}>
              {label}
            </a>
          ))}
        </nav>
        <div className="workspace-nav-action">
          {user && !saveProject ? (
            <Button size="md" variant="secondary" label="My account" onClick={() => onNavigate('projects')} />
          ) : (
            <Button
              size="md"
              variant="secondary"
              label={authLoading ? 'Checking sign-in…' : saveProject ? 'Save project' : 'Sign in with Google'}
              icon={saveProject ? <CloudUpload size={16} /> : <LogIn size={16} />}
              isLoading={savingProject}
              isDisabled={authLoading}
              onClick={onPrimaryAction}
            />
          )}
        </div>
      </div>
    </header>
  );
}
