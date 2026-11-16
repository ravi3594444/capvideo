import type { CaptionPosition, CaptionStyle } from './captions';

export interface ReferenceAnalysis {
  hex: string;
  position: CaptionPosition;
  positionLabel: string;
  style: CaptionStyle;
  styleLabel: string;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onDone = () => {
      video.removeEventListener('seeked', onDone);
      resolve();
    };
    video.addEventListener('seeked', onDone);
    try {
      video.currentTime = t;
    } catch {
      resolve();
    }
    setTimeout(resolve, 1200);
  });
}

interface BandStats {
  n: number;
  cols: Record<string, { n: number; r: number; g: number; b: number }>;
}

function analyseFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bands: { top: BandStats; mid: BandStats; bot: BandStats } = {
    top: { n: 0, cols: {} },
    mid: { n: 0, cols: {} },
    bot: { n: 0, cols: {} },
  };
  let img: Uint8ClampedArray;
  try {
    img = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  for (let y = 0; y < h; y += 3) {
    const band = y < h * 0.33 ? bands.top : y > h * 0.66 ? bands.bot : bands.mid;
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      const r = img[i];
      const g = img[i + 1];
      const b = img[i + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const bright = mx > 185;
      const sat = mx - mn > 70 && mx > 110;
      if (!bright && !sat) continue;
      if (!sat && !(mx > 225 && mn > 190)) continue;
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      if (!band.cols[key]) band.cols[key] = { n: 0, r: 0, g: 0, b: 0 };
      band.cols[key].n++;
      band.cols[key].r += r;
      band.cols[key].g += g;
      band.cols[key].b += b;
      band.n++;
    }
  }
  return bands;
}

function topBandColor(band: BandStats): { hex: string; n: number } | null {
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const k of Object.keys(band.cols)) {
    const c = band.cols[k];
    if (!best || c.n > best.n) best = c;
  }
  if (!best || best.n < 12) return null;
  return {
    hex: rgbToHex(Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)),
    n: best.n,
  };
}

export async function analyzeReferenceVideo(refVideo: HTMLVideoElement): Promise<ReferenceAnalysis | null> {
  const wasPaused = refVideo.paused;
  refVideo.pause();
  const dur = refVideo.duration || 0;
  const times = dur ? [dur * 0.25, dur * 0.5, dur * 0.75] : [0.5];

  const cv = document.createElement('canvas');
  cv.width = 144;
  cv.height = Math.max(80, Math.round((144 * (refVideo.videoHeight || 9)) / Math.max(1, refVideo.videoWidth || 16)));
  const cx = cv.getContext('2d', { willReadFrequently: true });
  if (!cx) return null;

  const totals = { top: 0, mid: 0, bot: 0 };
  const colourVotes: Record<string, number> = {};

  for (const t of times) {
    await seekVideo(refVideo, t);
    cx.drawImage(refVideo, 0, 0, cv.width, cv.height);
    const bands = analyseFrame(cx, cv.width, cv.height);
    if (!bands) continue;
    (['top', 'mid', 'bot'] as const).forEach((name) => {
      totals[name] += bands[name].n;
      const tc = topBandColor(bands[name]);
      if (tc) {
        colourVotes[tc.hex] = (colourVotes[tc.hex] || 0) + tc.n;
      }
    });
  }

  if (!wasPaused) {
    refVideo.play().catch(() => {});
  }

  let bestHex: string | null = null;
  let bestN = 0;
  for (const hx of Object.keys(colourVotes)) {
    if (colourVotes[hx] > bestN) {
      bestN = colourVotes[hx];
      bestHex = hx;
    }
  }
  if (!bestHex) return null;

  let position: CaptionPosition = 'pos-bottom';
  let positionLabel = 'Bottom';
  if (totals.mid > totals.bot && totals.mid > totals.top) {
    position = 'pos-centre';
    positionLabel = 'Centre';
  } else if (totals.top > totals.bot * 1.6) {
    position = 'pos-centre';
    positionLabel = 'Centre / upper';
  } else if (totals.bot < totals.mid * 0.7) {
    position = 'pos-third';
    positionLabel = 'Lower third';
  }

  const distinct = Object.keys(colourVotes).length;
  let style: CaptionStyle = 'st-highlight';
  let styleLabel = 'Highlight';
  const pr = parseInt(bestHex.slice(1, 3), 16);
  const pg = parseInt(bestHex.slice(3, 5), 16);
  const pb = parseInt(bestHex.slice(5, 7), 16);

  if (distinct >= 3) {
    style = 'st-cycle';
    styleLabel = 'Colour Cycle (multiple vibrant hues)';
  } else if (pr > 225 && pg > 225 && pb > 225) {
    style = 'st-classic';
    styleLabel = 'Classic (clean white captions)';
  }

  return { hex: bestHex, position, positionLabel, style, styleLabel };
}
