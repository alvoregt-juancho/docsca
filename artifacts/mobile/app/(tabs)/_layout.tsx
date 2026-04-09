import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

function SettingsButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push("/settings")}
      style={{ paddingRight: 4, padding: 6 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Feather name="settings" size={22} color={Colors.primaryForeground} />
    </TouchableOpacity>
  );
}

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "DocScan",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.primaryForeground,
          headerTitleStyle: {
            fontFamily: "Inter_700Bold",
            fontSize: 20,
          },
          headerRight: () => <SettingsButton />,
        }}
      />
    </Stack>
  );
}
