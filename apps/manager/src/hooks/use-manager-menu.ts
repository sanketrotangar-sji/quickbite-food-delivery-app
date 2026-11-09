import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  setMenuItemAvailability,
  setMenuItemVeg,
  suggestDishTagsFromPhoto,
  updateMenuItemReview,
  uploadMenuImage,
  type DbMenuItem,
  type VisionAnalysis,
} from '@quickbite/api/dashboard/menu';
import type { MenuItem } from '@/lib/quickbite-data';

import { useOwnedRestaurant } from './use-restaurant';

export type { VisionAnalysis };

export function toUiMenuItem(row: DbMenuItem, restaurantName: string): MenuItem {
  return {
    id: row.id,
    name: row.name,
    restaurant: restaurantName,
    category: row.category?.trim() || '',
    description: row.description?.trim() || '',
    price: Number(row.price),
    available: row.is_available,
    veg: row.is_veg,
    image: row.image_url ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

export function useManagerMenu() {
  const { data: restaurant } = useOwnedRestaurant();
  const restaurantId = restaurant?.id;
  const restaurantName = restaurant?.name ?? '';

  return useQuery({
    queryKey: ['manager-menu', restaurantId],
    queryFn: async () => {
      const rows = await listMenuItems(restaurantId!);
      return rows.map((row) => toUiMenuItem(row, restaurantName));
    },
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
  });
}

export function useToggleMenuAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) => setMenuItemAvailability(id, available),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-menu'] });
    },
  });
}

export function useToggleMenuVeg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isVeg }: { id: string; isVeg: boolean }) => setMenuItemVeg(id, isVeg),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-menu'] });
    },
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-menu'] });
    },
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  const { data: restaurant } = useOwnedRestaurant();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      category: string;
      description: string;
      price: number;
      isAvailable: boolean;
      isVeg: boolean;
      tags?: string[];
      imageFile?: File;
    }) => {
      if (!restaurant) throw new Error('No restaurant assigned.');
      let imageUrl: string | undefined;
      if (input.imageFile) {
        imageUrl = await uploadMenuImage(restaurant.id, input.imageFile);
      }
      return createMenuItem({
        restaurantId: restaurant.id,
        name: input.name,
        category: input.category,
        description: input.description,
        price: input.price,
        isAvailable: input.isAvailable,
        isVeg: input.isVeg,
        tags: input.tags ?? [],
        ...(imageUrl ? { imageUrl } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-menu'] });
    },
  });
}

export function useUpdateMenuItemReview() {
  const queryClient = useQueryClient();
  const { data: restaurant } = useOwnedRestaurant();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      category: string;
      description?: string;
      price?: number;
      isVeg: boolean;
      tags: string[];
      imageFile?: File;
    }) => {
      let imageUrl: string | undefined;
      if (input.imageFile && restaurant) {
        imageUrl = await uploadMenuImage(restaurant.id, input.imageFile);
      }
      return updateMenuItemReview(input.id, {
        name: input.name,
        category: input.category,
        description: input.description,
        price: input.price,
        isVeg: input.isVeg,
        tags: input.tags,
        ...(imageUrl ? { imageUrl } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-menu'] });
    },
  });
}

export function useSuggestDishTags() {
  return useMutation({
    mutationFn: (input: {
      imageDataUrl?: string | null;
      imageUrl?: string | null;
      dishNameHint?: string | null;
      descriptionHint?: string | null;
      categoryHint?: string | null;
    }) => suggestDishTagsFromPhoto(input),
  });
}
