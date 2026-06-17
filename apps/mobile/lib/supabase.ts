import "react-native-url-polyfill/auto";

import {
  createWanderKitSupabaseClient,
  getOptionalMobileSupabaseConfig,
  type WanderKitSupabaseClient
} from "@wanderkit/supabase";

const mobileSupabaseConfig = getOptionalMobileSupabaseConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
});

let mobileSupabaseClient: WanderKitSupabaseClient | null = null;

export function isMobileSupabaseConfigured(): boolean {
  return mobileSupabaseConfig !== null;
}

export function getMobileSupabaseClient(): WanderKitSupabaseClient | null {
  if (!mobileSupabaseConfig) {
    return null;
  }

  mobileSupabaseClient ??= createWanderKitSupabaseClient(mobileSupabaseConfig);
  return mobileSupabaseClient;
}

