import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode as atob } from "base-64";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";

// ─── Constants ────────────────────────────────────────────────────────────────
const API_URL = "https://sda-app-backend.onrender.com";

// const API_URL = "http://192.168.100.22:8000";
const { width } = Dimensions.get("window");

const TOKEN = {
  space:  { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 6, md: 12, lg: 20, full: 9999 },
  font:   { xs: 11, sm: 13, md: 15, lg: 17, xl: 20 },
  avatar: { sm: 44, lg: 88 },
  tileGap: 1.5,
} as const;

const TILE_SIZE = (width - TOKEN.tileGap * 2) / 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type PostImage = { id: string; image_url: string };

type Post = {
  id: string;
  content?: string;
  created_at?: string;
  images?: PostImage[];
};

type User = {
  id: string;
  username: string;

  email?: string; 
  full_name?: string;
  bio?: string;
  profile_pic?: string;
  department?: string;
  university?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function avatarUri(path?: string) {
  return path ? `${API_URL}${path}` : null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ uri, size, theme }: { uri: string | null; size: number; theme: any }) {
  const r = size / 2;
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: r, backgroundColor: theme.card }]}>
      <Ionicons name="person" size={size * 0.5} color={theme.text + "55"} />
    </View>
  );
}

function StatColumn({ count, label, theme }: { count: number; label: string; theme: any }) {
  return (
    <View style={styles.statColumn}>
      <Text style={[styles.statNumber, { color: theme.text }]}>{count}</Text>
      <Text style={[styles.statLabel,  { color: theme.text + "88" }]}>{label}</Text>
    </View>
  );
}

