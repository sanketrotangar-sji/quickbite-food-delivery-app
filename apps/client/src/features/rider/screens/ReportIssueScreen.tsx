import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FlowHeader } from '@/components/FlowHeader';
import { Screen } from '@/components/Screen';
import { colors, radii } from '@/constants/theme';
import { ISSUE_OPTIONS } from '@/features/rider/rider-content';

export function ReportIssueScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <Screen>
      <FlowHeader title="Report an issue" />
      {sent ? (
        <View style={styles.done}>
          <AppText heading weight="bold" style={styles.title}>
            Issue sent
          </AppText>
          <AppText muted style={styles.body}>
            QuickBite has {selected?.toLowerCase()}. Stay with the order unless support tells you to leave.
          </AppText>
          <Button label="Back to delivery" onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <AppText muted>What happened on this trip?</AppText>
          {ISSUE_OPTIONS.map((option) => {
            const on = option === selected;
            return (
              <Pressable key={option} onPress={() => setSelected(option)} style={[styles.option, on && styles.optionOn]}>
                <AppText weight="semibold" style={on ? styles.optionTextOn : undefined}>
                  {option}
                </AppText>
              </Pressable>
            );
          })}
          <Button label="Submit" onPress={() => setSent(true)} disabled={!selected} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTextOn: { color: colors.primaryDark },
  done: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28 },
  body: { lineHeight: 20 },
});
