export const PRODUCT_SUMMARY =
  'Caption Lite is a browser-based video caption editor for Reels, TikTok, and YouTube Shorts. Add animated captions, edit subtitle timing, and export watermark-free WebM video or separate SRT and WebVTT files.';

export const CAPTION_STEPS = [
  'Open the studio and choose a video or load the sample clip. Pick a vertical, square, or landscape frame and trim the clip.',
  'Add captions manually, paste a script, or import an SRT file. Use browser listening where supported or choose automatic transcription when the beta service is available.',
  'Review the words and timing, then choose a caption style, placement, and accent color.',
  'Export a WebM video with captions burned in, or download an SRT or WebVTT subtitle file.',
];

export const CAPTION_FAQ = [
  {
    question: 'Can I add subtitles without uploading my video?',
    answer: 'Yes. Manual caption editing, SRT import, styling, and video export run in your browser. Beta automatic transcription sends audio or video to the transcription service. AI text refinement sends caption text.',
  },
  {
    question: 'Does Caption Lite add a watermark?',
    answer: 'Caption Lite exports WebM video with burned-in captions and no watermark. You can also download SRT or WebVTT subtitle files separately.',
  },
  {
    question: 'Do I need an account to caption a video?',
    answer: 'You can edit and export locally without an account. Google sign-in is used for cloud project sync and for beta AI tools when they are available.',
  },
  {
    question: 'What is the difference between burned-in captions and an SRT file?',
    answer: 'Burned-in captions are part of the exported video and preserve your chosen style. An SRT file contains subtitle text and timing, so you can upload it separately to a compatible platform.',
  },
];
