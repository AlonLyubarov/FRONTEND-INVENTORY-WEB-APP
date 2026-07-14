import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Preload lazy route chunks in the background so first navigation
    // to a screen doesn't wait for its bundle download.
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Rebuild the in-memory session from the HttpOnly refresh cookie before the
    // app renders, so guards see the correct auth state on the first navigation.
    provideAppInitializer(() => inject(AuthService).restoreSession())
  ]
};
