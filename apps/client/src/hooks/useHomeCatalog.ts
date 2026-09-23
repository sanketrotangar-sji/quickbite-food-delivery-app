import { useQuery } from '@tanstack/react-query';

import { fetchHomeCatalog } from '@/api/home';

export function useHomeCatalog() {
  return useQuery({
    queryKey: ['home-catalog'],
    queryFn: fetchHomeCatalog,
  });
}
