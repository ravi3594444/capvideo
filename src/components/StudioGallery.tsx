import { Button } from '@astryxdesign/core/Button';
import { ArrowRight, Captions, FileVideo, FolderOpen, Pause, Play, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { findActiveCaption, findPreviousCaption, type StyleConfig } from '../utils/captions';
import type { StudioDraft } from '../utils/draftStorage';
import { CaptionOverlay } from './CaptionOverlay';
import { galleryLoopDuration, galleryTemplates, type GalleryTemplate } from './galleryTemplates';

const categories = [
  { id: 'all', label: 'All' },
  { id: 'simple', label: 'Clean' },
  { id: 'font-switch', label: 'Kinetic' },
  { id: 'creator', label: 'Creator' },
  { id: 'preset', label: 'Presets' },
] as const;

function GalleryTemplateCard({ template, allowMotion, onSelect }: {
  template: GalleryTemplate;
  allowMotion: boolean;
  onSelect: (title: string, style: StyleConfig) => void;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(() => !('IntersectionObserver' in window));
  const [time, setTime] = useState(template.cues[0].end - 0.05);
  const isPlaying = allowMotion && inView;

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.25), { threshold: 0.25 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastTick) / 1000;
      lastTick = now;
      setTime(current => (current + elapsed) % galleryLoopDuration);
    }, 65);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const cue = findActiveCaption(template.cues, time) ?? template.cues[0];
  const previousCue = template.style.pageLayout === 'stack' ? findPreviousCaption(template.cues, cue) : null;

  return (
    <button
      ref={cardRef}
      type="button"
      className="gallery-template"
      data-preview-playing={isPlaying}
      aria-label={`Use ${template.title} template`}
      onClick={() => onSelect(template.title, template.style)}
    >
      <span className="gallery-template-art" aria-hidden="true">
        <img src={`/assets/showcase/${template.image}.webp`} alt="" loading="lazy" decoding="async" width={300} height={228} />
        <CaptionOverlay cue={cue} previousCue={previousCue} currentTime={time} config={template.style} />
      </span>
      <span className="gallery-template-info">
        <span><strong>{template.title}</strong><small>{template.description}</small></span>
        <ArrowRight size={18} aria-hidden="true" />
      </span>
    </button>
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
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const motionEnabled = motionOverride ?? !reduceMotion;
  const templates = category === 'all' ? galleryTemplates : galleryTemplates.filter(template => template.category === category);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(preference.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    preference.addEventListener('change', updatePreference);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      preference.removeEventListener('change', updatePreference);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return (
    <div className="studio-gallery">
      <header className="gallery-heading">
        <div>
          <h1>Gallery</h1>
          <p>Start with your own clip or choose a caption style to build on.</p>
        </div>
        <Button label="New project" icon={<Plus size={17} />} variant="primary" onClick={onBlank} className="gallery-primary" />
      </header>

      {drafts.length > 0 && (
        <section className="gallery-recent" aria-labelledby="gallery-recent-heading">
          <div className="gallery-section-heading">
            <h2 id="gallery-recent-heading">Recent on this device</h2>
            <p>Drafts save captions and styles. Reattach the clip if prompted.</p>
          </div>
          <div className="gallery-drafts-info">
            {drafts.map((draft) => (
              <button key={draft.id} type="button" className="gallery-draft" onClick={() => onResume(draft)}>
                <span className="gallery-draft-icon"><FileVideo size={20} aria-hidden="true" /></span>
                <span className="gallery-draft-text">
                  <strong>{draft.projectTitle}</strong>
                  <small>{draft.captions.length} {draft.captions.length === 1 ? 'caption' : 'captions'} · {draft.aspect === 'r916' ? '9:16' : draft.aspect === 'r11' ? '1:1' : '16:9'}</small>
                </span>
                <FolderOpen size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="gallery-template-heading">
        <div className="gallery-section-heading gallery-template-heading">
          <div>
            <h2 id="gallery-template-heading">Caption templates</h2>
            <p>{galleryTemplates.length} styles and presets. Pick one to open it in Workspace.</p>
          </div>
          <Button
            label={motionEnabled ? 'Pause previews' : 'Play previews'}
            icon={motionEnabled ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            variant="secondary"
            className="gallery-motion-toggle"
            onClick={() => setMotionOverride(!motionEnabled)}
          />
        </div>
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
        <div className="gallery-template-grid">
          {templates.map(template => (
            <GalleryTemplateCard
              key={template.id}
              template={template}
              allowMotion={motionEnabled && pageVisible}
              onSelect={onTemplate}
            />
          ))}
        </div>
      </section>

      <div className="gallery-note">
        <Captions size={15} aria-hidden="true" />
        <span>You can change the font, timing, and animation in Workspace.</span>
      </div>
    </div>
  );
}
