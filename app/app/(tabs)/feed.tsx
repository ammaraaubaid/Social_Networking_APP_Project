import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

// const API_URL = "https://sda-app-backend.onrender.com"; 
const API_URL = "http://127.0.0.1:8000"

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = async () => {
    try {
      const res = await fetch(`${API_URL}/feed`);
      const data = await res.json();
      setPosts(data);
    } catch (e) {
      console.log("Feed error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh feed when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Unifi Feed</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <View style={styles.post}>
              <Text style={styles.username}>@{item.username}</Text>
              <Text style={styles.content}>{item.content}</Text>

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

              <Text style={styles.time}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString()
                  : ""}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No posts yet. Create one!</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 50,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  post: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  username: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
  },
  content: {
    marginTop: 5,
    fontSize: 14,
    color: "#444",
  },
  image: {
    width: "100%",
    height: 200,
    marginTop: 10,
    borderRadius: 10,
  },
  time: {
    marginTop: 8,
    fontSize: 11,
    color: "gray",
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    color: "gray",
  },
});