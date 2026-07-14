import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

/** Anonymous endpoints: no Bearer token, and a 401 must not clear the session. */
function isPublicUrl(url: string): boolean {
  return (
    url.startsWith(`${environment.apiBaseUrl}/auth/`) ||
    url === `${environment.apiBaseUrl}/warehouse/public-list`
  );
}

/** Only our own API gets the token and the global error handling. */
function isApiUrl(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}

/**
 * Single-flight refresh: when several requests 401 at once, only ONE call hits
 * /auth/refresh; the rest share its result. Module-level so it is shared across
 * every interceptor invocation. Emits the new access token.
 */
let refreshInFlight$: Observable<string> | null = null;

function refreshAccessToken(auth: AuthService): Observable<string> {
  refreshInFlight$ ??= auth.refresh().pipe(
    map((response) => response.token),
    shareReplay(1),
    finalize(() => {
      refreshInFlight$ = null;
    })
  );
  return refreshInFlight$;
}

/**
 * Single functional interceptor implementing the app-wide HTTP rules:
 *  - Bearer token on everything except /auth/* and /warehouse/public-list
 *  - 401 ⇒ transparently refresh the access token (once) and retry the request;
 *    if the refresh itself fails, clear the session and redirect to /login
 *  - 403 ⇒ access-denied toast, NO logout
 *  - 429 ⇒ surface the server's rate-limit message
 *  - 500 ⇒ generic toast
 *  - 0   ⇒ "cannot reach the server"
 *  - 400 is left for the calling form/action to surface via extractErrorMessage
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  // External requests (e.g. OpenStreetMap geocoding) pass through untouched.
  if (!isApiUrl(req.url)) {
    return next(req);
  }

  const isPublic = isPublicUrl(req.url);

  const expireSession = (): void => {
    // Only the first failing request logs out and redirects; parallel ones are silent.
    if (auth.isLoggedIn()) {
      auth.logout();
      toast.warning('Your session has expired. Please sign in again.');
      void router.navigate(['/login']);
    }
  };

  const attach = (accessToken: string): typeof req =>
    req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });

  if (!isPublic) {
    const token = auth.getToken();
    if (token) {
      req = attach(token);
    }
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // Access token rejected → try to refresh once (via the HttpOnly cookie),
        // then replay the request. Only when we believe there is a session.
        if (err.status === 401 && !isPublic && auth.isLoggedIn()) {
          return refreshAccessToken(auth).pipe(
            switchMap((freshToken) => next(attach(freshToken))),
            catchError((refreshErr: unknown) => {
              // Refresh (or the replayed request) failed → the session is dead.
              expireSession();
              return throwError(() => refreshErr);
            })
          );
        }

        if (err.status === 401 && !isPublic) {
          expireSession();
        } else if (err.status === 403) {
          toast.error("You don't have access to this resource.");
        } else if (err.status === 429) {
          // Rate limited — surface the server's message, never a validation error
          const body = err.error as { error?: string } | null;
          toast.warning(
            body?.error ?? 'Too many attempts. Please wait a moment and try again.'
          );
        } else if (err.status >= 500) {
          toast.error('Something went wrong, please try again.');
        } else if (err.status === 0) {
          toast.error('Cannot reach the server. Is the API running?');
        }
      }
      return throwError(() => err);
    })
  );
};
