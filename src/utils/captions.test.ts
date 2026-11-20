import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSrt,
  captionsFromSegments,
  captionsFromText,
  captionsFromWords,
  classifyDroppedFile,
  clampTextHeight,
  clampVerticalPosition,
  commitCaptionHistory,
  createCaptionHistory,
  createNextCue,
  CURATED_PRESET_PACKS,
  DEFAULT_STYLE_CONFIG,
  encodeWav16kMono,
  findActiveCaption,
  findStylePreviewCaption,
  formatSec,
  formatSrtTime,
  getActiveWordIndex,
  getCaptionWordClock,
  getCaptionBlockMotion,
  getCaptionDisplayRows,
  getCaptionFit,
  getCaptionFontStack,
  getCaptionPlacement,
  getCaptionTimelineLayout,
  getDepthRowAppearance,
  getCaptionContainerSpec,
  getCaptionHeadlineIndex,
  getCaptionWordRows,
  getWordVisualSpec,
  getWordVerticalPadding,
  mergeCaptionWithNext,
  parseSrt,
  redoCaptionHistory,
  shiftCaptions,
  snapCueStartToTime,
  splitCaption,
  STYLE_PREVIEW_SAMPLE,
  undoCaptionHistory,
} from './captions';
import { parseStudioDraft, serializeStudioDraft } from './draftStorage';

test('formatSec and formatSrtTime format timestamps accurately', () => {
  assert.equal(formatSec(12.34), '12.3s');
  assert.equal(formatSrtTime(0), '00:00:00,000');
  assert.equal(formatSrtTime(3661.25), '01:01:01,250');
});

test('buildSrt and parseSrt round-trip with trim offset', () => {
  const cues = [
    { id: 'c1', start: 5.0, end: 7.5, text: 'Hello creator world' },
    { id: 'c2', start: 8.0, end: 10.2, text: 'Captions without watermarks' },
    { id: 'c3', start: 11.0, end: 12.0, text: '   ' },
  ];
  const srt = buildSrt(cues, 5.0);
  assert.match(srt, /00:00:00,000 --> 00:00:02,500/);
  assert.match(srt, /00:00:03,000 --> 00:00:05,200/);
  assert.doesNotMatch(srt, /^3$/m);

  const reParsed = parseSrt(srt, 5.0);
  assert.equal(reParsed.length, 2);
  assert.equal(reParsed[0].start, 5);
  assert.equal(reParsed[0].end, 7.5);
  assert.equal(reParsed[0].text, 'Hello creator world');
});

test('captionsFromWords groups words into 5-word cues inside trim window', () => {
  const words = [
    { word: 'skipped', start: 0.1, end: 0.4 },
    { punctuated_word: 'One', start: 1.0, end: 1.2 },
    { punctuated_word: 'two', start: 1.3, end: 1.5 },
    { punctuated_word: 'three', start: 1.6, end: 1.8 },
    { punctuated_word: 'four', start: 1.9, end: 2.1 },
    { punctuated_word: 'five', start: 2.2, end: 2.4 },
    { punctuated_word: 'six.', start: 2.5, end: 2.8 },
  ];
  const cues = captionsFromWords(words, 0, 1.0, 5.0);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'One two three four five');
  assert.equal(cues[1].text, 'six.');
});

test('spoken emphasis uses uneven source timings after regrouping, splitting and reloading', () => {
  const [cue] = captionsFromWords([
    { word: 'Make', start: 0.12, end: 0.2 },
    { word: 'it', start: 0.22, end: 0.33 },
    { word: 'count', start: 0.96, end: 1.43 },
  ]);
  assert.equal(getActiveWordIndex(cue, 0.85), 1);
  assert.equal(getActiveWordIndex(cue, 0.97), 2);
  assert.equal(getActiveWordIndex({ ...cue, wordTiming: undefined }, 0.85), 1);
  assert.equal(getActiveWordIndex({ ...cue, wordTiming: undefined }, 0.93), 1);
  assert.equal(getActiveWordIndex({ ...cue, text: 'Make it worthwhile' }, 0.85), 1);
  assert.equal(getActiveWordIndex(regroupCaptionsSmart([cue], '3')[0], 0.97), 2);
  const [, tail] = splitCaption(cue)!;
  assert.equal(tail.start, 0.96);
  assert.ok(Math.abs(getCaptionWordClock(tail, 1).elapsed - 0.04) < 0.001);
  const draft = parseStudioDraft(JSON.stringify({ captions: [cue] }))!;
  assert.equal(getActiveWordIndex(draft.captions[0], 0.97), 2);
});

