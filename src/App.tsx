import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button as AstryxButton } from '@astryxdesign/core/Button';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';
import {
  AlertCircle,
  ArrowLeft,
  Captions,
  Download,
  Film,
  Palette,
  Pause,
  Play,
  Pipette,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TopNav, VIEW_HREFS, type AppView } from './components/TopNav';
import { StudioGallery } from './components/StudioGallery';
import { VideoStage } from './components/VideoStage';
import { StudioTimelineBar } from './components/StudioTimelineBar';
import { CaptionsPanel, type ServerCapabilities } from './components/CaptionsPanel';
import { StylePanel } from './components/StylePanel';
import { ReferenceMatchPanel } from './components/ReferenceMatchPanel';
import { AIRefinePanel } from './components/AIRefinePanel';
import { ExportPanel } from './components/ExportPanel';
import { ProjectsDashboard } from './components/ProjectsDashboard';
import { DeployGuideView } from './components/DeployGuideView';
import { HowItWorksView } from './components/HowItWorksView';
import {
  clampWordSpacing,
  commitCaptionHistory,
  createCaptionHistory,
  DEFAULT_STYLE_CONFIG,
  findStylePreviewCaption,
  parseSrt,
  redoCaptionHistory,
  toggleCueKeyWord,
  undoCaptionHistory,
  type AspectRatio,
  type CaptionCue,
  type CaptionHistoryState,
  type StyleConfig,
} from './utils/captions';
import { loadLocalDraft, loadRecentDrafts, saveLocalDraft, saveRecentDrafts, type StudioDraft } from './utils/draftStorage';
import { applyDocumentSeo, resolveView } from './utils/seo';
import {
  createAudioCleanGraph,
  type AudioGraphHandle,
  type NoiseCleanStrength,
} from './utils/audioEngine';
import { generateSampleCreatorClip } from './utils/sampleClip';
import { useIsCompactLayout } from './hooks/useMediaQuery';
import {
  deleteProjectFromFirestore,
  deleteStylePresetFromFirestore,
  loadProjectCaptions,
  saveProjectToFirestore,
  saveStylePresetToFirestore,
  subscribeUserPresets,
  subscribeUserProjects,
  type CloudProject,
  type CloudStylePreset,
} from './lib/firestoreService';

type InspectorTab = 'captions' | 'style' | 'reference' | 'ai' | 'export';

const INSPECTOR_TABS = [
  { id: 'captions', label: 'Captions', Icon: Captions },
  { id: 'style', label: 'Style', Icon: Palette },
  { id: 'reference', label: 'Reference', Icon: Pipette },
  { id: 'ai', label: 'AI tools', Icon: Sparkles },
  { id: 'export', label: 'Export', Icon: Download },
] as const satisfies ReadonlyArray<{ id: InspectorTab; label: string; Icon: LucideIcon }>;

function getInitialView(): AppView {
  if (typeof window === 'undefined') return 'landing';
  return resolveView(window.location.pathname, window.location.hash) ?? 'landing';
}

function InspectorPanel({ tab, activeTab, children }: { tab: InspectorTab; activeTab: InspectorTab; children: ReactNode }) {
  const active = tab === activeTab;
  return (
    <section
      role="region"
      id={`inspector-panel-${tab}`}
      aria-labelledby={active ? 'workspace-inspector-title' : undefined}
      hidden={!active}
      tabIndex={active ? 0 : -1}
      className="workspace-panel"
    >
      {active && children}
    </section>
  );
}

