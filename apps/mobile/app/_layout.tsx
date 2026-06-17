import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: "#fbfaf7" },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fbfaf7" },
          headerTintColor: "#16202a"
        }}
      />
      <StatusBar style="dark" />
    </>
  );
}