test('captionsFromSegments and captionsFromText split long lines cleanly', () => {
  const segCues = captionsFromSegments(
    [{ text: 'one two three four five six seven', start: 2, end: 6 }],
    0,
    0,
    10
  );
  assert.equal(segCues.length, 2);
  assert.equal(segCues[0].text, 'one two three four five');
  assert.equal(segCues[1].text, 'six seven');

  const txtCues = captionsFromText('alpha beta gamma delta epsilon zeta', 1, 5);
  assert.equal(txtCues.length, 2);
});

test('findActiveCaption, getActiveWordIndex, and splitCaption behave deterministically', () => {
  const cues = [
    { id: '1', start: 1, end: 3, text: 'Alpha beta gamma delta' },
    { id: '2', start: 4, end: 6, text: 'Epsilon' },
  ];
  assert.equal(findActiveCaption(cues, 0.5), null);
  assert.equal(findActiveCaption(cues, 1.6)?.id, '1');
  assert.equal(getActiveWordIndex(cues[0], 1.1), 0);
  assert.equal(getActiveWordIndex(cues[0], 2.9), 3);

  const split = splitCaption(cues[0]);
  assert.ok(split);
  assert.equal(split[0].text, 'Alpha beta');
  assert.equal(split[1].text, 'gamma delta');
  assert.equal(splitCaption(cues[1]), null);
});

test('shiftCaptions nudges timings safely and mergeCaptionWithNext combines adjacent cues', () => {
  const cues = [
    { id: 'a', start: 0.2, end: 1.2, text: 'First line' },
    { id: 'b', start: 1.4, end: 2.6, text: 'second line' },
  ];
  const shiftedForward = shiftCaptions(cues, 0.5, 3.0);
  assert.equal(shiftedForward[0].start, 0.7);
  assert.equal(shiftedForward[1].end, 3.0);

  const shiftedBack = shiftCaptions(cues, -1.0);
  assert.equal(shiftedBack[0].start, 0);
  assert.equal(shiftedBack[0].end, 1.0);

  const merged = mergeCaptionWithNext(cues, 'a');
  assert.equal(merged.length, 1);
  assert.equal(merged[0].start, 0.2);
  assert.equal(merged[0].end, 2.6);
  assert.equal(merged[0].text, 'First line second line');
});

test('encodeWav16kMono produces valid RIFF WAVE header', async () => {
  const blob = encodeWav16kMono(new Float32Array([0, 0.5, -0.5, 0]));
  assert.equal(blob.type, 'audio/wav');
  assert.equal(blob.size, 44 + 8);
  const buf = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...buf.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...buf.slice(8, 12)), 'WAVE');
});

test('CaptionHistory commits, deduplicates, undoes, redoes, and caps history', () => {
  const initial = [{ id: '1', start: 0, end: 1, text: 'Hello' }];
  let state = createCaptionHistory(initial);
  assert.equal(commitCaptionHistory(state, initial), state);

  state = commitCaptionHistory(state, [{ id: '1', start: 0, end: 1, text: 'Hello world' }]);
  state = commitCaptionHistory(state, [{ id: '1', start: 0, end: 1, text: 'Final' }], 2);
  state = commitCaptionHistory(state, [{ id: '1', start: 0, end: 1, text: 'Overflow' }], 2);
  assert.equal(state.past.length, 2);
  assert.equal(state.present[0].text, 'Overflow');

  state = undoCaptionHistory(state);
  assert.equal(state.present[0].text, 'Final');
  assert.equal(state.future.length, 1);

  state = redoCaptionHistory(state);
  assert.equal(state.present[0].text, 'Overflow');
  assert.equal(state.future.length, 0);
});

