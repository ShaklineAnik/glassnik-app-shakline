import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { userApi, type BlockedUser } from '@/lib/api';

/**
 * Settings > Blocked users: lists the people the signed-in user has blocked
 * and lets them unblock someone. Uses GET /users/me/blocks and
 * DELETE /users/:id/block.
 */
export default function BlockedUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<BlockedUser[]>({
    queryKey: ['blockedUsers'],
    queryFn: () => userApi.getBlockedUsers(),
    enabled: !!user,
    retry: false,
    // Always ask the server when the screen opens: blocking happens elsewhere in the app.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  function confirmUnblock(u: BlockedUser) {
    const name = u.username ? `@${u.username}` : u.displayName ?? 'this user';
    Alert.alert(
      `Unblock ${name}?`,
      'They will be able to see your Experiences again, and their Experiences and comments will show for you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => unblock(u) },
      ],
    );
  }

  async function unblock(u: BlockedUser) {
    setUnblockingId(u.id);
    try {
      await userApi.unblockUser(u.id);
      queryClient.setQueryData<BlockedUser[]>(['blockedUsers'], (old) =>
        (old ?? []).filter((x) => x.id !== u.id),
      );
      // Their videos and comments should show again.
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err: any) {
      Alert.alert('Could not unblock', err?.message ?? 'Please try again.');
    } finally {
      setUnblockingId(null);
    }
  }

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 8;

  let body: React.ReactNode;
  if (!user) {
    body = <Message icon="user" title="Sign in to see blocked users" />;
  } else if (isLoading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  } else if (isError) {
    body = (
      <Message icon="wifi-off" title="Couldn't load blocked users">
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </Message>
    );
  } else if (!data || data.length === 0) {
    body = (
      <Message
        icon="slash"
        title="No blocked users"
        sub="People you block from an Experience will appear here."
      />
    );
  } else {
    body = (
      <FlatList
        data={data}
        keyExtractor={(u) => String(u.id)}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(item.username ?? item.displayName ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName ?? item.username ?? 'User'}
              </Text>
              {item.username ? (
                <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => confirmUnblock(item)}
              disabled={unblockingId === item.id}
              style={({ pressed }) => [
                styles.unblockBtn,
                { opacity: pressed || unblockingId === item.id ? 0.6 : 1 },
              ]}
            >
              {unblockingId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.unblockText}>Unblock</Text>
              )}
            </Pressable>
          </View>
        )}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Blocked users</Text>
        <View style={{ width: 40 }} />
      </View>
      {body}
    </View>
  );
}

function Message({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Feather name={icon} size={32} color="rgba(255,255,255,0.35)" />
      <Text style={styles.msgTitle}>{title}</Text>
      {sub ? <Text style={styles.msgSub}>{sub}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  msgTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  msgSub: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  separator: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  name: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  username: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  unblockBtn: {
    minWidth: 84,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  unblockText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});