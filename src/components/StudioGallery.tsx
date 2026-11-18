import { Button } from '@astryxdesign/core/Button';
import { ArrowDownRight, ArrowRight, FileVideo, FolderOpen, Pause, Play, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { findActiveCaption, findPreviousCaption, type StyleConfig } from '../utils/captions';
import type { StudioDraft } from '../utils/draftStorage';
import { CaptionOverlay } from './CaptionOverlay';
import { SubjectForeground } from './SubjectForeground';
import { galleryPreviewCues, galleryTemplates, type GalleryTemplate } from './galleryTemplates';

const categories = [
  { id: 'all', label: 'All styles' },
  { id: 'simple', label: 'Clean' },
  { id: 'creator', label: 'Creator' },
  { id: 'font-switch', label: 'Kinetic' },
  { id: 'preset', label: 'Presets' },
] as const;

// Portrait clip by ANTONI SHKRABA production, used under the Pexels License.
// https://www.pexels.com/video/woman-looking-at-camera-and-speaking-8135208/
const previewVideoUrl = '/assets/gallery/podcast.mp4';

const reduceMotionQuery = '(prefers-reduced-motion: reduce)';
const compactGalleryQuery = '(max-width: 759px)';

function useMediaMatch(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function GalleryTemplateCard({ template, selected, reducedMotion, onSelect }: {
  template: GalleryTemplate;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}) {
  const [auditioning, setAuditioning] = useState(false);
  const [time, setTime] = useState(1.48);

  useEffect(() => {
    if (reducedMotion || !auditioning) return;
    const start = performance.now();
    const timer = window.setInterval(() => setTime(((performance.now() - start) / 1000) % 7), 60);
    return () => window.clearInterval(timer);
  }, [auditioning, reducedMotion]);

  const cue = !reducedMotion && auditioning
    ? findActiveCaption(galleryPreviewCues, time) ?? galleryPreviewCues[0]
    : galleryPreviewCues[0];
  return (
    <button
      type="button"
      className="gallery-template"
      aria-label={`Preview ${template.title}`}
      aria-pressed={selected}
      onPointerEnter={event => event.pointerType === 'mouse' && setAuditioning(true)}
      onPointerLeave={() => setAuditioning(false)}
      onFocus={event => event.currentTarget.matches(':focus-visible') && setAuditioning(true)}
      onBlur={() => setAuditioning(false)}
      onClick={onSelect}
    >
      <span className="gallery-template-art" aria-hidden="true">
        <CaptionOverlay cue={cue} currentTime={!reducedMotion && auditioning ? time : 1.48} config={{ ...template.style, position: 'pos-centre' }} />
      </span>
      <span className="gallery-template-info">
        <strong>{template.title}</strong>
        <ArrowDownRight size={15} aria-hidden="true" />
      </span>
    </button>
  );
}

function GalleryVideoPreview({ template, reducedMotion, onUse }: {
  template: GalleryTemplate;
  reducedMotion: boolean;
  onUse: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playOverride, setPlayOverride] = useState<boolean | null>(null);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [inView, setInView] = useState(true);
  const [time, setTime] = useState(1.48);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const wantsPlayback = playOverride ?? !reducedMotion;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!wantsPlayback || !pageVisible || !inView || blocked) {
      video.pause();
      return;
    }

    let cancelled = false;
    void video.play().catch(() => {
      if (!cancelled) setBlocked(true);
    });
    let lastTick = 0;
    let frame: number;
    const sample = (now: number) => {
      if (now - lastTick >= 52 && !video.paused) {
        lastTick = now;
        setTime(video.currentTime);
      }
      frame = window.requestAnimationFrame(sample);
    };
    frame = window.requestAnimationFrame(sample);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [wantsPlayback, pageVisible, inView, blocked]);

  const cue = findActiveCaption(galleryPreviewCues, time) ?? galleryPreviewCues[0];
  const previousCue = template.style.pageLayout === 'stack' ? findPreviousCaption(galleryPreviewCues, cue) : null;
  const showPause = wantsPlayback && !blocked;

  return (
    <>
      <div className="gallery-preview-frame">
        <video
          ref={videoRef}
          muted
          playsInline
          loop
          preload={reducedMotion ? 'none' : 'metadata'}
          poster="/assets/gallery/podcast.webp"
          aria-label="Silent portrait clip with sample captions"
        >
          <source src={previewVideoUrl} type="video/mp4" />
        </video>
        <div className="gallery-video-gradient" aria-hidden="true" />
        <div className="gallery-video-caption" aria-hidden="true">
          <CaptionOverlay cue={cue} previousCue={previousCue} currentTime={time} config={template.style} />
        </div>
        {template.style.style === 'st-behind-subject' && (
          <SubjectForeground videoRef={videoRef} source={previewVideoUrl} />
        )}
        <button
          type="button"
          className="gallery-preview-play"
          aria-label={showPause ? 'Pause clip' : 'Play clip'}
          onClick={() => {
            setBlocked(false);
            setPlayOverride(!showPause);
            if (!showPause) void videoRef.current?.play().catch(() => setBlocked(true));
          }}
        >
          {showPause ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
      </div>
      <div className="gallery-preview-details">
        <p>{template.description}</p>
        <Button
          label="Use this style"
          icon={<ArrowRight size={17} aria-hidden="true" />}
          variant="primary"
          className="gallery-use-style"
          onClick={onUse}
        />
      </div>
    </>
  );
}

interface StudioGalleryProps {
  currentDraft: StudioDraft | null;
  recentDrafts: StudioDraft[];
  onBlank: () => void;
  onResume: (draft: StudioDraft) => void;
  onTemplate: (title: string, style: StyleConfig) => void;
}

export function StudioGallery({ currentDraft, recentDrafts, onBlank, onResume, onTemplate }: StudioGalleryProps) {
  const drafts = currentDraft ? [currentDraft, ...recentDrafts] : recentDrafts;
  const [category, setCategory] = useState<(typeof categories)[number]['id']>('all');
  const [selected, setSelected] = useState(galleryTemplates[0]);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const reducedMotion = useMediaMatch(reduceMotionQuery);
  const compact = useMediaMatch(compactGalleryQuery);
  const templates = category === 'all' ? galleryTemplates : galleryTemplates.filter(template => template.category === category);
  const applySelected = () => onTemplate(selected.title, selected.style);

  return (
    <div className="studio-gallery">
      <header className="gallery-heading">
        <div>
          <h1>Caption styles</h1>
          <p>Find a look, preview it on video, and make it yours.</p>
        </div>
        <Button label="New project" icon={<Plus size={17} aria-hidden="true" />} variant="primary" onClick={onBlank} className="gallery-primary" />
      </header>

      {drafts.length > 0 && (
        <section className="gallery-recent" aria-labelledby="gallery-recent-heading">
          <h2 id="gallery-recent-heading">Recent drafts</h2>
          <div className="gallery-drafts-info">
            {drafts.map((draft) => (
              <button key={draft.id} type="button" className="gallery-draft" onClick={() => onResume(draft)}>
                <span className="gallery-draft-icon"><FileVideo size={20} aria-hidden="true" /></span>
                <span className="gallery-draft-text">
                  <strong>{draft.projectTitle}</strong>
                  <small>{draft.captions.length} {draft.captions.length === 1 ? 'caption' : 'captions'}</small>
                </span>
                <FolderOpen size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="gallery-layout">
        <section className="gallery-library" aria-label="Caption templates">
          <div className="gallery-filter-bar">
            <div className="gallery-filters" role="group" aria-label="Filter caption templates">
              {categories.map(({ id, label }) => (
                <Button
                  key={id}
                  label={label}
                  size="sm"
                  variant="secondary"
                  aria-pressed={id === category}
                  onClick={() => setCategory(id)}
                  className="gallery-filter"
                />
              ))}
            </div>
            <span className="gallery-style-count" aria-live="polite">{templates.length} styles</span>
          </div>
          <div className="gallery-template-grid">
            {templates.map(template => (
              <GalleryTemplateCard
                key={template.id}
                template={template}
                selected={selected.id === template.id}
                reducedMotion={reducedMotion}
                onSelect={() => {
                  setSelected(template);
                  if (compact) setShowMobilePreview(true);
                }}
              />
            ))}
          </div>
        </section>

        {!compact && (
          <aside className="gallery-preview-panel" aria-label="Video preview">
            <div className="gallery-preview-heading">
              <h2 aria-live="polite">{selected.title}</h2>
              <span>VIDEO PREVIEW</span>
            </div>
            <GalleryVideoPreview template={selected} reducedMotion={reducedMotion} onUse={applySelected} />
          </aside>
        )}
      </div>

      {compact && (
        <Dialog open={showMobilePreview} onOpenChange={setShowMobilePreview}>
          <DialogContent className="gallery-mobile-dialog">
            <DialogTitle className="gallery-dialog-title">{selected.title}</DialogTitle>
            <DialogDescription className="sr-only">Video preview of {selected.title}</DialogDescription>
            {showMobilePreview && (
              <GalleryVideoPreview template={selected} reducedMotion={reducedMotion} onUse={applySelected} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
