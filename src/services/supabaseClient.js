import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(url && publishableKey);
}

const nativeSessionStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

function sessionStorage() {
  if (Platform.OS === 'web') return localStorage;
  return nativeSessionStorage;
}

let client;

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado. Confira EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no arquivo .env.'
    );
  }

  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        storage: sessionStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }

  return client;
}
