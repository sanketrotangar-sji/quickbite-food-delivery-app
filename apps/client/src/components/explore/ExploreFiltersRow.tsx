import { CategoryChips, type CuisineChip } from '@/components/home/CategoryChips';
import type { QuickFilter } from '@/lib/explore-filters';

import { ExploreFilterChip } from './ExploreFilterChip';

const QUICK_CHIPS: CuisineChip[] = [
  { id: 'all', label: 'All', icon: 'grid-outline' },
  { id: 'veg', label: 'Pure Veg', icon: 'leaf', tint: '#2E9B57' },
  { id: 'fast', label: 'Fast Delivery', icon: 'flash-outline' },
  { id: 'offers', label: 'Offers', icon: 'pricetag-outline' },
  { id: 'top', label: 'Top Rated', icon: 'star-outline' },
  { id: 'budget', label: 'Under ₹200', icon: 'wallet-outline' },
];

export function ExploreFiltersRow({
  selectedId,
  filterCount,
  onSelect,
  onOpenFilters,
}: {
  selectedId: QuickFilter | null;
  filterCount: number;
  onSelect: (id: QuickFilter) => void;
  onOpenFilters: () => void;
}) {
  return (
    <CategoryChips
      leading={<ExploreFilterChip count={filterCount} onPress={onOpenFilters} />}
      chips={QUICK_CHIPS}
      selectedId={selectedId ?? ''}
      onSelect={(id) => onSelect(id as QuickFilter)}
    />
  );
}
