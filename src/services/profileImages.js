import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

export async function chooseProfileImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { cancelled: true, reason: 'permission' };
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (result.canceled) return { cancelled: true };
  const asset = result.assets?.[0];
  if (!asset?.uri || (asset.fileSize && asset.fileSize > 8 * 1024 * 1024)) throw new Error('Escolha uma imagem de até 8 MB.');
  const extension = asset.mimeType?.split('/')[1] || 'jpg';
  const destination = new File(Paths.document, `avatar-${Date.now()}.${extension}`);
  await new File(asset.uri).copy(destination);
  return { cancelled: false, uri: destination.uri };
}

export function removeProfileImage(uri) {
  if (!uri) return;
  try { new File(uri).delete(); } catch { /* arquivo já pode não existir */ }
}