test('classifyDroppedFile distinguishes video, srt, and unsupported files', () => {
  assert.equal(classifyDroppedFile({ name: 'reel.mp4', type: 'video/mp4' }), 'video');
  assert.equal(classifyDroppedFile({ name: 'clip.WEBM', type: '' }), 'video');
  assert.equal(classifyDroppedFile({ name: 'captions.srt', type: 'text/plain' }), 'srt');
  assert.equal(classifyDroppedFile({ name: 'photo.png', type: 'image/png' }), 'unsupported');
});

test('parseStudioDraft validates and sanitizes corrupted or malformed drafts', () => {
  assert.equal(parseStudioDraft(null), null);
  assert.equal(parseStudioDraft('{bad json'), null);

  const validRaw = serializeStudioDraft({
    projectTitle: 'My Launch Clip',
    aspect: 'r11',
    language: 'es-ES',
    loopClip: true,
    styleConfig: { ...DEFAULT_STYLE_CONFIG, fontSize: 99, accentColor: 'not-hex' },
    captions: [{ id: 'c1', start: -2, end: 0, text: 'Hola creators' }],
    updatedAt: 123456,
  });
  const parsed = parseStudioDraft(validRaw);
  assert.ok(parsed);
  assert.equal(parsed.projectTitle, 'My Launch Clip');
  assert.equal(parsed.aspect, 'r11');
  assert.equal(parsed.loopClip, true);
  assert.equal(parsed.styleConfig.fontSize, 38);
  assert.equal(parsed.styleConfig.accentColor, DEFAULT_STYLE_CONFIG.accentColor);
  assert.equal(parsed.captions[0].start, 0);
  assert.equal(parsed.captions[0].end, 0.1);
});

test('createNextCue and snapCueStartToTime advance sequentially and snap cleanly', () => {
  const existing = [{ id: 'c1', start: 0.2, end: 2.2, text: 'First' }];
  const appended = createNextCue(existing, 0, 0, 10, false);
  assert.equal(appended.start, 2.2);
  assert.equal(appended.end, 4.2);

  const snapped = snapCueStartToTime(existing[0], 5.4, 8.0);
  assert.equal(snapped.start, 5.4);
  assert.equal(snapped.end, 7.4);
});

test('curated headline, outline, and label treatments resolve from saved style settings', () => {
  const settings = (id: string) => ({ ...DEFAULT_STYLE_CONFIG, ...CURATED_PRESET_PACKS.find(pack => pack.id === id)?.apply });
  const cue = { id: 'headline', start: 0, end: 2, text: 'Make every word count.', keyWords: ['word'] };
  const words = cue.text.split(' ');
  const headline = settings('pack-headline-beat');
  const index = getCaptionHeadlineIndex(cue, words, headline.style, headline.effect ?? 'none');
  assert.deepEqual(getCaptionWordRows(words, index, 4).map(row => row.map(item => item.word)), [['Make', 'every'], ['word'], ['count.']]);
  const comic = settings('pack-comic-beat');
  const comicWord = getWordVisualSpec({ ...comic, word: 'word', wordIndex: 2, activeWordIndex: 2 });
  assert.equal(comicWord.outlineColor, '#ffffff');
  assert.equal(comicWord.displayText, 'WORD');
  const label = settings('pack-white-label');
  assert.equal(getCaptionContainerSpec(label.style, label.effect, label.accentColor).backdropColor, '#f9f8f6');
});

