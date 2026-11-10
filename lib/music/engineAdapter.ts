/**
 * DEV-ONLY bridge between the app's feed videos and the prototype's recommendation
 * engine (lib/music/engine). Builds the engine's input from a video, loads the
 * catalogue, and asks the engine for a track.
 *
 * Only Category and Location (city / place) are available in the app today;
 * place_type is not, so that tier is skipped by the engine.
 * Licences of the tracks are NOT verified: never ship this in a release build.
 */
import { buildContext, recommend } from './engine/src/engine/recommender';
import { toAudioUrl } from './engine/src/audioManifest';
import type { Experience, Track } from './engine/src/types';
import { contextKeyFor } from './musicEngine';

const BASE =
  'https://raw.githubusercontent.com/bjsy10101978-del/Glassnik_music_prototype/main/';

export interface EngineVideo {
  id?: string;
  category?: string | null;
  city?: string | null;
  place?: string | null;
}

export interface EnginePick {
  trackId: string;
  uri: string;
  reason: string;
}

let cache: { tracks: Track[]; available: string[] } | null = null;

async function loadEngineData() {
  if (cache) return cache;
  const res = await fetch(BASE + 'data/catalogue.json');
  if (!res.ok) throw new Error('Music catalogue request failed: ' + res.status);
  const json = await res.json();
  const tracks: Track[] = Array.isArray(json.tracks) ? json.tracks : [];
  const available = tracks
    .map((t) => (t.file_reference ?? '').trim().replace(/^\/+/, '').replace(/^public\//, ''))
    .filter((f) => f !== '');
  cache = { tracks, available };
  return cache;
}

function toExperience(video: EngineVideo): Experience {
  const taxonomyId = contextKeyFor(video.category);
  const categoryId = taxonomyId === 'general' ? null : taxonomyId;
  return {
    experience_id: video.id ?? 'unknown',
    title: '',
    destination: video.city ?? video.place ?? null,
    category_id: categoryId,
    place_type: null,
    video_reference: null,
    // Videos of one category share one music decision (same context key).
    sequence_group: 'category:' + (categoryId ?? 'general'),
    sequence_index: null,
    music_context: null,
    metadata_status: 'app_video',
  };
}

/** Same key = keep playing the current track; new key = pick a new track. */
export function engineKeyFor(video: EngineVideo): string {
  return toExperience(video).sequence_group as string;
}

export async function pickFor(
  video: EngineVideo,
  history: string[],
): Promise<EnginePick | null> {
  const { tracks, available } = await loadEngineData();
  const rec = recommend({
    context: buildContext(toExperience(video)),
    tracks,
    mode: 'research',
    availableAudioFiles: available,
    avoidTrackIds: history,
  });
  if (!rec.track) return null;
  const uri = toAudioUrl(rec.track.file_reference, available);
  if (!uri) return null;
  return { trackId: rec.track.track_id, uri, reason: rec.reason };
}
