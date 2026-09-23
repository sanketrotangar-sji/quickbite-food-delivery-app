export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class CartOtherRestaurantError extends ApiError {
  constructor(public currentRestaurantName: string) {
    super(
      `Your cart already has items from ${currentRestaurantName}. Clear it to add from a different restaurant.`,
      'CART_OTHER_RESTAURANT',
    );
    this.name = 'CartOtherRestaurantError';
  }
}

type MaybePostgrest = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function throwApiError(error: MaybePostgrest, fallback = 'Something went wrong.'): never {
  throw new ApiError(error.message || fallback, error.code);
}

export function isOtherRestaurantError(error: MaybePostgrest) {
  const blob = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
  return blob.includes('CART_OTHER_RESTAURANT') || blob.includes('different restaurant');
}