test('getWordVisualSpec supports zero-background minimal, cinema bar, and spoken-moment font switching', () => {
  const minimal = getWordVisualSpec({
    style: 'st-minimal',
    fontFamily: 'system',
    word: 'clean',
    wordIndex: 0,
    activeWordIndex: 0,
    accentColor: '#ffd60a',
  });
  assert.equal(minimal.backgroundColor, null);
  assert.equal(minimal.scale, 1);
  assert.match(minimal.fontCss, /system-ui/);

  const inactiveSwitch = getWordVisualSpec({
    style: 'st-font-switch',
    fontFamily: 'manrope',
    word: 'watch',
    wordIndex: 0,
    activeWordIndex: 1,
    accentColor: '#22d3ee',
  });
  const activeSwitch = getWordVisualSpec({
    style: 'st-font-switch',
    fontFamily: 'manrope',
    word: 'this',
    wordIndex: 1,
    activeWordIndex: 1,
    accentColor: '#22d3ee',
  });
  assert.match(inactiveSwitch.fontCss, /Manrope/);
  assert.equal(inactiveSwitch.fontStyle, 'normal');
  assert.match(activeSwitch.fontCss, /Playfair Display/);
  assert.equal(activeSwitch.fontStyle, 'italic');
  assert.equal(activeSwitch.color, '#22d3ee');
  assert.equal(activeSwitch.backgroundColor, null);

  const activeSnap = getWordVisualSpec({
    style: 'st-font-snap',
    fontFamily: 'manrope',
    word: 'now',
    wordIndex: 2,
    activeWordIndex: 2,
    accentColor: '#ffd60a',
  });
  assert.match(activeSnap.fontCss, /Oswald/);
  assert.equal(activeSnap.displayText, 'NOW');

  const cinemaContainer = getCaptionContainerSpec('st-cinema');
  assert.equal(cinemaContainer.hasFullLineBackdrop, true);
  assert.ok(cinemaContainer.backdropColor);
});

import {
  buildPlainTranscript,
  buildVtt,
  clampWordSpacing,
  extractAutoKeyWords,
  findPreviousCaption,
  isNegativeEmphasisWord,
  isWordSpotlightKey,
  regroupCaptionsSmart,
  removeFillerWordsFromCues,
  toggleCueKeyWord,
} from './captions';

test('regroupCaptionsSmart enforces break rules for numbers, titles, sentences, and pause hold', () => {
  const input = [
    {
      id: 'r1',
      start: 0,
      end: 3.6,
      text: 'Do three push-ups with Dr. Smith today. It will work great!',
    },
    {
      id: 'r2',
      start: 6.0,
      end: 7.0,
      text: 'Done fast',
    },
  ];
  const regrouped = regroupCaptionsSmart(input, '2', 0.8);
  assert.ok(regrouped.length >= 3);
  // Sentence boundary "." forces break cleanly between sentences
  const sentenceBreakIdx = regrouped.findIndex((c) => c.text.includes('today.'));
  assert.ok(sentenceBreakIdx >= 0);
  assert.ok(!regrouped[sentenceBreakIdx].text.includes('It will'));
  // Title "Dr." stays bound with "Smith"
  assert.ok(regrouped.some((c) => c.text.includes('Dr. Smith')));
  // Number "three" stays bound with "push-ups"
  assert.ok(regrouped.some((c) => c.text.includes('three push-ups')));
  // Weak word "will" is not left stranded at end of a multi-word page
  assert.ok(!regrouped.some((c) => /\bwill$/i.test(c.text.trim())));
  // Pause hold extends short caption end safely without overlapping next cue at 6.0s
  const lastBeforeGap = regrouped[regrouped.length - 2];
  assert.ok(lastBeforeGap.end < 6.0);
});

