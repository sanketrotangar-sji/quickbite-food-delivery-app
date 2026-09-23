import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';

export function RiderHero({ name }: { name: string }) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.card}>
      <Image
        source={require('../../../../assets/images/rider-hero.png')}
        style={styles.art}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <View style={styles.copy}>
        <AppText weight="semibold" style={styles.hello}>
          {hello}, {name}!
        </AppText>
        <AppText heading weight="bold" style={styles.title}>
          Let's deliver some happiness
        </AppText>
        <View style={styles.note}>
          <Ionicons name="bicycle" size={14} color={colors.overlay} />
          <AppText style={styles.noteText}>More deliveries. More earnings.</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    minHeight: 168,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  art: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  copy: { paddingHorizontal: 16, paddingVertical: 18, maxWidth: '78%', gap: 4 },
  hello: {
    color: colors.text,
    fontSize: 13,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  noteText: { color: colors.text, fontSize: 12, flex: 1 },
});
