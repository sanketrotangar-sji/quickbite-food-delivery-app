export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
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