test('Spotlight auto key words highlight numbers, prices, entities, negative words, and support manual toggle', () => {
  const cue = { id: 'k1', start: 0, end: 2, text: 'Save $49 in Tokyo never stop' };
  const auto = extractAutoKeyWords(cue.text);
  assert.ok(auto.includes('$49'));
  assert.ok(auto.includes('tokyo'));
  assert.ok(auto.includes('never'));
  assert.equal(isNegativeEmphasisWord('never'), true);
  assert.equal(isWordSpotlightKey('$49', cue, true), true);

  const toggledOff = toggleCueKeyWord(cue, '$49', true);
  assert.equal(isWordSpotlightKey('$49', toggledOff, true), false);

  const toggledOn = toggleCueKeyWord(toggledOff, 'Save', true);
  assert.equal(isWordSpotlightKey('Save', toggledOn, true), true);
});

test('emphasis ranks short hooks, skips hesitations, and pulses only on the selected beat', () => {
  assert.deepEqual(extractAutoKeyWords('Eee umm like'), []);
  assert.deepEqual(extractAutoKeyWords('Make it count.'), ['count']);
  assert.deepEqual(extractAutoKeyWords('Only ₹499 today.'), ['₹499']);
  assert.deepEqual(extractAutoKeyWords('Speed vs quality').sort(), ['quality', 'speed']);
  const settings = {
    ...DEFAULT_STYLE_CONFIG,
    word: 'count',
    wordIndex: 2,
    activeWordIndex: 2,
    wordDurationSec: 0.4,
    cueElapsedSec: 0.8,
  };
  const settled = getWordVisualSpec({ ...settings, isSpotlightKey: true, wordElapsedSec: 0.37 });
  const peak = getWordVisualSpec({ ...settings, isSpotlightKey: true, wordElapsedSec: 0.07 });
  const ordinary = getWordVisualSpec({ ...settings, isSpotlightKey: false, wordElapsedSec: 0.07 });
  assert.ok(peak.scale > settled.scale);
  assert.equal(ordinary.scale, settled.scale);
  assert.equal(getCaptionHeadlineIndex({ id: 'plain', start: 0, end: 1, text: 'Make it count.', keyWords: [] }, ['Make', 'it', 'count.'], 'st-minimal', 'scaleUp'), -1);
});

test('calm captions emphasize with color or a keyword tag without enlarging the text', () => {
  const look = (id: string) => ({ ...DEFAULT_STYLE_CONFIG, ...CURATED_PRESET_PACKS.find(pack => pack.id === id)?.apply });
  const beat = { word: 'count', wordIndex: 2, activeWordIndex: 2, wordElapsedSec: 0.07, isSpotlightKey: true };
  const accent = look('pack-color-spotlight');
  const colored = getWordVisualSpec({ ...accent, ...beat });
  assert.equal(colored.color, '#bcf57a');
  assert.equal(colored.scale, 1);
  assert.equal(colored.backgroundColor, null);
  const tag = look('pack-lavender-note');
  assert.equal(getWordVisualSpec({ ...tag, ...beat }).backgroundColor, '#d3c1fd');
  const ordinaryWord = getWordVisualSpec({ ...tag, ...beat, isSpotlightKey: false });
  assert.equal(ordinaryWord.color, '#ffffff');
  assert.equal(ordinaryWord.backgroundColor, null);
});

test('removeFillerWordsFromCues, buildVtt, buildPlainTranscript, and two-axis animations work cleanly', () => {
  const cleaned = removeFillerWordsFromCues([
    { id: 'f1', start: 0, end: 2, text: 'Um hello, uh watch this!' },
    { id: 'f2', start: 2, end: 3, text: 'um' },
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].text, 'hello, watch this!');

  const vtt = buildVtt(cleaned, 0);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:00\.000 --> 00:00:02\.000/);
  assert.equal(buildPlainTranscript(cleaned), 'hello, watch this!');

  const popHidden = getWordVisualSpec({
    style: 'st-pop',
    word: 'wait',
    wordIndex: 0,
    activeWordIndex: 1,
    accentColor: '#ffd60a',
    revealMode: 'pop',
    effect: 'glitch',
    currentTimeSec: 0.4,
  });
  assert.equal(popHidden.isHidden, true);

  const spotlightColor = getWordVisualSpec({
    style: 'st-font-switch',
    word: '$99',
    wordIndex: 0,
    activeWordIndex: 2,
    accentColor: '#22d3ee',
    revealMode: 'spotlight',
    effect: 'none',
    isSpotlightKey: true,
  });
  assert.equal(spotlightColor.scale, 1);
  assert.equal(spotlightColor.color, '#22d3ee');

  const prev = findPreviousCaption(
    [
      { id: 'p1', start: 0, end: 1.5, text: 'Line one' },
      { id: 'p2', start: 1.6, end: 3.0, text: 'Line two' },
    ],
    { id: 'p2', start: 1.6, end: 3.0, text: 'Line two' }
  );
  assert.equal(prev?.id, 'p1');
});

