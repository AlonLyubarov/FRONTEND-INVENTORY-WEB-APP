import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard, adminGuard } from './guards';
import { AuthService } from './auth.service';
import { AuthResponse, Role } from './models';
import { environment } from '../../environments/environment';

function session(role: Role = 'Admin'): AuthResponse {
  return {
    token: 'jwt-token',
    username: 'alice',
    role,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    userId: 1,
    warehouseId: 2
  };
}

/** Configures TestBed and optionally logs the user in (session lives in memory). */
function configure(loggedInAs?: Role): void {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
  });
  if (loggedInAs) {
    const auth = TestBed.inject(AuthService);
    const httpMock = TestBed.inject(HttpTestingController);
    auth.login({ username: 'a', password: 'p' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(session(loggedInAs));
  }
}

// The guards ignore their arguments (they read AuthService), so empty snapshots are fine.
const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

const runAuthGuard = () => TestBed.runInInjectionContext(() => authGuard(route, state));
const runAdminGuard = () => TestBed.runInInjectionContext(() => adminGuard(route, state));

describe('authGuard', () => {
  afterEach(() => localStorage.clear());

  it('allows navigation for a logged-in user', () => {
    configure('Admin');
    expect(runAuthGuard()).toBe(true);
  });

  it('redirects to /login when logged out', () => {
    configure();
    const result = runAuthGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });
});

describe('adminGuard', () => {
  afterEach(() => localStorage.clear());

  it('allows an Admin through', () => {
    configure('Admin');
    expect(runAdminGuard()).toBe(true);
  });

  it('redirects a non-Admin to /dashboard', () => {
    configure('Employee');
    const result = runAdminGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/dashboard');
  });
});
