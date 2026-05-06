// @ts-nocheck
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

function Icon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={22} {...props} />;
}

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
        options={{ title: '学習', tabBarIcon: ({ color }) => <Icon name="graduation-cap" color={color} /> }}
      />
      <Tabs.Screen
        name="add"
        options={{ title: '追加', tabBarIcon: ({ color }) => <Icon name="plus-circle" color={color} /> }}
      />
      <Tabs.Screen
        name="words"
        options={{ title: '一覧', tabBarIcon: ({ color }) => <Icon name="list" color={color} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: '進捗', tabBarIcon: ({ color }) => <Icon name="bar-chart" color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: '設定', tabBarIcon: ({ color }) => <Icon name="cog" color={color} /> }}
      />
    </Tabs>
  );
}

