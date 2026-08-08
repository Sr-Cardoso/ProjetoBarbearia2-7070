import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { Fonts } from "@/constants/theme";

export default function TabLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: Fonts.sansMedium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agendar"
        options={{
          title: "Agendar",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="loja"
        options={{
          title: "Loja",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "bag" : "bag-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="contato"
        options={{
          title: "Contato",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "call" : "call-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
