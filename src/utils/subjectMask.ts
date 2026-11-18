// The model is only requested by the behind-subject style. All video stays in this tab.
import type { Results, SelfieSegmentation } from '@mediapipe/selfie_segmentation';

const assetUrls = import.meta.glob('/node_modules/@mediapipe/selfie_segmentation/*.{wasm,data,binarypb,tflite,js}', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
}) as Record<string, string>;

let runtime: Promise<typeof SelfieSegmentation> | undefined;
let engine: Promise<SelfieSegmentation> | undefined;
let onResult: ((result: Results) => void) | undefined;
let queue = Promise.resolve();

function loadRuntime() {
  runtime ??= new Promise<typeof SelfieSegmentation>((resolve, reject) => {
    // The legacy browser distribution attaches its constructor to window.
    const script = document.createElement('script');
    script.src = assetUrls['/node_modules/@mediapipe/selfie_segmentation/selfie_segmentation.js'];
    script.onload = () => {
      const constructor = (window as Window & { SelfieSegmentation?: typeof SelfieSegmentation }).SelfieSegmentation;
      if (constructor) resolve(constructor);
      else reject(new Error('Could not initialize the subject segmentation runtime.'));
    };
    script.onerror = () => reject(new Error('Could not load the subject segmentation runtime.'));
    document.head.append(script);
  }).catch((error) => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}

async function loadEngine() {
  const Segmenter = await loadRuntime();
  const segmenter = new Segmenter({
    locateFile: (name) => {
      const url = assetUrls[`/node_modules/@mediapipe/selfie_segmentation/${name}`];
      if (!url) throw new Error(`Missing subject model asset: ${name}`);
      return url;
    },
  });
  segmenter.setOptions({ modelSelection: 0, selfieMode: false });
  segmenter.onResults((result) => onResult?.(result));
  try {
    await segmenter.initialize();
    return segmenter;
  } catch (error) {
    await segmenter.close().catch(() => {});
    throw error;
  }
}

export function loadSubjectMask() {
  engine ??= loadEngine().catch((error) => {
    engine = undefined;
    throw error;
  });
  return engine;
}

export function createSubjectMask() {
  const input = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const inputContext = input.getContext('2d')!;
  const maskContext = mask.getContext('2d')!;
  let ready = false;
  let generation = 0;

  return {
    clear() {
      generation++;
      ready = false;
    },
    update(video: HTMLVideoElement) {
      const version = generation;
      const task = queue.then(async () => {
        const segmenter = await loadSubjectMask();
        if (version !== generation || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
        const ratio = Math.min(1, 360 / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.max(1, Math.round(video.videoWidth * ratio));
        const height = Math.max(1, Math.round(video.videoHeight * ratio));
        if (width !== input.width || height !== input.height) {
          input.width = mask.width = width;
          input.height = mask.height = height;
        }
        inputContext.drawImage(video, 0, 0, width, height);
        onResult = ({ segmentationMask }) => {
          if (version !== generation) return;
          maskContext.clearRect(0, 0, width, height);
          maskContext.drawImage(segmentationMask, 0, 0, width, height);
          ready = true;
        };
        try {
          await segmenter.send({ image: input });
        } finally {
          onResult = undefined;
        }
      });
      queue = task.catch(() => {});
      return task;
    },
    drawForeground(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, outputWidth: number, outputHeight: number) {
      if (!ready || video.readyState < 2) return;
      const scale = Math.max(outputWidth / video.videoWidth, outputHeight / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      const x = (outputWidth - width) / 2;
      const y = (outputHeight - height) / 2;
      ctx.clearRect(0, 0, outputWidth, outputHeight);
      ctx.drawImage(mask, x, y, width, height);
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(video, x, y, width, height);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
