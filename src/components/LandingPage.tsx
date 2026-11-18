import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { ArrowDown, ArrowRight, Camera, Captions, Download, SlidersHorizontal } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';

const examples = [
  ['architecture', 'Skyscrapers from below', 'Change your|point of view', 'Condensed', 'condensed'],
  ['interior', 'Sunlit room with white chairs', 'A little more|room to breathe', 'Minimal', 'minimal'],
  ['hall', 'Light at the end of a corridor', 'Keep|going', 'Outline', 'outline'],
  ['river', 'A river below wooded mountains', 'Follow|the water', 'Editorial', 'editorial'],
  ['ridge', 'A green ridge beneath clouds', 'Above|it all', 'Spotlight', 'spotlight'],
  ['clouds', 'Sunrise above the clouds', 'First|light', 'Mono', 'mono'],
  ['forest', 'A path through a forest', 'Take the|long way', 'Minimal', 'minimal'],
  ['hills', 'A green valley at sunset', 'Worth|the detour', 'Block', 'block'],
  ['dawn', 'Dawn over a palm-lined river', 'Before|the rush', 'Editorial', 'editorial'],
  ['moors', 'Mountains beneath an overcast sky', 'Into|the mist', 'Outline', 'outline'],
  ['earth', 'City lights seen from orbit', 'After|hours', 'Mono', 'mono'],
  ['dog', 'A pug in a light blue shirt', 'He has|opinions', 'Spotlight', 'spotlight'],
  ['flowers', 'Wildflowers in an open field', 'Let it|grow', 'Block', 'block'],
  ['sunset', 'Sunset across a meadow', 'One more|minute', 'Editorial', 'editorial'],
  ['alpine', 'An alpine lake at sunset', 'Somewhere|quieter', 'Editorial', 'editorial'],
  ['lamp', 'A single lamp on a green wall', 'Less|is more', 'Minimal', 'minimal'],
  ['coast', 'An aerial view of a coastal city', 'See you|by the sea', 'Condensed', 'condensed'],
  ['leaves', 'Sunlight through wet green leaves', 'Small|things', 'Spotlight', 'spotlight'],
  ['network', 'A dark blue network of lights', 'Stay|connected', 'Mono', 'mono'],
  ['city', 'A lit-up city at dusk', 'The city|never sleeps', 'Block', 'block'],
] as const;

const features = [
  { Icon: Captions, title: 'Add captions', text: 'Type a line, paste your script, import an SRT, or generate captions from speech.' },
  { Icon: SlidersHorizontal, title: 'Find your style', text: 'Choose a font, set the rhythm, and highlight the words you want people to remember.' },
  { Icon: Download, title: 'Export your way', text: 'Download a captioned video or take your subtitles into another editor.' },
];

type SceneSize = { width: number; height: number };
type Pose = { x: number; y: number; rotate: number; scale: number; opacity: number };

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

function blendPose(from: Pose, to: Pose, progress: number): Pose {
  return {
    x: mix(from.x, to.x, progress),
    y: mix(from.y, to.y, progress),
    rotate: mix(from.rotate, to.rotate, progress),
    scale: mix(from.scale, to.scale, progress),
    opacity: mix(from.opacity, to.opacity, progress),
  };
}

function getCardWidth({ width, height }: SceneSize) {
  return Math.max(32, Math.min(76, width * .052, height * .105));
}

function getCardPose(index: number, size: SceneSize, intro: number, scroll: number, pointer: number): Pose {
  const { width, height } = size;
  const position = index / (examples.length - 1) - .5;
  const scatter = {
    x: Math.sin(index * 9.37 + 1) * width * .44,
    y: Math.cos(index * 6.73 + 1) * height * .35,
    rotate: Math.sin(index * 2.15) * 58,
    scale: .7,
    opacity: .26,
  };
  const line = { x: position * width * .91, y: height * .13, rotate: 0, scale: 1, opacity: 1 };
  if (intro < 1) return blendPose(scatter, line, intro);

  const circleAngle = (index / examples.length - .5) * 2 * Math.PI;
  const circleRadius = Math.min(width * .397, height * .342);
  const circle = {
    x: Math.sin(circleAngle) * circleRadius,
    y: Math.cos(circleAngle) * circleRadius,
    rotate: -circleAngle * 180 / Math.PI,
    scale: 1,
    opacity: 1,
  };
  if (intro < 2) return blendPose(line, circle, intro - 1);

  const arcRadius = Math.max(width * .61, height * .48);
  const arcSpread = (width < 600 ? 3.8 : 2) * Math.asin(width * .44 / arcRadius);
  const sweep = mix(.36, -.36, clamp((scroll - .30) / .70));
  const arcAngle = (position + sweep) * arcSpread;
  const arc = {
    x: Math.sin(arcAngle) * arcRadius + pointer * width * .025,
    y: height * .075 + arcRadius * (1 - Math.cos(arcAngle)),
    rotate: arcAngle * 180 / Math.PI,
    scale: 1.56,
    opacity: 1,
  };
  return blendPose(circle, arc, clamp(scroll / .30));
}

