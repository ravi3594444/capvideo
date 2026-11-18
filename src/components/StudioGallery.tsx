import { Button } from '@astryxdesign/core/Button';
import { ArrowRight, Captions, FileVideo, FolderOpen, Plus } from 'lucide-react';
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../utils/captions';
import type { StudioDraft } from '../utils/draftStorage';

const templates = [
  {
    title: 'Word Highlight', image: 'city', look: 'highlight', caption: ['Pay attention', 'to this.'],
    description: 'Highlight the word being spoken.',
    style: { style: 'st-highlight', accentColor: '#ffd60a', revealMode: 'karaoke' },
  },
  {
    title: 'Editorial Serif', image: 'alpine', look: 'editorial', caption: ['Somewhere', 'quieter.'],
    description: 'Soft serif type for slower cuts.',
    style: { style: 'st-editorial', fontFamily: 'editorial', revealMode: 'spotlight', effect: 'fadeIn' },
  },
  {
    title: 'Clean Subtitles', image: 'forest', look: 'clean', caption: ['Take the', 'long way.'],
    description: 'Simple subtitles with an even rhythm.',
    style: { style: 'st-minimal', revealMode: 'flash', effect: 'fadeIn' },
  },
  {
    title: 'One-Word Pop', image: 'dog', look: 'pop', caption: ['LISTEN.'],
    description: 'One bold word at a time.',
    style: { style: 'st-pop', fontFamily: 'impact', accentColor: '#c2f970', revealMode: 'pop', effect: 'bounce' },
  },
  {
    title: 'Typewriter', image: 'network', look: 'mono', caption: ['stay_', 'connected'],
    description: 'Monospace text that builds as you speak.',
    style: { style: 'st-typewriter', fontFamily: 'mono', accentColor: '#67e8f9', revealMode: 'build', effect: 'typewriter' },
  },
  {
    title: 'Cinema Matte', image: 'coast', look: 'cinema', caption: ['See you by the sea.'],
    description: 'A shaded caption line for bright clips.',
    style: { style: 'st-cinema', revealMode: 'flash', effect: 'fadeIn' },
  },
] satisfies Array<{
  title: string;
  image: string;
  look: string;
  caption: string[];
  description: string;
  style: Partial<StyleConfig>;
}>;

interface StudioGalleryProps {
  currentDraft: StudioDraft | null;
  recentDrafts: StudioDraft[];
  onBlank: () => void;
  onResume: (draft: StudioDraft) => void;
  onTemplate: (title: string, style: StyleConfig) => void;
}

export function StudioGallery({ currentDraft, recentDrafts, onBlank, onResume, onTemplate }: StudioGalleryProps) {
  const drafts = currentDraft ? [currentDraft, ...recentDrafts] : recentDrafts;

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
        <div className="gallery-section-heading">
          <h2 id="gallery-template-heading">Caption templates</h2>
          <p>Each template opens a new workspace with its style already applied.</p>
        </div>
        <div className="gallery-template-grid">
          {templates.map((template) => (
            <button
              key={template.title}
              type="button"
              className="gallery-template"
              aria-label={`Use ${template.title} template`}
              onClick={() => onTemplate(template.title, { ...DEFAULT_STYLE_CONFIG, ...template.style })}
            >
              <span className="gallery-template-art">
                <img src={`/assets/showcase/${template.image}.webp`} alt="" loading="lazy" width={300} height={228} />
                <span aria-hidden="true" className={`gallery-template-caption gallery-template-caption--${template.look}`}>
                  {template.caption.map((line) => <span key={line}>{line}</span>)}
                </span>
              </span>
              <span className="gallery-template-info">
                <span><strong>{template.title}</strong><small>{template.description}</small></span>
                <ArrowRight size={18} aria-hidden="true" />
              </span>
            </button>
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
