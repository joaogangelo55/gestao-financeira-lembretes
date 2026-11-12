
import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// Configurações já existentes no arquivo .env.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;

const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Verifica se a conexão foi configurada.
export function isSupabaseConfigured() {
  return Boolean(url && publishableKey);
}

// Mantém uma única instância do cliente.
let client;

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado. Confira ' +
      'EXPO_PUBLIC_SUPABASE_URL e ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
      'no arquivo .env.'
    );
  }

  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        // Armazena a sessão localmente.
        storage: localStorage,

        // Mantém a sessão após fechar o aplicativo.
        persistSession: true,

        // Atualiza tokens de sessão.
        autoRefreshToken: true,

        // Lê sessões de URLs somente no navegador.
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }

  return client;
}
