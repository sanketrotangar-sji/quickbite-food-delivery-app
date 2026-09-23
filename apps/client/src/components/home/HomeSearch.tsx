import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fonts } from '@/constants/theme';

const DEFAULT_PLACEHOLDER = 'Search for dishes, restaurants or cuisines...';

export function HomeSearch({
  value,
  onChangeText,
  onFilterPress,
  onPress,
  autoFocus,
  placeholder = DEFAULT_PLACEHOLDER,
}: {
  value: string;
  onChangeText?: (text: string) => void;
  onFilterPress?: () => void;
  onPress?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.field} accessibilityRole="button" accessibilityLabel={value ? `Search, ${value}` : placeholder}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <AppText numberOfLines={1} weight="medium" style={[styles.ghost, !value && styles.ghostMuted]}>
          {value || placeholder}
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.field}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
        returnKeyType="search"
      />
      {onFilterPress ? (
        <Pressable onPress={onFilterPress} hitSlop={8} accessibilityLabel="Filter">
          <Ionicons name="options-outline" size={18} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  ghost: { flex: 1, fontSize: 13, color: colors.text },
  ghostMuted: { color: colors.textMuted },
});