test('clampWordSpacing bounds values and parseStudioDraft persists wordSpacing cleanly', () => {
  assert.equal(clampWordSpacing(undefined), 0.26);
  assert.equal(clampWordSpacing(-1), 0.06);
  assert.equal(clampWordSpacing(2.5), 0.9);
  assert.equal(clampWordSpacing(0.484), 0.48);

  const parsed = parseStudioDraft(
    JSON.stringify({
      projectTitle: 'Spacing Test',
      aspect: 'r916',
      language: 'en-US',
      loopClip: false,
      styleConfig: { ...DEFAULT_STYLE_CONFIG, wordSpacing: 0.64 },
      captions: [{ id: 'c1', start: 0, end: 1.2, text: 'Wide gap' }],
      updatedAt: 1000,
    })
  );
  assert.ok(parsed);
  assert.equal(parsed?.styleConfig.wordSpacing, 0.64);
});





test('custom text height fits without changing width and caption placement stays within safe margins', () => {
  assert.equal(clampTextHeight(undefined), 100);
  assert.equal(clampTextHeight(220), 180);
  assert.equal(clampVerticalPosition(-10), 0);
  assert.equal(clampVerticalPosition(NaN), undefined);
  assert.deepEqual(getCaptionFit(100, 80, 160, 100, 1.8), { x: 1, y: 1.25 });
  assert.deepEqual(getCaptionFit(200, 80, 100, 100, 0.6), { x: 0.5, y: 0.3 });
  assert.deepEqual(getCaptionPlacement({ position: 'pos-centre' }), { anchor: 0.5, origin: 0.5, safeHeight: 0.92 });
  assert.deepEqual(getCaptionPlacement({ position: 'pos-bottom', verticalPosition: 0 }), { anchor: 0.06, origin: 0, safeHeight: 0.88 });
  assert.deepEqual(getCaptionPlacement({ position: 'pos-centre', verticalPosition: 100 }), { anchor: 0.94, origin: 1, safeHeight: 0.88 });

  const draft = parseStudioDraft(JSON.stringify({
    styleConfig: { ...DEFAULT_STYLE_CONFIG, textHeight: 155, verticalPosition: 0 }, captions: [],
  }));
  assert.equal(draft?.styleConfig.textHeight, 155);
  assert.equal(draft?.styleConfig.verticalPosition, 0);
  const legacy = parseStudioDraft(JSON.stringify({ styleConfig: DEFAULT_STYLE_CONFIG, captions: [] }));
  assert.equal(legacy?.styleConfig.textHeight, 100);
  assert.equal(legacy?.styleConfig.verticalPosition, undefined);
});

test('style preview selects a nearby caption outside timed playback', () => {
  const opening = { id: 'one', start: 1, end: 2, text: 'Opening caption' };
  const closing = { id: 'two', start: 4, end: 5, text: 'Closing caption' };
  const blank = { id: 'blank', start: 2, end: 4, text: '   ' };
  const cues = [closing, opening, blank];
  assert.equal(findStylePreviewCaption(cues, 0), opening);
  assert.equal(findStylePreviewCaption(cues, 1.5), opening);
  assert.equal(findStylePreviewCaption(cues, 3.75), closing);
  assert.equal(findStylePreviewCaption(cues, 5), closing);
  assert.equal(findStylePreviewCaption([blank], 3), STYLE_PREVIEW_SAMPLE);
  assert.equal(findActiveCaption(cues, 5), null);
});

