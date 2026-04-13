import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import { NativeModules } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProjectProvider } from "@/context/ProjectContext";

const keyboardControllerAvailable = !!NativeModules.KeyboardControllerNative;

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="camera"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="new-project"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  if (keyboardControllerAvailable) {
    return <KeyboardProvider>{children}</KeyboardProvider>;
  }
  return <>{children}</>;
}

export default function RootLayout() {
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProviders>
              <ProjectProvider>
                <RootLayoutNav />
              </ProjectProvider>
            </AppProviders>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
