import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const BASE_URL = "http://127.0.0.1:8000";

interface ChatUser {
  user_id: string;
  username: string;
  profile_pic: string | null;
  last_message: string;
  timestamp: string | null;
}

interface SearchUser {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("access_token");
}

async function apiFetch(path: string, token: string | null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function Avatar({ uri, name, size = 50 }: { uri: string | null; name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["#6C63FF", "#FF6584", "#43C6AC", "#F7971E", "#4facfe"];
  const color = colors[name.charCodeAt(0) % colors.length];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#1e1e2e" }}
      />
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: size * 0.36, fontWeight: "700", letterSpacing: 0.5 }}>
        {initials}
      </Text>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();

  const [chats, setChats] = useState<ChatUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [openingChat, setOpeningChat] = useState<string | null>(null); // tracks which chat is loading
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    (async () => {
      const t = await getToken();
      setToken(t);
      const userId = await AsyncStorage.getItem("user_id");
      setCurrentUserId(userId);

      try {
        const data = await apiFetch("/chats", t);
        setChats(data);
      } catch (e) {
        console.error("Failed to load chats", e);
      } finally {
        setLoadingChats(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    })();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);
    const timeout = setTimeout(async () => {
      try {
        const data: SearchUser[] = await apiFetch(
          `/search?query=${encodeURIComponent(searchQuery)}`,
          token
        );

        if (currentUserId && data.length > 0) {
          const [myFollowing, myFollowers] = await Promise.all([
            apiFetch(`/users/${currentUserId}/following`, token),
            apiFetch(`/users/${currentUserId}/followers`, token),
          ]);

          const followingIds = new Set(myFollowing.map((f: any) => f.following_id));
          const followerIds = new Set(myFollowers.map((f: any) => f.follower_id));

          const mutual = data.filter(
            (u) => u.id !== currentUserId && followingIds.has(u.id) && followerIds.has(u.id)
          );

          setSearchResults(mutual);
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        console.error("Search failed", e);
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery, token, currentUserId]);

  // ✅ FIXED: creates/gets conversation first, then navigates with all 3 params
  const handleChatPress = async (otherUserId: string, username: string) => {
    if (!token) {
      Alert.alert("Error", "You are not logged in.");
      return;
    }

    setOpeningChat(otherUserId); // show spinner on this row

    try {
      // Step 1: create or get existing conversation
      const res = await fetch(`${BASE_URL}/conversations/${otherUserId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Conversation error:", err);
        Alert.alert("Error", "Could not open conversation.");
        return;
      }

      const data = await res.json();
      const conversationId: string = data.conversation_id;

      // Step 2: navigate with ALL required params
      router.push({
        pathname: "/dm/[userId]",
        params: {
          userId: otherUserId,
          username,
          conversationId,          // ✅ real conversation ID from DB
          token,                    // ✅ auth token
          userId2: currentUserId,   // ✅ logged-in user's ID (userId is taken by route param)
        },
      });
    } catch (e) {
      console.error("handleChatPress error:", e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setOpeningChat(null);
    }
  };

  const handleSearchFocus = () => setSearchActive(true);
  const handleSearchBlur = () => { if (!searchQuery) setSearchActive(false); };

  const renderChatItem = ({ item }: { item: ChatUser }) => (
    <TouchableOpacity
      style={styles.chatRow}
      activeOpacity={0.75}
      onPress={() => handleChatPress(item.user_id, item.username)}
      disabled={openingChat === item.user_id}
    >
      <View style={styles.avatarWrapper}>
        <Avatar uri={item.profile_pic} name={item.username} size={52} />
        <View style={styles.onlineDot} />
      </View>

      <View style={styles.chatInfo}>
        <Text style={styles.chatUsername}>@{item.username}</Text>
        <Text style={styles.chatPreview} numberOfLines={1}>
          {item.last_message || "Start chatting 👋"}
        </Text>
      </View>

      <View style={styles.chatMeta}>
        {item.timestamp && (
          <Text style={styles.chatTime}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        )}
        {/* ✅ Show spinner while opening this specific chat */}
        {openingChat === item.user_id ? (
          <ActivityIndicator size="small" color="#6C63FF" />
        ) : (
          <View style={styles.arrowIcon}>
            <Text style={styles.arrowText}>›</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSearchItem = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={styles.searchRow}
      activeOpacity={0.75}
      onPress={() => handleChatPress(item.id, item.username)}
      disabled={openingChat === item.id}
    >
      <Avatar uri={item.avatar} name={item.name || item.username} size={44} />
      <View style={styles.searchInfo}>
        <Text style={styles.searchUsername}>@{item.username}</Text>
        {item.name ? <Text style={styles.searchName}>{item.name}</Text> : null}
      </View>
      {openingChat === item.id ? (
        <ActivityIndicator size="small" color="#6C63FF" />
      ) : (
        <View style={styles.mutualBadge}>
          <Text style={styles.mutualText}>Mutual</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const isSearching = searchQuery.trim().length > 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a14" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSub}>
            {chats.length > 0 ? `${chats.length} conversation${chats.length !== 1 ? "s" : ""}` : "No conversations yet"}
          </Text>
        </View>
        <View style={styles.headerDot}>
          <Text style={styles.headerDotText}>{chats.length}</Text>
        </View>
      </View>

      <View style={[styles.searchBar, searchActive && styles.searchBarActive]}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search mutual connections…"
          placeholderTextColor="#3d3d5c"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchActive(false); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {isSearching ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {loadingSearch ? "Searching…" : searchResults.length > 0 ? `${searchResults.length} mutual connection${searchResults.length !== 1 ? "s" : ""} found` : "No mutual connections found"}
            </Text>
            {loadingSearch ? (
              <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} size="large" />
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>No mutual connections</Text>
                <Text style={styles.emptyBody}>You can only message people who follow you back.</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchItem}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {loadingChats ? (
              <ActivityIndicator color="#6C63FF" style={{ marginTop: 60 }} size="large" />
            ) : chats.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>No recent chats</Text>
                <Text style={styles.emptyBody}>Search for mutual connections above to start a conversation.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Recent</Text>
                <FlatList
                  data={chats}
                  keyExtractor={(item) => item.user_id}
                  renderItem={renderChatItem}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a14" },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: { fontSize: 32, fontWeight: "800", color: "#f0f0ff", letterSpacing: -0.8 },
  headerSub: { fontSize: 13, color: "#4a4a6a", marginTop: 2, letterSpacing: 0.2 },
  headerDot: { backgroundColor: "#6C63FF", borderRadius: 14, minWidth: 28, height: 28, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  headerDotText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  searchBar: { marginHorizontal: 20, marginBottom: 12, backgroundColor: "#12121f", borderRadius: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#1e1e30" },
  searchBarActive: { borderColor: "#6C63FF" },
  searchIcon: { fontSize: 20, color: "#4a4a6a", marginRight: 10, lineHeight: 24 },
  searchInput: { flex: 1, color: "#e0e0f0", fontSize: 15, fontWeight: "500", letterSpacing: 0.1 },
  clearBtn: { color: "#4a4a6a", fontSize: 14, paddingLeft: 8, paddingVertical: 2 },
  content: { flex: 1 },
  section: { flex: 1, paddingHorizontal: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#3a3a5a", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12, marginTop: 4 },
  chatRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 4 },
  avatarWrapper: { position: "relative", marginRight: 14 },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: "#43C6AC", borderWidth: 2, borderColor: "#0a0a14" },
  chatInfo: { flex: 1 },
  chatUsername: { fontSize: 15, fontWeight: "700", color: "#e0e0f0", letterSpacing: 0.1, marginBottom: 3 },
  chatPreview: { fontSize: 13, color: "#4a4a6a", fontWeight: "400" },
  chatMeta: { alignItems: "flex-end", gap: 6 },
  chatTime: { fontSize: 11, color: "#3a3a5a", fontWeight: "500" },
  arrowIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#12121f", alignItems: "center", justifyContent: "center" },
  arrowText: { color: "#6C63FF", fontSize: 18, fontWeight: "300", lineHeight: 22 },
  searchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 },
  searchInfo: { flex: 1, marginLeft: 14 },
  searchUsername: { fontSize: 15, fontWeight: "700", color: "#e0e0f0", letterSpacing: 0.1 },
  searchName: { fontSize: 13, color: "#4a4a6a", marginTop: 2 },
  mutualBadge: { backgroundColor: "#1a1a2e", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#6C63FF44" },
  mutualText: { color: "#6C63FF", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  separator: { height: 1, backgroundColor: "#12121f", marginHorizontal: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#e0e0f0", letterSpacing: -0.3, marginBottom: 10, textAlign: "center" },
  emptyBody: { fontSize: 14, color: "#3a3a5a", textAlign: "center", lineHeight: 22, fontWeight: "400" },
});