import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Share,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const useNativeDriver = Platform.OS !== 'web';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { SampleVideo } from '@/constants/sampleVideos';
import { userApi, videoApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useMute } from '@/context/MuteContext';

interface Props {
  video: SampleVideo;
  isActive: boolean;
  onCommentPress?: (videoId: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function FeedVideoItem({ video, isActive, onCommentPress }: Props) {
  const { isMuted } = useMute();
  const { width, height } = useWindowDimensions();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [blockSending, setBlockSending] = useState(false);
  const lastTap = useRef(0);
  const { user } = useAuth();
  const isOwnVideo = user?.id != null && video.creatorId != null && video.creatorId === user.id;
  const canBlock = video.creatorId != null && !video.id.startsWith('sv-') && !isOwnVideo;
  const router = useRouter();
  const queryClient = useQueryClient();

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(video.uri, useCallback((p: import('expo-video').VideoPlayer) => {
    p.loop = true;
  }, []));

  useEffect(() => {
    console.log('VIDEO URI:', video.uri);
    const sub = player.addListener('statusChange', (e: any) => {
      console.log('VIDEO STATUS:', e.status, e.error?.message);
    });
    return () => sub.remove();
  }, [player, video.uri]);

  useEffect(() => {
    try {
      player.muted = isMuted;
      if (isActive && !paused) {
        player.play();
      } else {
        player.pause();
      }
    } catch {}
  }, [isActive, paused, player, isMuted]);

  useEffect(() => {
    if (!isActive) { setProgress(0); return; }
    const id = setInterval(() => {
      try {
        const d = player.duration;
        const t = player.currentTime;
        if (d > 0) setProgress(t / d);
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [isActive, player]);

  function triggerHeartAnim() {
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.2, useNativeDriver, friction: 4 }),
      Animated.timing(heartScale, { toValue: 1, duration: 100, useNativeDriver }),
      Animated.delay(400),
      Animated.timing(heartOpacity, { toValue: 0, duration: 400, useNativeDriver }),
    ]).start();
  }

  function handleLike() {
    if (!user) {
      Alert.alert(
        'Sign in required',
        'You need to be signed in to like videos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }
    const wasLiked = liked;
    if (!wasLiked) {
      triggerHeartAnim();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));

    const apiCall = wasLiked
      ? videoApi.unlikeVideo(video.id)
      : videoApi.likeVideo(video.id);
    apiCall.catch(() => {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    });
  }

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!liked) handleLike();
      else triggerHeartAnim();
    } else {
      setPaused((p) => !p);
      setControlsVisible((v) => !v);
    }
    lastTap.current = now;
  }