function ExampleCard({ example, index, size, intro, scroll, pointer, reduced }: {
  example: (typeof examples)[number];
  index: number;
  size: SceneSize;
  intro: MotionValue<number>;
  scroll: MotionValue<number>;
  pointer: MotionValue<number>;
  reduced: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const pose = useTransform(() => getCardPose(index, size, intro.get(), scroll.get(), pointer.get()));
  const x = useTransform(pose, (value) => value.x);
  const y = useTransform(pose, (value) => value.y);
  const rotate = useTransform(pose, (value) => value.rotate);
  const scale = useTransform(pose, (value) => value.scale);
  const opacity = useTransform(pose, (value) => value.opacity);
  const zIndex = useTransform(pose, (value) => 1000 - Math.round(Math.abs(value.x)));
  const [image, alt, caption, style, format] = example;

  return (
    <motion.figure className="landing-example" style={reduced ? undefined : { x, y, rotate, scale, opacity, zIndex }}>
      <button
        type="button"
        className="landing-example-button"
        aria-label={`${style} captions: ${caption.replace('|', ' ')}`}
        aria-pressed={flipped}
        onClick={() => setFlipped((value) => !value)}
      >
        <span className="landing-example-flip">
          <span className="landing-example-image">
            <img src={`/assets/showcase/${image}.webp`} alt={alt} width={300} height={420} draggable={false} />
            <span className={`landing-example-caption landing-example-caption--${format}`} aria-hidden="true">
              {caption.split('|').map((line) => <span key={line}>{line}</span>)}
            </span>
          </span>
          <span className="landing-example-back" aria-hidden="true">
            <Camera size={13} />
            <span>{style}</span>
          </span>
        </span>
      </button>
    </motion.figure>
  );
}

export function LandingPage({ onOpenGallery }: { onOpenGallery: () => void }) {
  const showcaseRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<SceneSize>({ width: 0, height: 0 });
  const reduced = Boolean(useReducedMotion());
  const intro = useMotionValue(0);
  const pointer = useMotionValue(0);
  const sceneHeight = useMotionValue(0);
  const smoothPointer = useSpring(pointer, { stiffness: 95, damping: 23, mass: .8 });
  const { scrollYProgress } = useScroll({ target: showcaseRef, offset: ['start start', 'end end'] });
  const scroll = useSpring(scrollYProgress, { stiffness: 125, damping: 30, mass: .65 });
  const titleY = useTransform([intro, scroll, sceneHeight], ([opening, progress, height]: number[]) => {
    if (opening < 1) return -height * .24;
    if (opening < 2) return mix(-height * .24, 0, opening - 1);
    return -height * .28 * clamp(progress / .30);
  });
  const promptOpacity = useTransform(() => clamp((intro.get() - 1.5) * 2) * (1 - clamp(scroll.get() / .28)));

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      sceneHeight.set(height);
      setSize({ width, height });
    });
    observer.observe(scene);
    return () => observer.disconnect();
  }, [sceneHeight]);

  useEffect(() => {
    if (reduced) return;
    const animation = animate(intro, [0, 0, 1, 1, 2], {
      duration: 2.45,
      times: [0, .08, .34, .54, 1],
      ease: 'easeInOut',
    });
    return () => animation.stop();
  }, [intro, reduced]);

  return (
    <div className="caption-landing">
      <section ref={showcaseRef} className={`landing-showcase${reduced ? ' landing-showcase-static' : ''}`} aria-labelledby="landing-title">
        <div id="styles" className="landing-style-target" />
        <div
          ref={sceneRef}
          className="landing-scene"
          onPointerMove={(event) => {
            if (reduced || event.pointerType !== 'mouse') return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width) pointer.set(clamp((event.clientX - rect.left) / rect.width) * 2 - 1);
          }}
          onPointerLeave={() => pointer.set(0)}
        >
          <motion.div className="landing-hero" style={reduced || !size.height ? undefined : { y: titleY }}>
            <h1 id="landing-title">Make every word<br />worth watching.</h1>
            <p>Style captions for Reels, Shorts, and TikToks.</p>
            <div className="landing-actions">
              <Button variant="primary" size="lg" label="Open Gallery" icon={<ArrowRight size={17} />} onClick={onOpenGallery} className="landing-primary" />
              <a href="#styles" className="landing-secondary">See caption styles <ArrowDown size={14} aria-hidden="true" /></a>
            </div>
          </motion.div>

          <div className="landing-examples" aria-label="Caption style examples" style={{ '--reel-card-width': `${getCardWidth(size)}px` } as CSSProperties}>
            {examples.map((example, index) => (
              <ExampleCard key={example[0]} example={example} index={index} size={size} intro={intro} scroll={scroll} pointer={smoothPointer} reduced={reduced} />
            ))}
          </div>
          {!reduced && (
            <motion.p className="landing-scroll-prompt" style={{ opacity: promptOpacity }}>
              <ArrowDown size={15} aria-hidden="true" /> Scroll to explore
            </motion.p>
          )}
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
        <Button label="Start editing" variant="primary" size="lg" icon={<ArrowRight size={17} />} onClick={onOpenGallery} className="landing-primary" />
      </section>
    </div>
  );
}
