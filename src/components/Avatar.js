import { Image, StyleSheet, Text, View } from 'react-native';

export function initials(name) {
  return String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

export default function Avatar({ name, uri, size = 48 }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[styles.image, style]} accessibilityLabel={`Foto de ${name}`} />;
  return <View style={[styles.fallback, style]} accessibilityLabel={`Avatar de ${name}`}><Text style={[styles.letters, { fontSize: size * 0.34 }]}>{initials(name)}</Text></View>;
}

const styles = StyleSheet.create({ fallback: { backgroundColor: '#163300', alignItems: 'center', justifyContent: 'center' }, image: { backgroundColor: '#E1E5DC' }, letters: { color: '#9FE870', fontWeight: '900' } });
