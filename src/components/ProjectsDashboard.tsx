import { useMemo, useState } from 'react';
import { FolderOpen, LogOut, Plus, Search, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CloudProject, CloudStylePreset } from '../lib/firestoreService';
import { formatSec, type AspectRatio } from '../utils/captions';

interface ProjectsDashboardProps {
  user: User | null;
  authLoading: boolean;
  projects: CloudProject[];
  projectsLoading: boolean;
  presets: CloudStylePreset[];
  activeProjectId: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onNewProject: () => void;
  onOpenProject: (project: CloudProject) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
}

const ASPECT_LABELS: Record<AspectRatio, string> = {
  r916: '9:16 Vertical',
  r11: '1:1 Square',
  r169: '16:9 Wide',
};

export function ProjectsDashboard({
  user,
  authLoading,
  projects,
  projectsLoading,
  presets,
  activeProjectId,
  onSignIn,
  onSignOut,
  onNewProject,
  onOpenProject,
  onDeleteProject,
}: ProjectsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [aspectFilter, setAspectFilter] = useState<'all' | AspectRatio>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (aspectFilter !== 'all' && p.aspectRatio !== aspectFilter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, searchQuery, aspectFilter]);

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Card className="p-4 sm:p-6 text-center">
          <CardHeader className="items-center">
            <CardTitle className="font-display text-2xl font-bold">
              Save and sync your caption projects
            </CardTitle>
            <CardDescription className="max-w-md mx-auto leading-relaxed">
              Sign up or sign in with Google via Firebase Authentication to save your caption timelines, aspect ratios, trim windows, and custom reference style presets in Cloud Firestore.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              size="lg"
              onClick={onSignIn}
              className="px-5 font-semibold cursor-pointer"
            >
              Sign in with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onNewProject}
              className="px-5 font-semibold cursor-pointer"
            >
              Continue in local Studio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display heading-editorial font-bold text-foreground">
            Your Caption Projects
          </h1>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Signed in as {user.displayName || user.email} · {projects.length}{' '}
            {projects.length === 1 ? 'project' : 'projects'} · {presets.length}{' '}
            {presets.length === 1 ? 'saved preset' : 'saved presets'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            size="lg"
            onClick={onNewProject}
            className="font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New project</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onSignOut}
            className="font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign out</span>
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Label htmlFor="project-search-input" className="sr-only">
            Search projects
          </Label>
          <Input
            id="project-search-input"
            type="search"
            placeholder="Search projects by title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>

        <Tabs
          value={aspectFilter}
          onValueChange={(val) => setAspectFilter(val as 'all' | AspectRatio)}
        >
          <TabsList>
            <TabsTrigger value="all" className="text-xs cursor-pointer">
              All
            </TabsTrigger>
            <TabsTrigger value="r916" className="text-xs cursor-pointer">
              9:16
            </TabsTrigger>
            <TabsTrigger value="r11" className="text-xs cursor-pointer">
              1:1
            </TabsTrigger>
            <TabsTrigger value="r169" className="text-xs cursor-pointer">
              16:9
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {projectsLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-16 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed text-center py-8">
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {projects.length === 0 ? 'No saved projects yet' : 'No projects match your filter'}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {projects.length === 0
                ? 'Open the Studio, add or generate captions, and click “Save Project” to persist your timeline in Firestore.'
                : 'Try clearing your search query or switching aspect ratio filters.'}
            </p>
            {projects.length === 0 && (
              <Button
                type="button"
                size="lg"
                onClick={onNewProject}
                className="font-semibold cursor-pointer"
              >
                Start first project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Project</TableHead>
                <TableHead className="px-4">Frame</TableHead>
                <TableHead className="px-4">Style</TableHead>
                <TableHead className="px-4 text-right">Cues</TableHead>
                <TableHead className="px-4 text-right">Trim span</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((proj) => {
                const isActive = proj.id === activeProjectId;
                return (
                  <TableRow key={proj.id}>
                    <TableCell className="px-4 py-3">
                      <div className="font-semibold text-foreground">
                        {proj.title}
                        {isActive && (
                          <span className="ml-2 text-xs font-normal text-primary">
                            · Open
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        Updated {new Date(proj.updatedAtMs).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 text-xs text-muted-foreground">
                      {ASPECT_LABELS[proj.aspectRatio]}
                    </TableCell>
                    <TableCell className="px-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-xs border border-border inline-block"
                          style={{ backgroundColor: proj.accentColor }}
                          aria-hidden="true"
                        />
                        <span>{proj.style.replace('st-', '')}</span>
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-right font-mono text-xs tabular-nums">
                      {proj.captionsCount}
                    </TableCell>
                    <TableCell className="px-4 text-right font-mono text-xs tabular-nums">
                      {formatSec(Math.max(0, proj.trimEnd - proj.trimStart))}
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => onOpenProject(proj)}
                          className="cursor-pointer font-semibold"
                        >
                          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Open</span>
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          disabled={deletingId === proj.id}
                          aria-label={`Delete project ${proj.title}`}
                          onClick={async () => {
                            setDeletingId(proj.id);
                            try {
                              await onDeleteProject(proj.id);
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          className="cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
