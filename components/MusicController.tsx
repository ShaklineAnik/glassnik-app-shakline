import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { contextKeyFor, loadCatalogue, pickTrack, type MusicTrack } from '@/lib/music/musicEngine';
import { useVideoPaused } from '@/lib/music/pauseStore';

const STORAGE_KEY = '@glassnik/devMusicOn';
const VOLUME = 0.4;

interface Props {
  /** The video currently active in the feed (id for pause state, category for track choice). */
  video: { id?: string; category?: string | null } | null;
}

/**
 * DEV-ONLY background music for the feed. Renders nothing in release builds.
 * Music starts only after the viewer turns it on (button), never automatically.
 * Independent of the speaker button; pauses when the viewer pauses the video.
 */
export function MusicController({ video }: Props) {
  if (!__DEV__) return null;
  return <DevMusic video={video} />;
}

function DevMusic({ video }: Props) {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);

  const playerRef = useRef<any>(null);
  const subRef = useRef<any>(null);
  const tracksRef = useRef<MusicTrack[] | null>(null);
  const historyRef = useRef<string[]>([]);
  const wantedKeyRef = useRef<string | null>(null);
  const playingKeyRef = useRef<string | null>(null);
  const enabledRef = useRef(false);
  const pausedRef = useRef(false);
  const playForRef = useRef<(key: string) => void>(() => {});

  const key = video ? contextKeyFor(video.category) : null;
  const videoPaused = useVideoPaused(video?.id);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v === 'true') setEnabled(true); })
      .catch(() => {});
  }, []);

  const playFor = useCallback(async (ctxKey: string) => {
    try {
      if (!tracksRef.current) tracksRef.current = await loadCatalogue();
      const track = pickTrack(tracksRef.current, ctxKey, historyRef.current);
      if (!track) return;
      historyRef.current = [...historyRef.current, track.id].slice(-15);
      playingKeyRef.current = ctxKey;

      if (!playerRef.current) {
        try {
          await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' } as any);
        } catch {}
        const p: any = createAudioPlayer({ uri: track.uri });
        subRef.current = p.addListener('playbackStatusUpdate', (s: any) => {
          if (s?.didJustFinish && enabledRef.current && !pausedRef.current && wantedKeyRef.current) {
            playForRef.current(wantedKeyRef.current);
          }
        });
        playerRef.current = p;
      } else {
        playerRef.current.replace({ uri: track.uri });
      }
      playerRef.current.volume = VOLUME;
      // The viewer may have paused the video while the track was loading
      if (pausedRef.current || !enabledRef.current) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
      console.log('[MUSIC] context=' + ctxKey + ' track=' + track.id);
    } catch (e) {
      console.log('[MUSIC] error', e);
    }
  }, []);
  playForRef.current = playFor;

  useEffect(() => {
    enabledRef.current = enabled;
    pausedRef.current = videoPaused;
    wantedKeyRef.current = key;
    if (!enabled || !key || videoPaused) {
      try { playerRef.current?.pause(); } catch {}
      return;
    }
    if (playerRef.current && playingKeyRef.current === key) {
      try { playerRef.current.play(); } catch {}
      return;
    }
    playFor(key);
  }, [enabled, key, videoPaused, playFor]);

  useEffect(() => {
    return () => {
      try { subRef.current?.remove?.(); } catch {}
      try {
        const p = playerRef.current;
        (p?.remove ?? p?.release)?.call(p);
      } catch {}
      playerRef.current = null;
    };
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
  }

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      accessibilityLabel={enabled ? 'Turn background music off' : 'Turn background music on'}
      style={[
        styles.btn,
        {
          top: insets.top + 56,
          backgroundColor: enabled ? 'rgba(124,58,237,0.9)' : 'rgba(0,0,0,0.45)',
        },
      ]}
    >
      <Feather name="music" size={18} color="#fff" style={{ opacity: enabled ? 1 : 0.5 }} />
      {!enabled && <View style={styles.slash} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  slash: {
    position: 'absolute',
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fff',
    transform: [{ rotate: '-45deg' }],
  },
});