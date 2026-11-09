import { AddressForm } from '@/features/addresses/components/AddressForm';
import { Sheet } from '@/components/Sheet';
import type { AddressDraft, SavedAddress } from '@/lib/addresses';

export function AddressEditorModal({
  visible,
  initial,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initial?: SavedAddress | null;
  onClose: () => void;
  onSubmit: (draft: AddressDraft) => void | Promise<void>;
}) {
  const editing = Boolean(initial);

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? 'Edit address' : 'New address'}>
      {visible ? (
        <AddressForm
          key={initial?.id ?? 'new'}
          initial={initial}
          submitLabel={editing ? 'Save changes' : 'Save address'}
          onSubmit={onSubmit}
        />
      ) : null}
    </Sheet>
  );
}
