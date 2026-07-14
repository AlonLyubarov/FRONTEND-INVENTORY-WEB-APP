import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard, adminGuard } from './guards';
import { AuthResponse } from './models';

const STORAGE_KEY = 'inventory.auth';

function storedSession(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    token: 'jwt-token',
    refreshToken: 'refresh-token',
    username: 'alice',
    role: 'Admin',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    userId: 1,
    warehouseId: 2,
    ...overrides
  };
}

function configure(session?: AuthResponse) {
  localStorage.clear();
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
  });
}

// The guards ignore their arguments (they read AuthService), so empty snapshots are fine.
const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

const runAuthGuard = () => TestBed.runInInjectionContext(() => authGuard(route, state));
const runAdminGuard = () => TestBed.runInInjectionContext(() => adminGuard(route, state));

describe('authGuard', () => {
  afterEach(() => localStorage.clear());

  it('allows navigation for a valid session', () => {
    configure(storedSession());
    expect(runAuthGuard()).toBe(true);
  });

  it('redirects to /login when logged out', () => {
    configure();
    const result = runAuthGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('still allows an expired-access session that has a refresh token', () => {
    // The guard is optimistic: the interceptor will refresh on the first API call.
    configure(storedSession({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(runAuthGuard()).toBe(true);
  });
});

describe('adminGuard', () => {
  afterEach(() => localStorage.clear());

  it('allows an Admin through', () => {
    configure(storedSession({ role: 'Admin' }));
    expect(runAdminGuard()).toBe(true);
  });

  it('redirects a non-Admin to /dashboard', () => {
    configure(storedSession({ role: 'Employee' }));
    const result = runAdminGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/dashboard');
  });
});
