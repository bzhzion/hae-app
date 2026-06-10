import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';

const COLORS = ['#A00000','#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2'];

function colorForName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

interface Props {
  name: string;
  avatarUrl?: string | null;
  serverUrl?: string;
  token?: string;
  size?: number;
}

export default function UserAvatar({ name, avatarUrl, serverUrl, token, size = 36 }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = colorForName(name);

  useEffect(() => {
    if (!avatarUrl || !serverUrl || !token) return;
    const url = avatarUrl.startsWith('http') ? avatarUrl : `${serverUrl}${avatarUrl}`;
    if (Platform.OS === 'web') {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(b => setImgSrc(URL.createObjectURL(b)))
        .catch(() => {});
    } else {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.arrayBuffer())
        .then(buf => {
          const bytes = new Uint8Array(buf);
          let binary = '';
          bytes.forEach(b => binary += String.fromCharCode(b));
          setImgSrc(`data:image/jpeg;base64,${btoa(binary)}`);
        })
        .catch(() => {});
    }
  }, [avatarUrl, serverUrl, token]);

  const r = size / 2;

  if (imgSrc) {
    return <Image source={{ uri: imgSrc }} style={[s.avatar, { width: size, height: size, borderRadius: r }]} accessibilityLabel={name} />;
  }

  return (
    <View accessible={true} accessibilityLabel={name} style={[s.avatar, { width: size, height: size, borderRadius: r, backgroundColor: color + '22' }]}>
      <Text accessible={false} style={[s.initials, { fontSize: size * 0.33, color }]}>{initials}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  avatar:   { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontWeight: '700' },
});