function DropdownRow({ icon, text, theme }: { icon: any; text: string; theme: any }) {
  return (
    <View style={styles.dropdownInfoRow}>
      <Ionicons name={icon} size={TOKEN.font.sm} color={theme.text + "88"} />
      <Text style={[styles.dropdownInfoText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function PostTile({ post, theme }: { post: Post; theme: any }) {
  const router = useRouter();
  const firstImageUri = avatarUri(post.images?.[0]?.image_url);

  return (
    <View style={[styles.tile, { backgroundColor: theme.card }]}>
      <TouchableOpacity style={styles.tilePressable} activeOpacity={0.85}>
        {firstImageUri ? (
          <Image source={{ uri: firstImageUri }} style={styles.tileImage} resizeMode="cover" />
        ) : (
          <View style={styles.tileTextFallback}>
            <Text numberOfLines={4} style={[styles.tileText, { color: theme.text }]}>
              {post.content ?? ""}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tileOptionsButton}
        activeOpacity={0.75}
        onPress={() =>
          router.push({
            pathname: "/(tabs)/edit-post",
            params: {
              postId: post.id,
              currentContent: post.content ?? "",
              currentImage: post.images?.[0]?.image_url ?? "",
            },
          })
        }
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="ellipsis-horizontal" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}


// ─── Main Screen ──────────────────────────────────────────────────────────────
//
export default function ProfileScreen({ profileUserId }: { profileUserId?: string }) {
  const router  = useRouter();
  const { theme, mode } = useTheme();
  const insets  = useSafeAreaInsets();

  const [currentToken,   setCurrentToken]   = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  const [user,       setUser]       = useState<User | null>(null);
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [followers,  setFollowers]  = useState<any[]>([]);
  const [following,  setFollowing]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Whose profile are we viewing?
  const targetUserId = profileUserId ?? loggedInUserId ?? "";
 
  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;
      setCurrentToken(token);

      const payload = decodeToken(token);
      const myId    = payload?.sub as string;
      setLoggedInUserId(myId);


      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      const userRes  = await fetch(`${API_URL}/users/id/${myId}`, { headers });
      const userData: User = await userRes.json();
      setUser(userData);

      const postsRes = await fetch(`${API_URL}/users/${myId}/posts`, { headers });
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(Array.isArray(data) ? data : []);
      }

      const [followersRes, followingRes] = await Promise.all([
        fetch(`${API_URL}/users/${userData.id}/followers`, { headers }),
        fetch(`${API_URL}/users/${userData.id}/following`, { headers }),
      ]);

      if (followersRes.ok) setFollowers(await followersRes.json());
      if (followingRes.ok) setFollowing(await followingRes.json());
    } catch (err) {
      console.error("[ProfileScreen] fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileUserId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={[styles.loadingText, { color: theme.text + "88" }]}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  // ── Profile header ───────────────────────────────────────────────────────

  const departmentLine = [user?.department, user?.university].filter(Boolean).join(" · ");

  function ProfileHeader() {
    return (
      <View>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarIdentity}
            onPress={() => setShowDropdown((v) => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons name="lock-closed" size={12} color={theme.text + "99"} />
            <Text style={[styles.topBarUsername, { color: theme.text }]}>{user?.username ?? ""}</Text>
            <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={12} color={theme.text + "99"} />
          </TouchableOpacity>

          
          { (
            <TouchableOpacity
              onPress={() => router.push("/menu")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="menu-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown info card */}
        {showDropdown && (
          <View style={[styles.dropdownCard, { backgroundColor: theme.card, borderColor: theme.text + "18" }]}>
            <View style={styles.dropdownIdentityRow}>
              <Avatar uri={avatarUri(user?.profile_pic)} size={TOKEN.avatar.sm} theme={theme} />
              <View style={styles.dropdownNameBlock}>
                {user?.full_name && (
                  <Text style={[styles.dropdownFullName, { color: theme.text }]}>{user.full_name}</Text>
                )}
                <Text style={[styles.dropdownHandle, { color: theme.text + "88" }]}>@{user?.username}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.text + "18" }]} />

            {user?.email    && <DropdownRow icon="mail-outline"              text={user.email}     theme={theme} />}
            {departmentLine && <DropdownRow icon="school-outline"             text={departmentLine} theme={theme} />}
            {user?.bio      && <DropdownRow icon="information-circle-outline" text={user.bio}       theme={theme} />}
          </View>
        )}

        {/* Avatar + stats */}
        <View style={styles.avatarStatsRow}>
          <Avatar uri={avatarUri(user?.profile_pic)} size={TOKEN.avatar.lg} theme={theme} />
          <View style={styles.statsGroup}>
            <StatColumn count={posts.length}     label="Posts"     theme={theme} />
            <StatColumn count={followers.length} label="Followers" theme={theme} />
            <StatColumn count={following.length} label="Following" theme={theme} />
          </View>
        </View>

        {/* Bio */}
        <View style={styles.bioBlock}>
          {user?.full_name && <Text style={[styles.bioName, { color: theme.text }]}>{user.full_name}</Text>}
          {departmentLine  && <Text style={[styles.bioMeta, { color: theme.text + "88" }]}>{departmentLine}</Text>}
          {user?.bio       && <Text style={[styles.bioText, { color: theme.text }]}>{user.bio}</Text>}
        </View>

       

        {/* Grid section divider */}
        <View style={[styles.gridLabel, { borderColor: theme.text + "18" }]}>
          <Ionicons name="grid-outline" size={16} color={theme.text} />
        </View>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => <PostTile post={item} theme={theme} />}
        ListHeaderComponent={<ProfileHeader />}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.text}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:      { flex: 1 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: TOKEN.space.sm, fontSize: TOKEN.font.sm },
  avatarFallback: { justifyContent: "center", alignItems: "center" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: TOKEN.space.md,
    paddingVertical: TOKEN.space.sm + TOKEN.space.xs,
  },
  topBarIdentity: { flexDirection: "row", alignItems: "center", gap: TOKEN.space.xs },
  topBarUsername: { fontSize: TOKEN.font.md, fontWeight: "700", letterSpacing: -0.3 },

  dropdownCard: {
    marginHorizontal: TOKEN.space.md,
    marginBottom: TOKEN.space.sm,
    borderRadius: TOKEN.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: TOKEN.space.md,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  dropdownIdentityRow: { flexDirection: "row", alignItems: "center", marginBottom: TOKEN.space.md },
  dropdownNameBlock:   { marginLeft: TOKEN.space.sm + TOKEN.space.xs, flex: 1 },
  dropdownFullName:    { fontWeight: "700", fontSize: TOKEN.font.md, marginBottom: 2, letterSpacing: -0.2 },
  dropdownHandle:      { fontSize: TOKEN.font.xs },
  divider:             { height: StyleSheet.hairlineWidth, marginBottom: TOKEN.space.sm + TOKEN.space.xs },
  dropdownInfoRow:     { flexDirection: "row", alignItems: "center", gap: TOKEN.space.sm, marginBottom: TOKEN.space.sm },
  dropdownInfoText:    { fontSize: TOKEN.font.sm, flex: 1, lineHeight: 18 },

  avatarStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TOKEN.space.md,
    marginTop: TOKEN.space.sm,
  },
  statsGroup: { flex: 1, flexDirection: "row", justifyContent: "space-around", marginLeft: TOKEN.space.md },
  statColumn: { alignItems: "center", gap: TOKEN.space.xs },
  statNumber: { fontSize: TOKEN.font.lg, fontWeight: "700", letterSpacing: -0.5 },
  statLabel:  { fontSize: TOKEN.font.xs },

  bioBlock: { paddingHorizontal: TOKEN.space.md, marginTop: TOKEN.space.sm + TOKEN.space.xs, gap: TOKEN.space.xs },
  bioName:  { fontWeight: "700", fontSize: TOKEN.font.md, letterSpacing: -0.2 },
  bioMeta:  { fontSize: TOKEN.font.sm },
  bioText:  { fontSize: TOKEN.font.sm, lineHeight: 20 },

  // Follow button
  followBtnWrapper: { paddingHorizontal: TOKEN.space.md, marginTop: TOKEN.space.sm },
  followBtn: {
    height: 36,
    borderRadius: TOKEN.radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  followBtnFilled:  { /* backgroundColor set inline */ },
  followBtnOutline: { borderWidth: 1 },
  followBtnLabel:   { fontSize: TOKEN.font.sm, fontWeight: "600", letterSpacing: 0.1 },

  // Post grid
  gridLabel:        { marginTop: TOKEN.space.md, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center", paddingVertical: TOKEN.space.sm },
  gridRow:          { gap: TOKEN.tileGap },
  tile:             { width: TILE_SIZE, height: TILE_SIZE },
  tilePressable:    { flex: 1 },
  tileImage:        { width: "100%", height: "100%" },
  tileTextFallback: { flex: 1, justifyContent: "center", alignItems: "center", padding: TOKEN.space.sm },
  tileText:         { fontSize: TOKEN.font.xs, lineHeight: 16, textAlign: "center" },
  tileOptionsButton: {
    position: "absolute",
    bottom: TOKEN.space.xs,
    right:  TOKEN.space.xs,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: TOKEN.radius.full,
    padding: TOKEN.space.xs,
  },
});