// A postage stamp: perforated edge, slightly faded ink, city name.
import { Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { PaperGrain } from './materials';

export function Stamp({
  label, sub, color = colors.terracotta, textColor = colors.postcard, width = 70, height = 84, tilt = 4,
  edgeColor = colors.mist, children,
}: {
  label: string; sub?: string; color?: string; textColor?: string; width?: number; height?: number; tilt?: number;
  /** the color behind the stamp, used to cut the perforations */
  edgeColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        width, height, padding: 5, backgroundColor: colors.postcard, transform: [{ rotate: `${tilt}deg` }],
        borderWidth: 3, borderStyle: 'dotted', borderColor: edgeColor,
        shadowColor: '#3B2A1A', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
      }}
    >
      <View style={{ flex: 1, backgroundColor: color, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5, gap: 3, opacity: 0.92, overflow: 'hidden' }}>
        <PaperGrain opacity={0.9} />
        {children}
        <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.9, color: textColor, textAlign: 'center' }}>
          {label.toUpperCase()}
        </Text>
        {sub ? <Text style={{ fontFamily: fonts.medium, fontSize: 7.5, letterSpacing: 0.6, color: textColor, opacity: 0.85 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}
