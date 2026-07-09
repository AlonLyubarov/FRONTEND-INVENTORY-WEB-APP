import { HttpErrorResponse } from '@angular/common/http';

const GENERIC_MESSAGE = 'Something went wrong, please try again.';

/**
 * The API returns errors in two shapes: `{ "error": "message" }` on most
 * endpoints, and a PLAIN STRING body on some item/transaction 400s.
 * ASP.NET model validation failures arrive as `{ errors: { field: [msgs] } }`.
 * This helper normalizes all of them to a single display string.
 */
export function extractErrorMessage(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) {
    return err instanceof Error && err.message ? err.message : GENERIC_MESSAGE;
  }

  const body: unknown = err.error;

  if (typeof body === 'string' && body.trim().length > 0) {
    // Some 400s are a plain string; guard against an HTML error page.
    if (!body.trimStart().startsWith('<')) {
      return body;
    }
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;

    if (typeof record['error'] === 'string' && record['error']) {
      return record['error'];
    }

    // ASP.NET ModelState: { errors: { Field: ["msg", ...], ... } }
    const modelState = record['errors'];
    if (modelState && typeof modelState === 'object') {
      const messages = Object.values(modelState as Record<string, unknown>)
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .filter((value): value is string => typeof value === 'string');
      if (messages.length > 0) {
        return messages.join(' ');
      }
    }

    // ProblemDetails fallback
    if (typeof record['detail'] === 'string' && record['detail']) {
      return record['detail'];
    }
    if (typeof record['title'] === 'string' && record['title']) {
      return record['title'];
    }
  }

  if (err.status === 0) {
    return 'Cannot reach the server. Is the API running?';
  }

  return GENERIC_MESSAGE;
}
