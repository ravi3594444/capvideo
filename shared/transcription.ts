// Leave room for multipart headers below the Vercel Functions request limit.
export const DIRECT_TRANSCRIPTION_BYTES = 4_000_000;
export const MAX_TRANSCRIPTION_BYTES = 50_000_000;

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mpeg: 'video/mpeg',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  '3gp': 'video/3gpp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
};

export const TRANSCRIPTION_CONTENT_TYPES = new Set([
  ...Object.values(CONTENT_TYPE_BY_EXTENSION), 'audio/webm', 'audio/x-wav', 'audio/x-m4a',
]);

export function getTranscriptionContentType(file: Pick<File, 'type' | 'name'>) {
  const type = file.type.split(';', 1)[0].toLowerCase();
  if (TRANSCRIPTION_CONTENT_TYPES.has(type)) return type;

  const extension = file.name.toLowerCase().split('.').pop();
  return extension && Object.hasOwn(CONTENT_TYPE_BY_EXTENSION, extension)
    ? CONTENT_TYPE_BY_EXTENSION[extension]
    : undefined;
}
