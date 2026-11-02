/** One error shape for the whole API: { error: { code, message, details? } } */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}
