import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";

const API_URL = "http://127.0.0.1:8000";

export default function Home() {
  const { theme } = useTheme();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  const fetchFeed = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/feed`);
      const data = await res.json();

      // fetch like count + is_liked for each post
      const withLikes = await Promise.all(
        data.map(async (post: any) => {
          try {
            const likesRes = await fetch(`${API_URL}/posts/${post.id}/likes`);
            const likesData = await likesRes.json();
            return {
              ...post,
              likes_count: likesData.likes ?? 0,
              is_liked: likesData.is_liked ?? false,
            };
          } catch {
            return { ...post, likes_count: 0, is_liked: false };
          }
        })
      );

      setPosts(withLikes);
    } catch (e) {
      console.log("Feed error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) return;

    // optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: !isLiked,
              likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1,
            }
          : p
      )
    );

    setLikingIds((prev) => new Set(prev).add(postId));

    try {
      const method = isLiked ? "DELETE" : "POST";
      const res = await fetch(`${API_URL}/posts/${postId}/like`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        // revert on failure
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  is_liked: isLiked,
                  likes_count: isLiked ? p.likes_count + 1 : p.likes_count - 1,
                }
              : p
          )
        );
      }
    } catch (e) {
      console.log("Like error:", e);
      // revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: isLiked,
                likes_count: isLiked ? p.likes_count + 1 : p.likes_count - 1,
              }
            : p
        )
      );
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.header, { color: theme.text }]}>Unifi Feed</Text>

      {loading ? (
        <ActivityIndicator size="large" color={theme.text} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.post, { borderColor: theme.card, backgroundColor: theme.card }]}>

              {/* HEADER ROW */}
              <View style={styles.postHeader}>
                {item.profile_pic ? (
                  <Image
                    source={{
                      uri: item.profile_pic.startsWith("http")
                        ? item.profile_pic
                        : `${API_URL}${item.profile_pic}`,
                    }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.background }]}>
                    <Ionicons name="person" size={16} color={theme.subtext} />
                  </View>
                )}
                <Text style={[styles.username, { color: theme.text }]}>
                  @{item.username}
                </Text>
              </View>

              {/* CONTENT */}
              {item.content ? (
                <Text style={[styles.content, { color: theme.text }]}>
                  {item.content}
                </Text>
              ) : null}

              {/* IMAGE */}
              {item.image && (
                <Image
                  source={{
                    uri: item.image.startsWith("http")
                      ? item.image
                      : `${API_URL}${item.image}`,
                  }}
                  style={styles.image}
                  resizeMode="cover"
                />
              )}

              {/* FOOTER ROW: like + time */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.likeBtn}
                  onPress={() => handleLike(item.id, item.is_liked)}
                  disabled={likingIds.has(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.is_liked ? "heart" : "heart-outline"}
                    size={22}
                    color={item.is_liked ? "#e0245e" : theme.subtext}
                  />
                  <Text style={[styles.likeCount, { color: item.is_liked ? "#e0245e" : theme.subtext }]}>
                    {item.likes_count}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.time, { color: theme.subtext }]}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString()
                    : ""}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.text }]}>
              No posts yet. Create one!
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingBottom: 12,
    letterSpacing: -0.5,
  },
  post: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontWeight: "700",
    fontSize: 14,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  time: {
    fontSize: 11,
  },
  empty: {
    textAlign: "center",
    marginTop: 60,
    fontSize: 14,
  },
});