test('the font picker overrides single-font styles and keeps font-switch accents', () => {
  const word = { word: 'Hello', wordIndex: 0, activeWordIndex: 0, accentColor: '#ffd60a' };
  for (const style of ['st-behind-subject', 'st-editorial', 'st-typewriter', 'st-hormozi'] as const) {
    const chosen = getWordVisualSpec({ ...word, style, fontFamily: 'system' });
    assert.equal(chosen.fontCss, getCaptionFontStack('system'));
  }
  assert.equal(getWordVisualSpec({ ...word, style: 'st-editorial' }).fontCss, getCaptionFontStack('editorial'));
  assert.equal(getWordVisualSpec({ ...word, style: 'st-font-switch', fontFamily: 'mono' }).fontCss, getCaptionFontStack('editorial'));
  assert.equal(getWordVisualSpec({ ...word, style: 'st-font-switch', fontFamily: 'mono', activeWordIndex: 1 }).fontCss, getCaptionFontStack('mono'));
});

test('timeline separates overlapping clips and selects the newest active line', () => {
  const first = { id: 'one', start: 0.5, end: 3, text: 'First line' };
  const second = { id: 'two', start: 1.25, end: 2, text: 'Second line' };
  const third = { id: 'three', start: 2.5, end: 4, text: 'Third line' };
  const short = { id: 'tail', start: 4.99, end: 5, text: 'End' };
  const cues = [first, second, third, short];
  const { clips, laneCount } = getCaptionTimelineLayout(cues, 5);
  assert.equal(laneCount, 2);
  assert.deepEqual(clips.map(clip => clip.lane), [0, 1, 1, 0]);
  assert.equal(clips.at(-1)!.left + clips.at(-1)!.width, 100);
  assert.equal(findActiveCaption(cues, 1.5), second);
  assert.equal(findActiveCaption(cues, 2.2), first);
  assert.equal(findStylePreviewCaption(cues, 2.75), third);
});

test('animated words reserve room above and below their line', () => {
  assert.deepEqual(getWordVerticalPadding(120, 30, 1, 0, 0), { above: 0, below: 0 });
  assert.deepEqual(getWordVerticalPadding(120, 32, 1.5, -4, 0), { above: 12, below: 4 });
  const rotated = getWordVerticalPadding(120, 30, 1, 4, -8);
  assert(rotated.above > 0 && rotated.below > rotated.above);
});

test('depth captions drift as a large, two-tone stack and hero motion follows a marked word', () => {
  const cue = { id: 'test', text: 'Captions behind subjects', keyWords: ['behind'], start: 0, end: 3 };
  const config = { ...DEFAULT_STYLE_CONFIG, style: 'st-behind-subject' as const };
  const rows = getCaptionDisplayRows(config, cue.text.split(' '), -1);
  assert.deepEqual(rows.map(row => row.map(({ word }) => word)), [['Captions'], ['behind', 'subjects']]);
  assert.equal(getDepthRowAppearance(config.style, 1, '#e7fa69').color, '#e7fa69');
  const start = getCaptionBlockMotion(config.style, cue, 0);
  const end = getCaptionBlockMotion(config.style, cue, 3);
  assert.ok(start.fontScale > 1.5);
  assert.ok(start.shift > 0 && end.shift < 0);
  assert.equal(getCaptionBlockMotion('st-hero-moment', cue, 0.2).blockScale, 1);
  assert.ok(getCaptionBlockMotion('st-hero-moment', cue, 1.18).blockScale > 1.4);
  assert.equal(getCaptionBlockMotion('st-hero-moment', cue, 2.18).blockScale, 1);
});
