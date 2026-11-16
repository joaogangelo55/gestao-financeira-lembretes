import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { getSupabase } from './supabaseClient';

export async function chooseProfileImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { cancelled: true, reason: 'permission' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75,
  });
  if (result.canceled) return { cancelled: true };
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error('Não foi possível ler a foto escolhida.');

  const file = new File(asset.uri);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Escolha uma imagem de até 8 MB.');
  const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
    ? asset.mimeType : 'image/jpeg';
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Entre novamente antes de alterar a foto.');

  // Upload por usuário: imagens deixam de depender do caminho local de um aparelho.
  const path = `${data.user.id}/avatar-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType, upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  return { cancelled: false, uri: urlData.publicUrl };
}

export async function removeProfileImage(uri) {
  const marker = '/storage/v1/object/public/avatars/';
  const index = String(uri || '').indexOf(marker);
  if (index < 0) return; // Fotos locais legadas não são apagadas automaticamente.
  const path = decodeURIComponent(uri.slice(index + marker.length).split('?')[0]);
  const { error } = await getSupabase().storage.from('avatars').remove([path]);
  if (error) throw new Error(error.message);
}
