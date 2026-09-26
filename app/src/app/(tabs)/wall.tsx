// Wall: a corkboard of everything your pen pal has shown you. A pinned map of their city,
// and their windows pinned up like polaroids.
import { useCallback, useEffect, useState } from 'react';
import { Image as RNImage, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MapView, { Marker } from 'react-native-maps';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaperGrain, Thumbtack } from '@/components/materials';
import { T } from '@/components/ui';
import { getMatches, getWall } from '@/lib/data';
import { stampLine } from '@/lib/time';
import { colors, fonts, gutter, motion, shadow, textures } from '@/lib/theme';
import type { Match, WindowItem } from '@/lib/types';

// Windows without a named spot get a stable pin near the city center
function jitter(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return { dLat: ((h % 100) / 100) * 0.02 - 0.01, dLng: (((h >> 8) % 100) / 100) * 0.02 - 0.01 };
}

const TILTS = [-3, 2.5, -1.5, 3.5, -2.5, 1.5];
const TACKS = [colors.terracotta, colors.dusk, colors.light, colors.sky];

export default function Wall() {
  const { width: screenW } = useWindowDimensions();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      getMatches().then((ms) => {
        // One pen pal at a time
        const current = ms.filter((m) => m.status !== 'ended').slice(0, 1);
        setMatches(current);
        setSelected(current[0]?.id ?? null);
      });
    }, []),
  );

  useEffect(() => {
    if (selected) getWall(selected).then(setWindows).catch(() => setWindows([]));
  }, [selected]);

  const match = matches.find((m) => m.id === selected);
  const p = match?.partner;
  const cardW = (screenW - gutter * 2 - 18) / 2;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#B08052' }}>
      <RNImage source={textures.cork} resizeMode="repeat" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 30, gap: 20 }} showsVerticalScrollIndicator={false}>
        {/* title card pinned to the board */}
        <View style={[{ alignSelf: 'flex-start', backgroundColor: colors.postcard, paddingVertical: 10, paddingHorizontal: 16, transform: [{ rotate: '-1.5deg' }] }, shadow.card]}>
          <PaperGrain />
          <Thumbtack style={{ position: 'absolute', top: -6, left: '48%' }} />
          <T variant="eyebrow" style={{ color: colors.muted }}>
            {p ? `${windows.length} window${windows.length === 1 ? '' : 's'} from ${p.name}` : 'Your wall'}
          </T>
          <T variant="title">{p ? `${p.name}'s ${p.home_city}` : 'Wall'}</T>
        </View>

        {p ? (
          // a map fragment, pinned at two corners
          <View style={[{ backgroundColor: colors.postcard, padding: 6, transform: [{ rotate: '0.8deg' }] }, shadow.card]}>
            <View style={{ height: 300, overflow: 'hidden' }}>
              <MapView
                key={p.id}
                style={{ flex: 1 }}
                initialRegion={{ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
                toolbarEnabled={false}
              >
                {windows.map((w, i) => {
                  const j = jitter(w.id);
                  return (
                    <Marker
                      key={w.id}
                      coordinate={{ latitude: w.spot_lat ?? p.lat + j.dLat, longitude: w.spot_lng ?? p.lng + j.dLng }}
                      title={w.spot ?? w.caption_t ?? 'Window'}
                      onCalloutPress={() => router.push({ pathname: '/window/[id]', params: { id: w.id } })}
                    >
                      <View style={[{ width: 54, padding: 3, paddingBottom: 9, backgroundColor: colors.postcard, transform: [{ rotate: `${TILTS[i % TILTS.length]}deg` }] }, shadow.soft]}>
                        <Image source={{ uri: w.photo_url }} style={{ height: 42 }} contentFit="cover" />
                      </View>
                    </Marker>
                  );
                })}
              </MapView>
            </View>
            <Thumbtack color={colors.terracotta} style={{ position: 'absolute', top: -5, left: 10 }} />
            <Thumbtack color={colors.dusk} style={{ position: 'absolute', top: -5, right: 10 }} />
          </View>
        ) : (
          <View style={[{ backgroundColor: colors.postcard, padding: 16 }, shadow.soft]}>
            <T variant="muted">Once you have a pen pal, their windows get pinned up here.</T>
          </View>
        )}

        {/* their windows, pinned up like polaroids */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
          {windows.map((w, i) => (
            <Animated.View key={w.id} entering={FadeInDown.delay(i * motion.stagger * 2).duration(motion.settle)} style={{ width: cardW }}>
              <Pressable
                onPress={() => router.push({ pathname: '/window/[id]', params: { id: w.id } })}
                style={({ pressed }) => [
                  { backgroundColor: colors.postcard, padding: 7, paddingBottom: 10, gap: 6, transform: [{ rotate: `${TILTS[i % TILTS.length]}deg` }] },
                  shadow.card,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Image source={{ uri: w.photo_url }} style={{ height: cardW * 0.95 }} contentFit="cover" />
                <Text numberOfLines={2} style={{ fontFamily: fonts.hand, fontSize: 19, lineHeight: 20, color: colors.hand }}>
                  {w.caption_t || w.spot || 'a window'}
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted }}>
                  {w.spot ? `${w.spot} · ` : ''}{stampLine(w.created_at, p?.tz ?? 'UTC')}
                </Text>
                <Thumbtack color={TACKS[i % TACKS.length]} size={13} style={{ position: 'absolute', top: -5, left: cardW / 2 - 7 }} />
                {w.saved ? <Text style={{ position: 'absolute', right: 10, top: 10, fontSize: 16, color: colors.light }}>★</Text> : null}
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
