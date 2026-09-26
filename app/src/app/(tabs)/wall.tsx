// Wall: watch a city fill up with someone's life. A map of every window they've sent.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { Chip, T } from '@/components/ui';
import { getMatches, getWall } from '@/lib/data';
import { stampLine } from '@/lib/time';
import { colors, fonts, radius, shadow } from '@/lib/theme';
import type { Match, WindowItem } from '@/lib/types';

// Windows without a named spot get a stable pin near the city center
function jitter(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return { dLat: ((h % 100) / 100) * 0.02 - 0.01, dLng: (((h >> 8) % 100) / 100) * 0.02 - 0.01 };
}

export default function Wall() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      getMatches().then((ms) => {
        const active = ms.filter((m) => m.status !== 'ended');
        setMatches(active);
        setSelected((s) => s ?? active[0]?.id ?? null);
      });
    }, []),
  );

  useEffect(() => {
    if (selected) getWall(selected).then(setWindows).catch(() => setWindows([]));
  }, [selected]);

  const match = matches.find((m) => m.id === selected);
  const p = match?.partner;

  return (
    <Screen scroll gap={14} padBottom={TAB_BAR_SPACE} edges={['top']} style={{ paddingHorizontal: 20 }}>
      <View>
        <T variant="small" style={{ fontSize: 14 }}>
          {p ? `${windows.length} window${windows.length === 1 ? '' : 's'} from ${p.name}` : 'Your windows'}
        </T>
        <T variant="display">{p ? `${p.name}'s ${p.home_city}` : 'Wall'}</T>
      </View>

      {matches.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {matches.map((m) => (
            <Chip key={m.id} small label={m.city} selected={m.id === selected} onPress={() => setSelected(m.id)} />
          ))}
        </ScrollView>
      ) : null}

      {p ? (
        <View style={{ height: 360, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#E4E9DE' }}>
          <MapView
            key={p.id}
            style={{ flex: 1 }}
            initialRegion={{ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
            toolbarEnabled={false}
          >
            {windows.map((w, i) => {
              const j = jitter(w.id);
              const lat = w.spot_lat ?? p.lat + j.dLat;
              const lng = w.spot_lng ?? p.lng + j.dLng;
              return (
                <Marker
                  key={w.id}
                  coordinate={{ latitude: lat, longitude: lng }}
                  title={w.spot ?? w.caption_t ?? 'Window'}
                  onCalloutPress={() => router.push({ pathname: '/window/[id]', params: { id: w.id } })}
                >
                  <View style={[{ width: 58, padding: 3, paddingBottom: 10, borderRadius: 4, backgroundColor: colors.postcard, transform: [{ rotate: `${[-6, 5, -3, 7][i % 4]}deg` }] }, shadow.soft]}>
                    <Image source={{ uri: w.photo_url }} style={{ height: 46, borderRadius: 2 }} contentFit="cover" />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        </View>
      ) : (
        <T variant="muted">Once you have a match, their windows will fill up a map of their city here.</T>
      )}

      <View style={{ gap: 8 }}>
        {windows.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => router.push({ pathname: '/window/[id]', params: { id: w.id } })}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.white },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ width: 40, height: 48, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', backgroundColor: colors.line }}>
              <Image source={{ uri: w.photo_url }} style={{ flex: 1 }} contentFit="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <T numberOfLines={1} style={{ fontFamily: fonts.semibold }}>{w.caption_t || w.spot || 'A window'}</T>
              <T variant="small">{w.spot ? `${w.spot} · ` : ''}{p ? stampLine(w.created_at, p.tz) : ''}</T>
            </View>
            {w.saved ? <T style={{ color: colors.light, fontSize: 18 }}>★</T> : null}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