function StudioApp() {
  const { user, loading: authLoading, authError, signInWithGoogle, signOutUser, clearAuthError } =
    useAuth();

  const [initialDraft] = useState(loadLocalDraft);

  const [activeView, setActiveView] = useState<AppView>(() => getInitialView());
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('captions');
  const [mobilePane, setMobilePane] = useState<'preview' | 'edit'>('preview');
  const [activeLocalId, setActiveLocalId] = useState(() => initialDraft?.id || crypto.randomUUID());
  const [recentDrafts, setRecentDrafts] = useState(loadRecentDrafts);
  const projectSwitchVersion = useRef(0);
  const isCompact = useIsCompactLayout();
  const videoPickerRef = useRef<HTMLInputElement | null>(null);

  const navigate = (view: AppView) => {
    const href = VIEW_HREFS[view];
    if (view === 'landing') {
      window.location.assign(href);
      return;
    }
    if (window.location.pathname + window.location.hash !== href) {
      window.history.pushState(null, '', href);
    }
    if (activeView === 'studio' && view !== 'studio') {
      videoRef.current?.pause();
      audioGraphRef.current?.dispose();
      audioGraphRef.current = null;
      voiceAudioRef.current?.pause();
      setIsPlaying(false);
      setImproveAudio(false);
    }
    setActiveView(view);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const syncView = () => setActiveView(getInitialView());
    window.addEventListener('popstate', syncView);
    return () => window.removeEventListener('popstate', syncView);
  }, []);

  // Project & local-draft state
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState(
    () => initialDraft?.projectTitle ?? 'Untitled Reel'
  );
  const [aspect, setAspect] = useState<AspectRatio>(() => initialDraft?.aspect ?? 'r916');
  const [language, setLanguage] = useState(() => initialDraft?.language ?? 'en-US');
  const [loopClip, setLoopClip] = useState(() => initialDraft?.loopClip ?? false);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>(
    () => initialDraft?.styleConfig ?? DEFAULT_STYLE_CONFIG
  );
  const [previewStyleState, setPreviewStyleState] = useState<{
    config: StyleConfig;
    label: string;
  } | null>(null);
  const [captionHistory, setCaptionHistory] = useState<CaptionHistoryState>(() =>
    createCaptionHistory(initialDraft?.captions ?? [])
  );

  const stageStyleConfig = previewStyleState?.config ?? styleConfig;

  const captions = captionHistory.present;
  const canUndo = captionHistory.past.length > 0;
  const canRedo = captionHistory.future.length > 0;

  const updateCaptions = useCallback((next: CaptionCue[]) => {
    setCaptionHistory((prev) => commitCaptionHistory(prev, next));
  }, []);

  const resetCaptionHistory = useCallback((next: CaptionCue[]) => {
    setCaptionHistory(createCaptionHistory(next));
  }, []);

  const handleUndo = useCallback(() => {
    setCaptionHistory((prev) => undoCaptionHistory(prev));
  }, []);

  const handleRedo = useCallback(() => {
    setCaptionHistory((prev) => redoCaptionHistory(prev));
  }, []);

  // Video & playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loadedMediaUrl = useRef<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState('No video yet');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const stylePreviewCue = inspectorTab === 'style' ? findStylePreviewCaption(captions, currentTime) : null;
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [editingCue, setEditingCue] = useState<CaptionCue | null>(null);

  // Web Audio noise removal & AI Voiceover state
  const audioGraphRef = useRef<AudioGraphHandle | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [improveAudio, setImproveAudio] = useState(false);
  const [noiseStrength, setNoiseStrength] = useState<NoiseCleanStrength>('clean');
  const [audioMeterPct, setAudioMeterPct] = useState(0);
  const [audioStatus, setAudioStatus] = useState(
    'Off · Hearing original audio. Toggle on to remove background noise.'
  );
  const [voiceoverBlob, setVoiceoverBlob] = useState<Blob | null>(null);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false);
  const [replaceOriginalAudio, setReplaceOriginalAudio] = useState(true);

  // Cloud Firestore state
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [cloudPresets, setCloudPresets] = useState<CloudStylePreset[]>([]);
  const [savingProject, setSavingProject] = useState(false);
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);

  useEffect(() => {
    applyDocumentSeo(activeView);
  }, [activeView]);

  // Persist local studio draft cleanly (debounced 250ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveLocalDraft({
        id: activeLocalId,
        projectTitle,
        aspect,
        language,
        loopClip,
        styleConfig,
        captions,
        updatedAt: Date.now(),
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeLocalId, projectTitle, aspect, language, loopClip, styleConfig, captions]);

  useEffect(() => {
    fetch('/api/capabilities')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setCapabilities({
            quotaStorage: Boolean(data.quotaStorage),
            deepgram: Boolean(data.deepgram),
            inception: Boolean(data.inception),
            largeUploads: Boolean(data.largeUploads),
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setCloudProjects([]);
      setCloudPresets([]);
      return;
    }
    setProjectsLoading(true);
    const unsubProjects = subscribeUserProjects(
      user.uid,
      (list) => {
        setCloudProjects(list);
        setProjectsLoading(false);
      },
      (err) => {
        setProjectsLoading(false);
        toast.error(`Firestore read error: ${err.message}`);
      }
    );
    const unsubPresets = subscribeUserPresets(user.uid, (list) => {
      setCloudPresets(list);
    });
    return () => {
      unsubProjects();
      unsubPresets();
    };
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!improveAudio || !audioGraphRef.current || !videoRef.current || videoRef.current.paused) {
        setAudioMeterPct(0);
        return;
      }
      setAudioMeterPct(audioGraphRef.current.sampleRmsPercent());
    }, 90);
    return () => window.clearInterval(timer);
  }, [improveAudio]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = Boolean(voiceoverEnabled && voiceoverUrl && replaceOriginalAudio);
  }, [voiceoverEnabled, voiceoverUrl, replaceOriginalAudio]);

  useEffect(() => {
    return () => {
      audioGraphRef.current?.dispose();
    };
  }, []);

  // Keyboard shortcuts: Space (play/pause), ArrowLeft/Right (±1s), Ctrl/Cmd+Z (Undo/Redo)
  useEffect(() => {
    if (activeView !== 'studio') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditingInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isEditingInput) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !isEditingInput) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isEditingInput || target?.closest('button, [role="button"], a, summary, [role="slider"]')) return;

      const vid = videoRef.current;
      if (!vid || !videoUrl) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (vid.paused) {
          void vid.play().then(() => setIsPlaying(true));
        } else {
          vid.pause();
          setIsPlaying(false);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const next = Math.max(trimStart, vid.currentTime - 1);
        vid.currentTime = next;
        setCurrentTime(next);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(trimEnd || duration, vid.currentTime + 1);
        vid.currentTime = next;
        setCurrentTime(next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, videoUrl, trimStart, trimEnd, duration, handleUndo, handleRedo]);

  const handleFileSelected = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(nextUrl);
    setFileInfo(`${file.name} · ${(file.size / 1048576).toFixed(1)} MB`);
    if (projectTitle === 'Untitled Reel') {
      setProjectTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Untitled Reel');
    }
    toast.success(`Loaded “${file.name}”.`);
  };

  const handleInspectorTabChange = (tab: InspectorTab) => {
    setPreviewStyleState(null);
    setInspectorTab(tab);
    setMobilePane('edit');
    if (isCompact) window.scrollTo(0, 0);
  };

  const openMobilePreview = () => {
    setMobilePane('preview');
    window.scrollTo(0, 0);
  };

  const handleSrtFileDropped = async (file: File) => {
    const text = await file.text();
    const parsed = parseSrt(text, trimStart);
    if (!parsed.length) {
      toast.error(`Could not find valid subtitle cues in “${file.name}”.`);
      return;
    }
    updateCaptions(parsed);
    setInspectorTab('captions');
    toast.success(`Imported ${parsed.length} captions from “${file.name}”.`);
  };

  const handleLoadSampleClip = async () => {
    setLoadingSample(true);
    try {
      const sampleFile = await generateSampleCreatorClip();
      handleFileSelected(sampleFile);
      setProjectTitle('Creator Demo Reel');
      updateCaptions([
        { id: 'sample_1', start: 0.0, end: 0.7, text: 'Stop scrolling right now' },
        { id: 'sample_2', start: 0.7, end: 1.3, text: 'Dynamic captions on your clip' },
        { id: 'sample_3', start: 1.3, end: 2.0, text: 'Tap any word to fix spelling' },
      ]);
      toast.success('Sample clip loaded. Press Play to watch word-by-word animation.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate sample clip.');
    } finally {
      setLoadingSample(false);
    }
  };

  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = Boolean(voiceoverEnabled && voiceoverUrl && replaceOriginalAudio);
    if (videoUrl && loadedMediaUrl.current === videoUrl) {
      vid.currentTime = Math.min(Math.max(currentTime, trimStart), trimEnd || duration);
      return;
    }
    loadedMediaUrl.current = videoUrl;
    const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 2.1;
    setDuration(dur);
    setTrimStart(0);
    setTrimEnd(dur);
    setCurrentTime(0);
  };

  const handleTogglePlay = async () => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) return;
    if (audioGraphRef.current) {
      await audioGraphRef.current.resumeIfNeeded();
    }
    const va = voiceAudioRef.current;
    if (vid.paused) {
      if (vid.currentTime < trimStart || vid.currentTime >= trimEnd - 0.05) {
        vid.currentTime = trimStart;
      }
      await vid.play();
      if (va && voiceoverEnabled && voiceoverUrl) {
        va.currentTime = Math.max(0, vid.currentTime - trimStart);
        void va.play().catch(() => {});
      }
      setIsPlaying(true);
    } else {
      vid.pause();
      if (va && !va.paused) va.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setCurrentTime(vid.currentTime);
    if (trimEnd > 0 && vid.currentTime >= trimEnd && !vid.paused) {
      const va = voiceAudioRef.current;
      if (loopClip) {
        vid.currentTime = trimStart;
        setCurrentTime(trimStart);
        if (va && voiceoverEnabled && voiceoverUrl) {
          va.currentTime = 0;
          void va.play().catch(() => {});
        }
      } else {
        vid.pause();
        if (va && !va.paused) va.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleEnded = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const va = voiceAudioRef.current;
    if (loopClip) {
      vid.currentTime = trimStart;
      setCurrentTime(trimStart);
      if (va && voiceoverEnabled && voiceoverUrl) {
        va.currentTime = 0;
        void va.play().catch(() => {});
      }
      void vid.play().then(() => setIsPlaying(true));
    } else {
      if (va && !va.paused) va.pause();
      setIsPlaying(false);
    }
  };

  const handleTrimChange = (which: 'start' | 'end', val: number) => {
    const clamped = Math.max(0, Math.min(duration, val));
    if (which === 'start') {
      setTrimStart(Math.min(clamped, Math.max(0, trimEnd - 0.2)));
    } else {
      setTrimEnd(Math.max(clamped, Math.min(duration, trimStart + 0.2)));
    }
  };

  const handleToggleImproveAudio = async () => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) {
      setAudioStatus('Load a video first, then turn on background noise removal.');
      return;
    }
    if (!audioGraphRef.current) {
      audioGraphRef.current = createAudioCleanGraph(vid);
    }
    if (!audioGraphRef.current) {
      setAudioStatus('Web Audio API is unavailable in this browser. Original audio will be used.');
      return;
    }
    const next = !improveAudio;
    await audioGraphRef.current.resumeIfNeeded();
    audioGraphRef.current.setImproveEnabled(next, noiseStrength);
    setImproveAudio(next);
    setAudioStatus(
      next
        ? `On (${noiseStrength === 'strong' ? 'Strong isolate' : 'Natural clean'}) · Rumble cut, hiss low-pass, vocal presence & gate active for preview and export.`
        : 'Off · Hearing original audio. Toggle on to remove background noise.'
    );
  };

  const handleNoiseStrengthChange = (strength: NoiseCleanStrength) => {
    setNoiseStrength(strength);
    if (improveAudio && audioGraphRef.current) {
      audioGraphRef.current.setImproveEnabled(true, strength);
      setAudioStatus(
        `On (${strength === 'strong' ? 'Strong isolate' : 'Natural clean'}) · Rumble cut, hiss low-pass, vocal presence & gate active for preview and export.`
      );
    }
  };

  const handleVoiceoverGenerated = (blob: Blob) => {
    if (voiceoverUrl) URL.revokeObjectURL(voiceoverUrl);
    const url = URL.createObjectURL(blob);
    setVoiceoverBlob(blob);
    setVoiceoverUrl(url);
    setVoiceoverEnabled(true);
    toast.success('Deepgram AI voiceover ready and synced to preview & export.');
  };

  const handleSeekTo = (time: number, autoPlay = false) => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) {
      if (!autoPlay) setCurrentTime(time);
      return;
    }
    vid.currentTime = time;
    setCurrentTime(time);
    const va = voiceAudioRef.current;
    if (va && voiceoverEnabled && voiceoverUrl) {
      va.currentTime = Math.max(0, time - trimStart);
      if (autoPlay) void va.play().catch(() => {});
    }
    if (autoPlay) {
      void vid.play().then(() => setIsPlaying(true));
    }
  };

  const handleSaveProject = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setSavingProject(true);
    try {
      const savedId = await saveProjectToFirestore(
        user.uid,
        {
          id: activeProjectId || undefined,
          title: projectTitle,
          aspectRatio: aspect,
          duration,
          trimStart,
          trimEnd,
          language,
          style: styleConfig.style,
          fontFamily: styleConfig.fontFamily,
          position: styleConfig.position,
          accentColor: styleConfig.accentColor,
          fontSize: styleConfig.fontSize,
          wordSpacing: clampWordSpacing(styleConfig.wordSpacing),
          revealMode: styleConfig.revealMode,
          effect: styleConfig.effect,
          wordsPerPage: styleConfig.wordsPerPage,
          pageLayout: styleConfig.pageLayout,
          spotlightAuto: styleConfig.spotlightAuto,
          blendMode: styleConfig.blendMode,
          audioCleanEnabled: improveAudio,
        },
        captions
      );
      setActiveProjectId(savedId);
      toast.success(`Saved “${projectTitle}” (${captions.length} captions) to Firestore.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save project.');
    } finally {
      setSavingProject(false);
    }
  };

  const currentDraft: StudioDraft | null = videoFile || captions.length ||
      projectTitle !== 'Untitled Reel' || aspect !== 'r916' || styleConfig.style !== DEFAULT_STYLE_CONFIG.style
    ? { id: activeLocalId, projectTitle, aspect, language, loopClip, styleConfig, captions, updatedAt: Date.now() }
    : null;

  const archiveCurrentDraft = () => {
    if (!currentDraft) return;
    const next = [currentDraft, ...recentDrafts.filter((draft) => draft.id !== activeLocalId)];
    saveRecentDrafts(next);
    setRecentDrafts(next);
  };

  const resetProjectMedia = () => {
    videoRef.current?.pause();
    voiceAudioRef.current?.pause();
    audioGraphRef.current?.dispose();
    audioGraphRef.current = null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (voiceoverUrl) URL.revokeObjectURL(voiceoverUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setFileInfo('No video yet');
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setImproveAudio(false);
    setVoiceoverBlob(null);
    setVoiceoverUrl(null);
    setVoiceoverEnabled(false);
    setReplaceOriginalAudio(true);
    setNoiseStrength('clean');
    setAudioStatus('Off · Hearing original audio.');
    setEditingCue(null);
    setPreviewStyleState(null);
    setInspectorTab('captions');
    setMobilePane('preview');
  };

  const openLocalProject = (draft: StudioDraft) => {
    ++projectSwitchVersion.current;
    if (draft.id === activeLocalId) {
      openMobilePreview();
      navigate('studio');
      return;
    }

    archiveCurrentDraft();
    resetProjectMedia();
    setActiveProjectId(null);
    setActiveLocalId(draft.id || crypto.randomUUID());
    setProjectTitle(draft.projectTitle);
    setAspect(draft.aspect);
    setLanguage(draft.language);
    setLoopClip(draft.loopClip);
    setStyleConfig(draft.styleConfig);
    resetCaptionHistory(draft.captions);
    navigate('studio');
  };

  const startProject = (title = 'Untitled Reel', style = DEFAULT_STYLE_CONFIG) => {
    openLocalProject({
      id: crypto.randomUUID(),
      projectTitle: title,
      aspect: 'r916',
      language: 'en-US',
      loopClip: false,
      styleConfig: style,
      captions: [],
      updatedAt: Date.now(),
    });
  };

  const handleOpenCloudProject = async (proj: CloudProject) => {
    if (!user) return;
    const version = ++projectSwitchVersion.current;
    try {
      const loadedCues = await loadProjectCaptions(proj.id, user.uid);
      if (projectSwitchVersion.current !== version) return;
      archiveCurrentDraft();
      resetProjectMedia();
      setActiveLocalId(crypto.randomUUID());
      setActiveProjectId(proj.id);
      setLoopClip(false);
      setProjectTitle(proj.title);
      setAspect(proj.aspectRatio);
      setLanguage(proj.language);
      setStyleConfig({
        style: proj.style,
        fontFamily: proj.fontFamily || 'manrope',
        position: proj.position,
        accentColor: proj.accentColor,
        fontSize: proj.fontSize,
        wordSpacing: clampWordSpacing(proj.wordSpacing ?? DEFAULT_STYLE_CONFIG.wordSpacing),
        revealMode: proj.revealMode || DEFAULT_STYLE_CONFIG.revealMode,
        effect: proj.effect || DEFAULT_STYLE_CONFIG.effect,
        wordsPerPage: proj.wordsPerPage || DEFAULT_STYLE_CONFIG.wordsPerPage,
        pageLayout: proj.pageLayout || DEFAULT_STYLE_CONFIG.pageLayout,
        spotlightAuto: proj.spotlightAuto ?? true,
        blendMode: proj.blendMode || 'normal',
      });
      setImproveAudio(proj.audioCleanEnabled);
      setDuration(proj.duration);
      setTrimStart(proj.trimStart);
      setTrimEnd(proj.trimEnd);
      resetCaptionHistory(loadedCues);
      navigate('studio');
      toast.success(
        `Loaded “${proj.title}” (${loadedCues.length} captions). Re-attach video file to preview playback.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load project captions.');
    }
  };

  return (
    <Theme theme={neutralTheme} mode="dark">
      <div data-lg-theme="dark" className="caption-app text-foreground">
        <TopNav
          activeView={activeView}
          onNavigate={navigate}
          user={user}
          authLoading={authLoading}
          savingProject={savingProject}
          onPrimaryAction={() => void handleSaveProject()}
        />

        {authError && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <AlertDescription className="flex items-center justify-between gap-3 text-xs">
                <span>{authError}</span>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={clearAuthError}
                  className="p-0 h-auto cursor-pointer"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <main>
          {activeView === 'gallery' && (
            <StudioGallery
              currentDraft={currentDraft}
              recentDrafts={recentDrafts.filter((draft) => draft.id !== activeLocalId)}
              onBlank={() => startProject()}
              onTemplate={startProject}
              onResume={openLocalProject}
            />
          )}
          {activeView === 'studio' && (
            <div className="workspace-studio" data-mobile-pane={mobilePane}>
              <div className="workspace-project-bar glassy-chrome">
                <div className="workspace-project-name">
                  <AstryxButton
                    size="md" variant="secondary" isIconOnly label="Back to Gallery"
                    icon={<ArrowLeft size={18} />} onClick={() => navigate('gallery')} className="editor-gallery-back"
                  />
                  <div className="editor-project-title">
                    <h1 className="sr-only">Caption Lite Workspace</h1>
                    <Label htmlFor="project-title-input" className="sr-only">Project title</Label>
                    <Input
                      id="project-title-input"
                      type="text"
                      maxLength={120}
                      value={projectTitle}
                      onChange={(event) => setProjectTitle(event.target.value)}
                      className="workspace-title-input"
                    />
                    <p className="workspace-draft">
                      {activeProjectId ? 'Cloud project' : 'Local draft'}
                    </p>
                  </div>
                </div>
                <div className="workspace-actions">
                  <AstryxButton size="md" variant="primary" label="Export" icon={<Download size={17} />}
                    onClick={() => handleInspectorTabChange('export')} className="workspace-export" />
                </div>
              </div>

              <div className="workspace-grid">
                <aside className="workspace-side">
                  <nav className="workspace-tools" aria-label="Editing tools">
                    {INSPECTOR_TABS.map(({ id, label, Icon }) => (
                      <AstryxButton
                        key={id}
                        id={`inspector-tab-${id}`}
                        size="md"
                        variant="secondary"
                        label={label}
                        aria-current={id === inspectorTab ? 'true' : undefined}
                        aria-controls={`inspector-panel-${id}`}
                        icon={<Icon size={17} aria-hidden="true" />}
                        onClick={() => handleInspectorTabChange(id)}
                        className="workspace-tool"
                      />
                    ))}
                  </nav>
                </aside>

                <nav className="editor-mobile-dock glassy-chrome" aria-label="Mobile workspace">
                  {([
                    { id: 'preview', label: 'Preview', Icon: Film },
                    INSPECTOR_TABS[0],
                    INSPECTOR_TABS[1],
                    { id: 'tools', label: 'Tools', Icon: SlidersHorizontal },
                    INSPECTOR_TABS[4],
                  ] as const).map(({ id, label, Icon }) => {
                    const toolsActive = inspectorTab === 'reference' || inspectorTab === 'ai';
                    const active = id === 'preview'
                      ? mobilePane === 'preview'
                      : mobilePane === 'edit' && (id === 'tools' ? toolsActive : inspectorTab === id);
                    return (
                      <AstryxButton
                        key={id} variant="secondary" label={label} size="md"
                        icon={<Icon size={17} aria-hidden="true" />}
                        aria-current={active ? 'true' : undefined}
                        className="workspace-tool"
                        onClick={() => {
                          if (id === 'preview') openMobilePreview();
                          else if (id === 'tools') handleInspectorTabChange(toolsActive ? inspectorTab : 'reference');
                          else handleInspectorTabChange(id);
                        }}
                      />
                    );
                  })}
                </nav>

                <div className="workspace-preview" data-has-clip={Boolean(videoUrl)}>
                  <VideoStage
                    videoRef={videoRef}
                    videoPickerRef={videoPickerRef}
                    videoUrl={videoUrl}
                    fileInfo={fileInfo}
                    duration={duration}
                    currentTime={currentTime}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    aspect={aspect}
                    captions={captions}
                    styleConfig={stageStyleConfig}
                    stylePreviewCue={isCompact && mobilePane === 'preview' ? null : stylePreviewCue}
                    previewLabel={previewStyleState?.label ?? null}
                    improveAudio={improveAudio}
                    noiseStrength={noiseStrength}
                    audioMeterPct={audioMeterPct}
                    audioStatus={audioStatus}
                    voiceoverActive={Boolean(voiceoverEnabled && voiceoverUrl)}
                    replaceOriginalAudio={replaceOriginalAudio}
                    editingCue={editingCue}
                    loadingSample={loadingSample}
                    onFileSelected={handleFileSelected}
                    onSrtFileDropped={(file) => void handleSrtFileDropped(file)}
                    onDropError={(msg) => toast.error(msg)}
                    onLoadSampleClip={() => void handleLoadSampleClip()}
                    onAspectChange={setAspect}
                    onTrimChange={handleTrimChange}
                    onToggleImproveAudio={() => void handleToggleImproveAudio()}
                    onNoiseStrengthChange={handleNoiseStrengthChange}
                    onSelectCueForEdit={(cue) => {
                      videoRef.current?.pause();
                      voiceAudioRef.current?.pause();
                      setIsPlaying(false);
                      setEditingCue(cue);
                    }}
                    onSaveEditCue={(cueId, nextText) => {
                      updateCaptions(
                        captions.map((c) => (c.id === cueId ? { ...c, text: nextText } : c))
                      );
                      setEditingCue(null);
                    }}
                    onToggleCueKeyWord={(cueId, rawWord) => {
                      const updated = captions.map((c) =>
                        c.id === cueId
                          ? toggleCueKeyWord(c, rawWord, styleConfig.spotlightAuto ?? true)
                          : c
                      );
                      updateCaptions(updated);
                      const nextEditing = updated.find((c) => c.id === cueId) ?? null;
                      setEditingCue(nextEditing);
                    }}
                    onCancelEditCue={() => setEditingCue(null)}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeked={() => {
                      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                    }}
                    onPause={() => {
                      voiceAudioRef.current?.pause();
                      setIsPlaying(false);
                    }}
                    onEnded={handleEnded}
                  />
                  {videoUrl && (
                    <div className="editor-mini-transport">
                      <AstryxButton size="md" variant="secondary"
                        label={isPlaying ? 'Pause preview' : 'Play preview'}
                        icon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        onClick={() => void handleTogglePlay()} />
                      <AstryxButton size="md" variant="secondary" label="Full preview" onClick={openMobilePreview} />
                    </div>
                  )}
                  <audio
                    ref={voiceAudioRef}
                    src={voiceoverUrl ?? undefined}
                    preload="metadata"
                    className="hidden"
                  />
                </div>

                <div className="workspace-inspector">
                  <header className="workspace-inspector-heading">
                    <h2 id="workspace-inspector-title">{INSPECTOR_TABS.find(({ id }) => id === inspectorTab)?.label}</h2>
                    {(inspectorTab === 'reference' || inspectorTab === 'ai') && (
                      <div className="editor-device-tools" aria-label="Additional editing tools">
                        <AstryxButton size="sm" variant="secondary" label="Reference"
                          aria-pressed={inspectorTab === 'reference'} onClick={() => handleInspectorTabChange('reference')} />
                        <AstryxButton size="sm" variant="secondary" label="AI tools"
                          aria-pressed={inspectorTab === 'ai'} onClick={() => handleInspectorTabChange('ai')} />
                      </div>
                    )}
                  </header>

                  <InspectorPanel tab="captions" activeTab={inspectorTab}>
                    <CaptionsPanel
                      videoFile={videoFile}
                      videoRef={videoRef}
                      duration={duration}
                      currentTime={currentTime}
                      trimStart={trimStart}
                      trimEnd={trimEnd}
                      language={language}
                      wordsPerPage={styleConfig.wordsPerPage ?? 'auto'}
                      spotlightAuto={styleConfig.spotlightAuto ?? true}
                      captions={captions}
                      capabilities={capabilities}
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      onLanguageChange={setLanguage}
                      onWordsPerPageChange={(wordsPerPage) =>
                        setStyleConfig((prev) => ({ ...prev, wordsPerPage }))
                      }
                      onCaptionsChange={updateCaptions}
                      onSeekTo={handleSeekTo}
                      onOpenDeployGuide={() => navigate('deploy')}
                      onRequestVideo={() => videoPickerRef.current?.click()}
                    />
                  </InspectorPanel>

                  <InspectorPanel tab="style" activeTab={inspectorTab}>
                    <StylePanel
                      videoRef={videoRef}
                      videoUrl={videoUrl}
                      styleConfig={styleConfig}
                      previewConfig={previewStyleState?.config ?? null}
                      previewLabel={previewStyleState?.label ?? null}
                      sampleCue={stylePreviewCue}
                      presets={cloudPresets}
                      signedIn={Boolean(user)}
                      onChange={(next) => {
                        setPreviewStyleState(null);
                        setStyleConfig(next);
                      }}
                      onPreviewChange={(next, label) => {
                        if (!next) {
                          setPreviewStyleState(null);
                        } else {
                          setPreviewStyleState({ config: next, label: label ?? 'Preview' });
                        }
                      }}
                      onSavePreset={async (name) => {
                        if (!user) return;
                        await saveStylePresetToFirestore(user.uid, {
                          name,
                          style: styleConfig.style,
                          fontFamily: styleConfig.fontFamily,
                          position: styleConfig.position,
                          accentColor: styleConfig.accentColor,
                          fontSize: styleConfig.fontSize,
                          wordSpacing: clampWordSpacing(styleConfig.wordSpacing),
                          revealMode: styleConfig.revealMode,
                          effect: styleConfig.effect,
                          wordsPerPage: styleConfig.wordsPerPage,
                          pageLayout: styleConfig.pageLayout,
                          spotlightAuto: styleConfig.spotlightAuto,
                          blendMode: styleConfig.blendMode,
                        });
                      }}
                      onDeletePreset={async (presetId) => {
                        if (!user) return;
                        await deleteStylePresetFromFirestore(user.uid, presetId);
                      }}
                      onSignInPrompt={() => void signInWithGoogle()}
                    />
                  </InspectorPanel>

                  <InspectorPanel tab="reference" activeTab={inspectorTab}>
                    <ReferenceMatchPanel
                      styleConfig={styleConfig}
                      onApplyLook={setStyleConfig}
                    />
                  </InspectorPanel>

                  <InspectorPanel tab="ai" activeTab={inspectorTab}>
                    <AIRefinePanel
                      captions={captions}
                      capabilities={capabilities}
                      voiceoverUrl={voiceoverUrl}
                      voiceoverEnabled={voiceoverEnabled}
                      replaceOriginalAudio={replaceOriginalAudio}
                      onVoiceoverGenerated={handleVoiceoverGenerated}
                      onToggleVoiceoverEnabled={setVoiceoverEnabled}
                      onChangeReplaceOriginalAudio={setReplaceOriginalAudio}
                      onCaptionsChange={updateCaptions}
                      onOpenDeployGuide={() => navigate('deploy')}
                    />
                  </InspectorPanel>

                  <InspectorPanel tab="export" activeTab={inspectorTab}>
                    <ExportPanel
                      videoRef={videoRef}
                      videoLoaded={Boolean(videoUrl)}
                      captions={captions}
                      aspect={aspect}
                      styleConfig={styleConfig}
                      trimStart={trimStart}
                      trimEnd={trimEnd}
                      improveAudio={improveAudio}
                      noiseStrength={noiseStrength}
                      audioGraph={audioGraphRef.current}
                      voiceoverBlob={voiceoverBlob}
                      voiceoverEnabled={voiceoverEnabled}
                      replaceOriginalAudio={replaceOriginalAudio}
                      projectTitle={projectTitle}
                    />
                  </InspectorPanel>
                </div>

                <div className="editor-timeline">
                  <StudioTimelineBar
                    videoLoaded={Boolean(videoUrl)}
                    duration={duration}
                    currentTime={currentTime}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    isPlaying={isPlaying}
                    loopClip={loopClip}
                    captions={captions}
                    previewLabel={previewStyleState?.label ?? null}
                    onTogglePlay={() => void handleTogglePlay()}
                    onToggleLoop={() => setLoopClip((prev) => !prev)}
                    onSeekTo={handleSeekTo}
                    onEditActiveCue={(cue) => {
                      videoRef.current?.pause();
                      voiceAudioRef.current?.pause();
                      setIsPlaying(false);
                      setEditingCue(cue);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeView === 'projects' && (
            <ProjectsDashboard
              user={user}
              authLoading={authLoading}
              projects={cloudProjects}
              projectsLoading={projectsLoading}
              presets={cloudPresets}
              activeProjectId={activeProjectId}
              onSignIn={() => void signInWithGoogle()}
              onSignOut={() => void signOutUser()}
              onNewProject={() => navigate('gallery')}
              onOpenProject={(proj) => void handleOpenCloudProject(proj)}
              onDeleteProject={async (projectId) => {
                if (!user) return;
                await deleteProjectFromFirestore(projectId, user.uid);
                if (activeProjectId === projectId) setActiveProjectId(null);
              }}
            />
          )}

          {activeView === 'deploy' && <DeployGuideView capabilities={capabilities} />}

          {activeView === 'guide' && <HowItWorksView onOpenStudio={() => navigate('gallery')} />}
        </main>

        <Toaster theme="dark" position={isCompact ? 'top-center' : 'bottom-right'} />
      </div>
    </Theme>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <StudioApp />
      </TooltipProvider>
    </AuthProvider>
  );
}
