import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** UX-only guards — the server remains the source of truth for authorization. */

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Optimistic: a session with an expired access token but a live refresh token
  // is still valid — the interceptor refreshes it on the first API call. If the
  // refresh token is dead too, that first call 401s and logs the user out.
  if (auth.isLoggedIn()) {
    return true;
  }
  auth.logout();
  return router.createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAdmin() ? true : router.createUrlTree(['/dashboard']);
};
