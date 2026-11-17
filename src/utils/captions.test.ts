import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSrt,
  captionsFromSegments,
  captionsFromText,
  captionsFromWords,
  classifyDroppedFile,
  commitCaptionHistory,
  createCaptionHistory,
  createNextCue,
  DEFAULT_STYLE_CONFIG,
  encodeWav16kMono,
  findActiveCaption,
  formatSec,
  formatSrtTime,
  getActiveWordIndex,
  getCaptionContainerSpec,
  getWordVisualSpec,
  mergeCaptionWithNext,
  parseSrt,
  redoCaptionHistory,
  shiftCaptions,
  snapCueStartToTime,
  splitCaption,
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

  const spotlightBig = getWordVisualSpec({
    style: 'st-font-switch',
    word: '$99',
    wordIndex: 0,
    activeWordIndex: 2,
    accentColor: '#22d3ee',
    revealMode: 'spotlight',
    effect: 'none',
    isSpotlightKey: true,
  });
  assert.ok(spotlightBig.scale >= 1.3);
  assert.equal(spotlightBig.color, '#22d3ee');

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



