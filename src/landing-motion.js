(() => {
  const showcase = document.querySelector('.showcase');
  const stage = showcase.querySelector('.showcase-stage');
  const ring = stage.querySelector('.showcase-ring');
  const copy = stage.querySelector('.showcase-copy');
  const cards = [...ring.querySelectorAll('.showcase-card')];
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const mix = (from, to, progress) => from + (to - from) * progress;
  const transform = (x, y, angle, scale = 1) =>
    `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`;

  let poses = [];
  let intro = [];
  let width, height, start, distance, radius, arcRadius, arcSpread;
  let frame = 0;
  let previousProgress;

  function stopIntro() {
    for (const animation of intro) animation.cancel();
    intro = [];
  }

  function measure() {
    const bounds = showcase.getBoundingClientRect();
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const sceneStart = bounds.top + scrollY;
    const scrollDistance = Math.max(1, bounds.height - stageHeight);
    // Read the same responsive radius the static CSS ring uses.
    const ringRadius = parseFloat(getComputedStyle(ring, '::before').width);
    if (width === stageWidth && height === stageHeight && start === sceneStart &&
        distance === scrollDistance && radius === ringRadius) return false;
    width = stageWidth;
    height = stageHeight;
    start = sceneStart;
    distance = scrollDistance;
    radius = ringRadius;
    arcRadius = Math.max(width * .61, height * .48);
    arcSpread = (width < 600 ? 3.8 : 2) * Math.asin(width * .44 / arcRadius);
    poses = cards.map((_, index) => {
      const turn = index / cards.length;
      const angle = turn * 2 * Math.PI;
      const position = index / (cards.length - 1) - .5;
      return {
        x: Math.sin(angle) * radius,
        y: -Math.cos(angle) * radius,
        rotation: turn > .5 ? (turn - 1) * 360 : turn * 360,
        position,
        scatter: transform(Math.sin(index * 9.37 + 1) * width * .44,
          Math.cos(index * 6.73 + 1) * height * .35, Math.sin(index * 2.15) * 58, .7),
        line: transform(position * width * .91, height * .13, 0),
      };
    });
    previousProgress = undefined;
    return true;
  }

  function renderScroll() {
    frame = 0;
    const progress = clamp((scrollY - start) / distance);
    if (progress === previousProgress) return;
    previousProgress = progress;

    const opening = clamp(progress / .30);
    const sweep = mix(.36, -.36, clamp((progress - .30) / .70));
    if (progress) stopIntro();
    copy.style.transform = progress ? `translateY(${-height * .28 * opening}px)` : '';
    cards.forEach((card, index) => {
      const pose = poses[index];
      const angle = (pose.position + sweep) * arcSpread;
      card.style.transform = progress ? transform(
        mix(pose.x, Math.sin(angle) * arcRadius, opening),
        mix(pose.y, height * .075 + arcRadius * (1 - Math.cos(angle)), opening),
        mix(pose.rotation, angle * 180 / Math.PI, opening),
        mix(1, 1.56, opening),
      ) : '';
    });
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(renderScroll);
  }

  function onResize() {
    if (!measure()) return;
    stopIntro();
    onScroll();
  }

  function setMotion(animateEntrance = false) {
    if (!motion.matches) {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
      frame = 0;
      previousProgress = undefined;
      stopIntro();
      delete showcase.dataset.motion;
      copy.style.transform = '';
      for (const card of cards) card.style.transform = '';
      return;
    }

    showcase.dataset.motion = '';
    measure();
    renderScroll();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize);
    if (!animateEntrance || scrollY || location.hash || !cards[0].animate) return;

    const easing = 'ease-in-out';
    intro = cards.map((card, index) => {
      const { scatter, line, x, y, rotation } = poses[index];
      return card.animate([
        { transform: scatter, opacity: .26, offset: 0 },
        { transform: scatter, opacity: .26, offset: .08, easing },
        { transform: line, opacity: 1, offset: .34 },
        { transform: line, opacity: 1, offset: .54, easing },
        { transform: transform(x, y, rotation), opacity: 1, offset: 1 },
      ], { duration: 2450 });
    });
  }

  setMotion(true);
  motion.addEventListener('change', () => setMotion());
})();
