import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
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
 * Single functional interceptor implementing the app-wide HTTP rules:
 *  - Bearer token on everything except /auth/* and /warehouse/public-list
 *  - expired expiresAt ⇒ treated as 401 before the request is sent
 *  - 401 ⇒ clear session + redirect to /login with a "session expired" toast
 *  - 403 ⇒ access-denied toast, NO logout
 *  - 500 ⇒ generic toast
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
    // Only the first failing request logs out and redirects; parallel 401s are silent.
    if (auth.isLoggedIn()) {
      auth.logout();
      toast.warning('Your session has expired. Please sign in again.');
      void router.navigate(['/login']);
    }
  };

  if (!isPublic) {
    if (auth.isLoggedIn() && auth.isSessionExpired()) {
      expireSession();
      return throwError(
        () => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized', url: req.url })
      );
    }

    const token = auth.getToken();
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401 && !isPublic) {
          expireSession();
        } else if (err.status === 403) {
          toast.error("You don't have access to this resource.");
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
