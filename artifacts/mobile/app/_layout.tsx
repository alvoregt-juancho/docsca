import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useLayoutEffect } from "react";
import { NativeModules } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProjectProvider } from "@/context/ProjectContext";

const keyboardControllerAvailable = !!NativeModules.KeyboardControllerNative;

// Keep the splash visible until we explicitly dismiss it.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function hideSplash() {
  // SDK 54: use synchronous hide() which works on new arch.
  // hideAsync() hangs silently on the new RN architecture.
  try {
    SplashScreen.hide();
  } catch {
    SplashScreen.hideAsync().catch(() => {});
  }
}

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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Dismiss as soon as this component mounts — synchronously, before paint.
  // This fires on the very first render regardless of font status.
  useLayoutEffect(() => {
    hideSplash();
  }, []);

  // Belt-and-suspenders: also dismiss when fonts resolve (or error).
  useEffect(() => {
    if (fontsLoaded || fontError) {
      hideSplash();
    }
  }, [fontsLoaded, fontError]);

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