  async function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Share.share({
        message: `Check out this video by @${video.creator.username} on Glassnik${video.description ? ': ' + video.description : ''}`,
      });
    } catch {}
  }

  function handleReport() {
    setReportOpen(true);
  }

  async function submitReport(reason: string) {
    if (reportSending) return;
    const isRealVideo = video.creatorId != null && !video.id.startsWith('sv-');
    if (!isRealVideo) {
      setReportOpen(false);
      Alert.alert('Sample video', 'This is a sample video, so there is nothing to report.');
      return;
    }
    setReportSending(true);
    try {
      await videoApi.reportVideo(video.id, reason);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setReportOpen(false);
      Alert.alert('Thanks', 'Your report has been sent to our team.');
    } catch (err: any) {
      Alert.alert('Could not send report', err?.message ?? 'Please try again.');
    } finally {
      setReportSending(false);
    }
  }

  function handleBlock() {
    if (!user) {
      setReportOpen(false);
      Alert.alert(
        'Sign in required',
        'You need to be signed in to block a user.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ],
      );
      return;
    }
    if (!canBlock || video.creatorId == null || blockSending) return;
    const creatorId = video.creatorId;
    setReportOpen(false);
    Alert.alert(
      `Block @${video.creator.username}?`,
      'You will no longer see their videos. You can unblock them later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlockSending(true);
            try {
              await userApi.blockUser(creatorId);
              queryClient.invalidateQueries({ queryKey: ['feed'] }).catch(() => {});
              Alert.alert('User blocked', 'You will no longer see their videos.');
            } catch (err: any) {
              Alert.alert('Could not block user', err?.message ?? 'Please try again.');
            } finally {
              setBlockSending(false);
            }
          },
        },
      ],
    );
  }

  async function handleFollow() {
    if (!user) {
      Alert.alert(
        'Sign in required',
        'You need to be signed in to follow videographers.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }
    if (!video.creatorId || followLoading) return;
    setFollowLoading(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (wasFollowing) {
        await userApi.unfollow(video.creatorId);
      } else {
        await userApi.follow(video.creatorId);
      }
      queryClient.invalidateQueries({ queryKey: ['profile-stats', user.id] });
    } catch {
      setFollowing(wasFollowing);
    } finally {
      setFollowLoading(false);
    }
  }

  // Category tap → jumps to Explore with that category pre-selected, per
  // Steve's spec ("Category can connect to the category filtering we're
  // already implementing"). Place/Destination stay non-interactive —
  // explicitly called out as a later development stage.
  function handleCategoryPress() {
    if (!video.category) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/(tabs)/explore', params: { category: video.category } } as any);
  }

  const ITEM_HEIGHT = height;

  const placeTourTransport = video.description || null;
  const locationText = [video.place, video.city, video.country].filter(Boolean).join(', ') || null;
  const metaLine = [placeTourTransport, locationText].filter(Boolean).join(' • ');

    return (
      <View style={[styles.container, { width, height: ITEM_HEIGHT }]}>
        {isActive ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
          />
      ) : video.thumbnailUrl ? (
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]} />
      )}

      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      <View style={[styles.gradientBottom, { pointerEvents: 'none' }]} />

      {paused && isActive && (
        <View style={[styles.pauseOverlay, { pointerEvents: 'none' }]}>
          <View style={styles.pauseIcon}>
            <Feather name="pause" size={44} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
      )}

      <Animated.View
        style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }], pointerEvents: 'none' }]}
      >
        <Ionicons name="heart" size={90} color="#FE2C55" />
      </Animated.View>

      {controlsVisible && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {controlsVisible && (
        <View style={styles.bottomBox}>
          {!isOwnVideo && (
            <View style={styles.creatorRow}>
              <Text style={styles.creatorName}>@{video.creator.username}</Text>
              {video.creatorId && (
                <Pressable
                  style={[styles.followTextBtn, following && styles.followTextBtnActive]}
                  onPress={handleFollow}
                  disabled={followLoading}
                >
                  {following ? (
                    <View style={styles.followingRow}>
                      <Feather name="check" size={11} color="#fff" />
                      <Text style={styles.followTextBtnLabel}>Following</Text>
                    </View>
                  ) : (
                    <Text style={styles.followTextBtnLabel}>Follow</Text>
                  )}
                </Pressable>
              )}
            </View>
          )}

          {metaLine ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>
                {metaLine}
              </Text>
              {video.category ? (
                <Pressable style={styles.categoryPill} onPress={handleCategoryPress}>
                  <Text style={styles.categoryText}>{video.category.toUpperCase()}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.actionRow}>
            <Pressable style={styles.actionItem} onPress={handleLike}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={20}
                color={liked ? '#FE2C55' : 'rgba(255,255,255,0.7)'}
              />
              <Text style={styles.actionLabel}>{formatCount(likeCount)}</Text>
            </Pressable>

            <Pressable
              style={styles.actionItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onCommentPress?.(video.id);
              }}
            >
              <Feather name="message-circle" size={18} color="rgba(255,255,255,0.7)" />
              <Text style={styles.actionLabel}>{formatCount(video.comments)}</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={handleShare}>
              <Feather name="share-2" size={17} color="rgba(255,255,255,0.7)" />
              <Text style={styles.actionLabel}>{formatCount(video.shares)}</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={handleReport}>
              <Feather name="flag" size={17} color="rgba(255,255,255,0.7)" />
              <Text style={styles.actionLabel}>Report</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={reportOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReportOpen(false)}
      >
        <View style={reportStyles.backdrop}>
          <View style={reportStyles.sheet}>
            <Text style={reportStyles.title}>Report video</Text>
            <Text style={reportStyles.subtitle}>Why are you reporting this video?</Text>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={reportStyles.option}
                onPress={() => submitReport(reason)}
                disabled={reportSending}
              >
                <Text style={reportStyles.optionText}>{reason}</Text>
              </Pressable>
            ))}
            {canBlock && (
              <Pressable style={reportStyles.option} onPress={handleBlock} disabled={blockSending}>
                <Text style={[reportStyles.optionText, { color: '#ef4444' }]}>
                  Block @{video.creator.username}
                </Text>
              </Pressable>
            )}
            <Pressable style={reportStyles.cancel} onPress={() => setReportOpen(false)}>
              <Text style={reportStyles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Nudity or sexual content',
  'Violence or dangerous acts',
  'Hate or harassment',
  'Something else',
];

const reportStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#14141c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  title: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  optionText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_400Regular' },
  cancel: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoPlaceholder: {
    backgroundColor: '#111',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heartOverlay: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
  },

  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 84,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    minWidth: 2,
  },

  bottomBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatorName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followTextBtn: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  followTextBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  followTextBtnLabel: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  followingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    gap: 3,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});