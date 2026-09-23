import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { FlowHeader } from '@/components/FlowHeader';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, radii } from '@/constants/theme';
import { HELP_TOPICS } from '@/features/rider/rider-content';

export function HelpScreen() {
  const [query, setQuery] = useState('');
  const topics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return HELP_TOPICS;
    return HELP_TOPICS.filter((topic) => `${topic.title} ${topic.body}`.toLowerCase().includes(needle));
  }, [query]);

  return (
    <Screen>
      <FlowHeader title="Help and support" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label="Search help" value={query} onChangeText={setQuery} placeholder="Restaurant, address, earnings" />
        {topics.length === 0 ? (
          <AppText muted>Nothing matches that. Try “address” or “earnings”.</AppText>
        ) : (
          topics.map((topic) => (
            <View key={topic.id} style={styles.topic}>
              <AppText weight="semibold">{topic.title}</AppText>
              <AppText muted style={styles.body}>
                {topic.body}
              </AppText>
            </View>
          ))
        )}
        <View style={styles.support}>
          <AppText weight="semibold">Talk to support</AppText>
          <AppText muted style={styles.body}>
            Call +91 83200 44110 during delivery hours. In-app chat is not open yet.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  topic: { gap: 4 },
  support: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  body: { fontSize: 13, lineHeight: 18 },
});
