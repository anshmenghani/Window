// Postage-stamp badge: city stamps on the match postcard and in the Passport.
import { Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export function Stamp({
  label, color = colors.dusk, textColor = colors.postcard, width = 70, height = 84, tilt = 4, children,
}: { label: string; color?: string; textColor?: string; width?: number; height?: number; tilt?: number; children?: React.ReactNode }) {
  return (
    <View
      style={{
        width, height, padding: 5, backgroundColor: colors.white, transform: [{ rotate: `${tilt}deg` }],
        borderWidth: 2, borderStyle: 'dashed', borderColor: '#C9CEDF',
      }}
    >
      <View style={{ flex: 1, backgroundColor: color, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5, gap: 4 }}>
        {children}
        <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8, color: textColor, textAlign: 'center' }}>
          {label.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}
