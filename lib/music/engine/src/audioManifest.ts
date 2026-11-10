/**
 * Minimal audio URL helper for the app (DEV-ONLY music).
 *
 * Replaces the web prototype's audioManifest.ts, which relied on Vite
 * (import.meta.env) and a bundled JSON manifest. Same rule as the prototype:
 * a catalogue file_reference maps to a URL only when it is a .mp3 that is in
 * the list of available files; otherwise null.
 *
 * Audio is streamed from the prototype's public repo. Licences are NOT
 * verified, so this must never ship in a release build.
 */
const AUDIO_BASE =
  'https://raw.githubusercontent.com/bjsy10101978-del/Glassnik_music_prototype/main/public/';

export function toAudioUrl(
  fileReference: string | null | undefined,
  available: string[] = [],
): string | null {
  if (!fileReference) return null;
  const trimmed = fileReference.trim().replace(/^\/+/, '').replace(/^public\//, '');
  if (!trimmed.toLowerCase().endsWith('.mp3')) return null;
  if (!available.includes(trimmed)) return null;
  return AUDIO_BASE + trimmed;
}
