export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (message = 'Not found') => new HttpError(404, message);
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
