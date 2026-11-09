import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';

export function NoteSheet({
  visible,
  title,
  body,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} footer={<Button label="Done" onPress={onClose} />}>
      <AppText variant="body" style={styles.body}>
        {body}
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { marginBottom: 4 },
});
