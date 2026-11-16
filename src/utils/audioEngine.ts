import { encodeWav16kMono } from './captions';

export type NoiseCleanStrength = 'clean' | 'strong';

export interface AudioGraphHandle {
  context: AudioContext;
  destinationStream: MediaStream;
  setImproveEnabled: (enabled: boolean, strength?: NoiseCleanStrength) => void;
  resumeIfNeeded: () => Promise<void>;
  sampleRmsPercent: () => number;
  dispose: () => void;
}

export function createAudioCleanGraph(videoEl: HTMLVideoElement): AudioGraphHandle | null {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    const ctx = new AudioCtx();
    const src = ctx.createMediaElementSource(videoEl);

    // Stage 1: Rumble / AC / wind high-pass filter
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 10;
    hp.Q.value = 0.7;

    // Stage 2: Room boxiness / 240Hz mud reducer
    const mudCut = ctx.createBiquadFilter();
    mudCut.type = 'peaking';
    mudCut.frequency.value = 240;
    mudCut.Q.value = 1.2;
    mudCut.gain.value = 0;

    // Stage 3: Vocal clarity presence boost around 3.2kHz
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3200;
    presence.Q.value = 1.05;
    presence.gain.value = 0;

    // Stage 4: High-frequency static / fan hiss low-pass filter
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 20000;
    lp.Q.value = 0.7;

    // Stage 5: Adaptive downward expander / noise gate
    const gate = ctx.createGain();
    gate.gain.value = 1;

    // Stage 6: Broadcast compressor & makeup gain
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = 0;
    comp.knee.value = 0;
    comp.ratio.value = 1;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;

    const makeup = ctx.createGain();
    makeup.gain.value = 1;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    const dest = ctx.createMediaStreamDestination();

    src.connect(hp);
    hp.connect(mudCut);
    mudCut.connect(presence);
    presence.connect(lp);
    lp.connect(gate);
    gate.connect(comp);
    comp.connect(makeup);
    makeup.connect(analyser);
    analyser.connect(ctx.destination);
    makeup.connect(dest);

    const buf = new Uint8Array(analyser.fftSize);
    let enabled = false;
    let currentStrength: NoiseCleanStrength = 'clean';
    let holdFrames = 0;

    const setImproveEnabled = (next: boolean, strength: NoiseCleanStrength = currentStrength) => {
      enabled = next;
      currentStrength = strength;
      const t = ctx.currentTime;
      if (next) {
        const strong = strength === 'strong';
        hp.frequency.setTargetAtTime(strong ? 150 : 105, t, 0.04);
        mudCut.gain.setTargetAtTime(strong ? -5.5 : -3.5, t, 0.04);
        presence.gain.setTargetAtTime(strong ? 4.2 : 2.8, t, 0.04);
        lp.frequency.setTargetAtTime(strong ? 6400 : 9200, t, 0.04);
        comp.threshold.setTargetAtTime(strong ? -24 : -20, t, 0.04);
        comp.knee.setTargetAtTime(16, t, 0.04);
        comp.ratio.setTargetAtTime(strong ? 7 : 5.5, t, 0.04);
        makeup.gain.setTargetAtTime(strong ? 1.65 : 1.45, t, 0.04);
      } else {
        hp.frequency.setTargetAtTime(10, t, 0.04);
        mudCut.gain.setTargetAtTime(0, t, 0.04);
        presence.gain.setTargetAtTime(0, t, 0.04);
        lp.frequency.setTargetAtTime(20000, t, 0.04);
        comp.threshold.setTargetAtTime(0, t, 0.04);
        comp.ratio.setTargetAtTime(1, t, 0.04);
        makeup.gain.setTargetAtTime(1, t, 0.04);
        gate.gain.setTargetAtTime(1, t, 0.03);
        holdFrames = 0;
      }
    };

    const sampleRmsPercent = (): number => {
      if (videoEl.paused) return 0;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      if (enabled) {
        const strong = currentStrength === 'strong';
        const threshold = strong ? 0.024 : 0.016;
        const floorGain = strong ? 0.04 : 0.1;
        if (rms < threshold) {
          holdFrames++;
          if (holdFrames >= 3) {
            gate.gain.setTargetAtTime(floorGain, ctx.currentTime, 0.06);
          }
        } else {
          holdFrames = 0;
          gate.gain.setTargetAtTime(1, ctx.currentTime, 0.015);
        }
      }
      return Math.min(100, Math.round(rms * 260));
    };

    const resumeIfNeeded = async () => {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    };

    const dispose = () => {
      try {
        src.disconnect();
        hp.disconnect();
        mudCut.disconnect();
        presence.disconnect();
        lp.disconnect();
        gate.disconnect();
        comp.disconnect();
        makeup.disconnect();
        analyser.disconnect();
        void ctx.close();
      } catch {
        // ignore close errors
      }
    };

    return {
      context: ctx,
      destinationStream: dest.stream,
      setImproveEnabled,
      resumeIfNeeded,
      sampleRmsPercent,
      dispose,
    };
  } catch {
    return null;
  }
}

export async function extractTrimmedWav(
  file: File,
  trimStart: number,
  trimEnd: number
): Promise<{ blob: Blob; offset: number; name: string }> {
  const ab = await file.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Browser Web Audio API is unavailable to decode this audio.');
  }
  const tmp = new AudioCtx();
  try {
    const decoded = await tmp.decodeAudioData(ab);
    const span = Math.max(0.2, trimEnd - trimStart);
    const len = Math.max(1, Math.round(span * 16000));
    const offline = new OfflineAudioContext(1, len, 16000);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0, trimStart, span);
    const rendered = await offline.startRendering();
    return {
      blob: encodeWav16kMono(rendered.getChannelData(0)),
      offset: trimStart,
      name: 'audio.wav',
    };
  } finally {
    try {
      await tmp.close();
    } catch {
      // ignore
    }
  }
}
