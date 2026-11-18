import { useRef } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { ArrowDown, ArrowRight, Captions, Download, SlidersHorizontal } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue, type MotionStyle } from 'motion/react';

const examples = [
  { image: 'architecture', alt: 'Skyscrapers seen from below', caption: ['CHANGE YOUR', 'POINT OF VIEW'], style: 'Condensed', format: 'condensed', tilt: -13, offset: 82, drift: -24 },
  { image: 'forest', alt: 'A winding path in a sunlit forest', caption: ['Take the', 'long way.'], style: 'Minimal', format: 'minimal', tilt: -7, offset: 24, drift: -13 },
  { image: 'alpine', alt: 'A blue lake with snow-tipped mountains at sunset', caption: ['Somewhere', 'quieter.'], style: 'Editorial', format: 'editorial', tilt: 0, offset: 0, drift: 0 },
  { image: 'dog', alt: 'A pug wearing a light blue shirt', caption: ['he has', 'opinions.'], style: 'Spotlight', format: 'spotlight', tilt: 7, offset: 24, drift: 13 },
  { image: 'city', alt: 'The lit-up city skyline at dusk', caption: ['THE CITY', 'NEVER SLEEPS'], style: 'Block', format: 'block', tilt: 13, offset: 82, drift: 24 },
];

const features = [
  { Icon: Captions, title: 'Add captions', text: 'Type a line, paste your script, import an SRT, or generate captions from speech.' },
  { Icon: SlidersHorizontal, title: 'Find your style', text: 'Choose a font, set the rhythm, and highlight the words you want people to remember.' },
  { Icon: Download, title: 'Export your way', text: 'Download a captioned video or take your subtitles into another editor.' },
];

function ExampleCard({ example, progress }: {
  example: (typeof examples)[number];
  progress: MotionValue<number>;
}) {
  const reduceMotion = useReducedMotion();
  const x = useTransform(progress, [0, 1], [0, example.drift]);
  const y = useTransform(progress, [0, 1], [0, example.offset * -0.58]);
  const rotate = useTransform(progress, [0, 1], [example.tilt, example.tilt * -0.2]);

  const cardStyle: MotionStyle & { '--example-offset': string } = {
    '--example-offset': `${example.offset}px`,
    x: reduceMotion ? 0 : x,
    y: reduceMotion ? 0 : y,
    rotate: reduceMotion ? 0 : rotate,
  };

  return (
    <motion.figure
      className="landing-example"
      style={cardStyle}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, delay: Math.abs(example.tilt) * 0.016 }}
    >
      <div className="landing-example-image">
        <img
          src={`/assets/showcase/${example.image}.webp`}
          alt={example.alt}
          width={420}
          height={588}
          fetchPriority={example.image === 'alpine' ? 'high' : 'auto'}
        />
        <div className={`landing-example-caption landing-example-caption--${example.format}`}>
          {example.caption.map((line) => <span key={line}>{line}</span>)}
        </div>
      </div>
      <figcaption>{example.style}</figcaption>
    </motion.figure>
  );
}

export function LandingPage({ onOpenStudio }: { onOpenStudio: () => void }) {
  const showcaseRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: showcaseRef, offset: ['start 35%', 'end 20%'] });

  return (
    <div className="caption-landing">
      <section className="landing-hero" aria-labelledby="landing-title">
        <h1 id="landing-title">Make every word<br />worth watching.</h1>
        <p>Style captions for your Reels, Shorts, and TikToks in one browser-based studio.</p>
        <div className="landing-actions">
          <Button variant="primary" size="lg" label="Open Studio" icon={<ArrowRight size={17} />} onClick={onOpenStudio} className="landing-primary" />
          <a href="#styles" className="landing-secondary">See caption styles <ArrowDown size={15} aria-hidden="true" /></a>
        </div>
      </section>

      <section ref={showcaseRef} id="styles" className="landing-showcase" aria-label="Caption style examples">
        <div className="landing-examples">
          {examples.map((example) => <ExampleCard key={example.image} example={example} progress={scrollYProgress} />)}
        </div>
      </section>

      <section className="landing-features" aria-labelledby="landing-features-title">
        <h2 id="landing-features-title">From clip to final cut.</h2>
        <div className="landing-feature-grid">
          {features.map(({ Icon, title, text }) => (
            <article key={title}>
              <Icon size={21} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <Button label="Start editing" variant="primary" size="lg" icon={<ArrowRight size={17} />} onClick={onOpenStudio} className="landing-primary" />
      </section>
    </div>
  );
}
