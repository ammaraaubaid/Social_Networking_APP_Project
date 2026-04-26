
import React, { useState } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// const API_URL = "https://sda-app-backend.onrender.com";
const API_URL = "http://127.0.0.1:8000"

const lightTheme = {
  bg: '#ffffff', card: '#ffffff', text: '#111111',
  subtext: '#666666', border: '#efefef',
};
const darkTheme = {
  bg: '#000000', card: '#111111', text: '#f1f1f1',
  subtext: '#aaaaaa', border: '#222222',
};

function SearchItem({ item, theme, onPress }: any) {
  const avatar = item.avatar
    ? item.avatar.startsWith("http")
      ? item.avatar
      : `${API_URL}${item.avatar}`
    : null;

  return (
    <TouchableOpacity onPress={() => onPress(item)}>
      <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}>
        
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#ccc",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <Ionicons name="person" size={20} color="#666" />
          </View>
        )}

        <View style={{ marginLeft: 10 }}>
          <Text style={{ color: theme.text }}>{item.username}</Text>
          <Text style={{ color: theme.subtext }}>{item.name}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (text: string) => {
    setQuery(text);

    if (text.trim().length === 0) {
      setResults([]);
      return;
    }

    try {
      console.log("🔍 Searching:", text);

      const res = await fetch(
        `${API_URL}/search?query=${encodeURIComponent(text)}`
      );

      const data = await res.json();
      setResults(data);

    } catch (err) {
      console.log("❌ Search error:", err);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* NAVBAR */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', padding: 10,
        borderBottomWidth: 1, borderColor: theme.border,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <TextInput
          style={{
            flex: 1, marginLeft: 10, padding: 6,
            backgroundColor: theme.card, borderRadius: 8, color: theme.text,
          }}
          placeholder="Search"
          placeholderTextColor={theme.subtext}
          value={query}
          onChangeText={handleSearch}
          autoFocus
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <SearchItem
            item={item}
            theme={theme}
            onPress={(user) => {
              console.log("👉 Open profile:", user.id);
              router.push(`/profile/${user.id}`);
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}
