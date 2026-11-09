// eslint-disable-next-line no-restricted-imports
import { Alert, type AlertButton } from 'react-native';

/**
 * Native dialog for choices (confirm log out, remove address, open settings).
 * One-line feedback (saved / failed) uses `toast` from sonner-native instead.
 */
export function showDialog(title: string, message?: string, buttons?: AlertButton[]) {
  Alert.alert(title, message, buttons);
}
