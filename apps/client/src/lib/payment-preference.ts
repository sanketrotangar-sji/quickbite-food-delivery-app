import type { PaymentMethodId } from '@/components/PaymentSheet';

let selected: PaymentMethodId = 'cash';

export function getPaymentPreference(): PaymentMethodId {
  return selected;
}

export function setPaymentPreference(method: PaymentMethodId) {
  selected = method;
}
