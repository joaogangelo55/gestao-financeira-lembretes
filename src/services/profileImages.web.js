import * as ImagePicker from 'expo-image-picker';
import { getSupabase } from './supabaseClient';

export async function chooseProfileImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { cancelled: true, reason: 'permission' };

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (result.canceled) return { cancelled: true };

  const asset = result.assets[0];
  const supabase = getSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Entre novamente antes de alterar a foto.');

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const extension = asset.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${authData.user.id}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: asset.mimeType || 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return { cancelled: false, uri: data.publicUrl };
}

export async function removeProfileImage(uri) {
  const marker = '/storage/v1/object/public/avatars/';
  const index = String(uri || '').indexOf(marker);
  if (index < 0) return;
  const path = uri.slice(index + marker.length);
  await getSupabase().storage.from('avatars').remove([path]);
}
