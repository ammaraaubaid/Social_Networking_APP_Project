import React, { useEffect, useState, useCallback } from "react";
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
  SafeAreaView,
  Image,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// const API_URL = "https://sda-app-backend.onrender.com";
const API_URL = "http://127.0.0.1:8000"

const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 3) / 3;

// ─── TYPES ───────────────────────────────────────────────
type PostImage = { id: string; image_url: string };
type Post = { id: string; content?: string; images?: PostImage[] };
type User = {
  id: string;
  username: string;
  full_name?: string;
  bio?: string;
  profile_pic?: string;
  department?: string;
  university?: string;
};

// ─── POST TILE ───────────────────────────────────────────
function PostTile({ post }: { post: Post }) {
  const firstImage = post.images?.[0]?.image_url
    ? post.images[0].image_url.startsWith("http")
      ? post.images[0].image_url
      : `${API_URL}${post.images[0].image_url}`
    : null;

  return (
    <TouchableOpacity style={styles.tile}>
      {firstImage ? (
        <Image source={{ uri: firstImage }} style={styles.tileImage} />
      ) : (
        <View style={styles.tileFallback}>
          <Text numberOfLines={4} style={styles.tileText}>
            {post.content || ""}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatCol({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statNumber}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── FOLLOW BUTTON ───────────────────────────────────────
function FollowButton({
  isFollowing,
  isOwnProfile,
  loading,
  onPress,
}: {
  isFollowing: boolean;
  isOwnProfile: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  if (isOwnProfile) return null;

  return (
    <TouchableOpacity
      style={[
        styles.followBtn,
        isFollowing ? styles.followingBtn : styles.notFollowingBtn,
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isFollowing ? "#333" : "#fff"}
        />
      ) : (
        <Text
          style={[
            styles.followBtnText,
            isFollowing ? styles.followingBtnText : styles.notFollowingBtnText,
          ]}
        >
          {isFollowing ? "Following" : "Follow"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── MAIN ────────────────────────────────────────────────
export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      const myId = await AsyncStorage.getItem("user_id");
      setCurrentUserId(myId);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const userId = String(id);

      const [userRes, postsRes, followersRes, followingRes] = await Promise.all([
        fetch(`${API_URL}/users/id/${userId}`, { headers }),
        fetch(`${API_URL}/users/${userId}/posts`, { headers }),
        fetch(`${API_URL}/users/${userId}/followers`, { headers }),
        fetch(`${API_URL}/users/${userId}/following`, { headers }),
      ]);

      const userData = await userRes.json();
      const postsData = await postsRes.json();
      const followersData = await followersRes.json();
      const followingData = await followingRes.json();

      setUser(userData);
      setPosts(Array.isArray(postsData) ? postsData : []);

      const followers = Array.isArray(followersData) ? followersData : [];
      const following = Array.isArray(followingData) ? followingData : [];

      setFollowerCount(followers.length);
      setFollowingCount(following.length);

      // Check if current user is already following this profile
      if (myId) {
        const alreadyFollowing = followers.some(
          (f: any) => f.follower_id === myId
        );
        setIsFollowing(alreadyFollowing);
      }
    } catch (err) {
      console.log("❌ ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Follow / Unfollow ──
  const handleFollowToggle = async () => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) {
      Alert.alert("Not logged in", "Please log in to follow users.");
      return;
    }

    setFollowLoading(true);
    const userId = String(id);
    const method = isFollowing ? "DELETE" : "POST";
    const endpoint = isFollowing
      ? `${API_URL}/unfollow/${userId}`
      : `${API_URL}/follow/${userId}`;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        Alert.alert("Error", err.detail || "Something went wrong.");
        return;
      }

      // Optimistically update counts & state
      setIsFollowing((prev) => !prev);
      setFollowerCount((prev) => (isFollowing ? prev - 1 : prev + 1));
    } catch (e) {
      Alert.alert("Network error", "Could not complete the request.");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  const profilePic = user?.profile_pic
    ? user.profile_pic.startsWith("http")
      ? user.profile_pic
      : `${API_URL}${user.profile_pic}`
    : null;

  const isOwnProfile = currentUserId === String(id);

  const ProfileHeader = () => (
    <View>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.username}>@{user?.username}</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Avatar + Stats */}
      <View style={styles.rowTop}>
        {profilePic ? (
          <Image source={{ uri: profilePic }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={36} color="#aaa" />
          </View>
        )}

        <View style={styles.statsRow}>
          <StatCol count={posts.length} label="Posts" />
          <StatCol count={followerCount} label="Followers" />
          <StatCol count={followingCount} label="Following" />
        </View>
      </View>

      {/* Bio */}
      <View style={styles.bio}>
        {user?.full_name ? (
          <Text style={styles.name}>{user.full_name}</Text>
        ) : null}
        {user?.department ? (
          <Text style={styles.meta}>{user.department}</Text>
        ) : null}
        {user?.university ? (
          <Text style={styles.meta}>{user.university}</Text>
        ) : null}
        {user?.bio ? (
          <Text style={styles.bioText}>{user.bio}</Text>
        ) : null}
      </View>

      {/* Follow / Unfollow Button */}
      <View style={styles.actionRow}>
        <FollowButton
          isFollowing={isFollowing}
          isOwnProfile={isOwnProfile}
          loading={followLoading}
          onPress={handleFollowToggle}
        />
        {isOwnProfile && (
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => <PostTile post={item} />}
        ListHeaderComponent={<ProfileHeader />}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Ionicons name="images-outline" size={40} color="#ccc" />
            <Text style={styles.emptyPostsText}>No posts yet</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e8e8",
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    letterSpacing: 0.1,
  },

  // Avatar + stats
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "#f0f0f0",
  },
  avatarPlaceholder: {
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    marginLeft: 10,
  },
  statCol: { alignItems: "center" },
  statNumber: { fontWeight: "800", fontSize: 18, color: "#111" },
  statLabel: { color: "#888", fontSize: 12, marginTop: 2 },

  // Bio
  bio: { paddingHorizontal: 18, paddingBottom: 12 },
  name: { fontWeight: "700", fontSize: 15, color: "#111", marginBottom: 2 },
  meta: { fontSize: 13, color: "#666", marginBottom: 1 },
  bioText: { fontSize: 13, color: "#333", marginTop: 4, lineHeight: 19 },

  // Action row
  actionRow: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    gap: 10,
  },

  // Follow button
  followBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  notFollowingBtn: {
    backgroundColor: "#0095f6",
  },
  followingBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbdbdb",
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  notFollowingBtnText: {
    color: "#fff",
  },
  followingBtnText: {
    color: "#111",
  },

  // Edit button (own profile)
  editBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbdbdb",
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "#efefef",
    marginBottom: 1,
  },

  // Post tiles
  tile: { width: TILE_SIZE, height: TILE_SIZE, margin: 0.5 },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 6,
  },
  tileText: { fontSize: 10, color: "#555", textAlign: "center" },

  // Empty posts
  emptyPosts: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyPostsText: {
    color: "#bbb",
    fontSize: 14,
  },
});