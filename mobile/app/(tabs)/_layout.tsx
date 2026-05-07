// @ts-nocheck
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#818cf8',
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarInactiveTintColor: '#94a3b8',
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f1f5f9',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '学習',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="book-edit-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '追加',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="words"
        options={{
          title: '一覧',
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: '進捗',
          tabBarIcon: ({ color }) => <Ionicons name="trending-up-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

