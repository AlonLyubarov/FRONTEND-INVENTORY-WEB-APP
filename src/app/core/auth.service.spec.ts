import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { AuthResponse } from './models';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'inventory.auth';

function session(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    token: 'jwt-token',
    refreshToken: 'refresh-token',
    username: 'alice',
    role: 'Admin',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1h
    userId: 1,
    warehouseId: 2,
    ...overrides
  };
}

describe('AuthService', () => {
  let httpMock: HttpTestingController;

  function makeService(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    return service;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts logged out with no stored session', () => {
    const service = makeService();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.role()).toBeNull();
  });

  it('stores the session and updates signals on successful login', () => {
    const service = makeService();
    const response = session();

    service.login({ username: 'alice', password: 'secret' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(response);

    expect(service.isLoggedIn()).toBe(true);
    expect(service.getToken()).toBe('jwt-token');
    expect(service.isAdmin()).toBe(true);
    expect(service.warehouseId()).toBe(2);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('jwt-token');
  });

  it('classifies roles through computed signals', () => {
    const service = makeService();
    service.login({ username: 'e', password: 'p' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(session({ role: 'Employee' }));

    expect(service.isAdmin()).toBe(false);
    expect(service.isEmployee()).toBe(true);
    expect(service.isShiftManager()).toBe(false);
  });

  it('clears the session and revokes the refresh token on logout', () => {
    const service = makeService();
    service.login({ username: 'a', password: 'p' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(session());

    service.logout();

    // Logout fires a best-effort server-side revocation of the refresh token
    const revoke = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
    expect(revoke.request.body.refreshToken).toBe('refresh-token');
    revoke.flush({});

    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('exchanges the refresh token for a fresh session', () => {
    const service = makeService();
    service.login({ username: 'a', password: 'p' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(session());

    service.refresh().subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    expect(req.request.body.refreshToken).toBe('refresh-token');
    req.flush(session({ token: 'new-jwt', refreshToken: 'new-refresh' }));

    expect(service.getToken()).toBe('new-jwt');
    expect(service.getRefreshToken()).toBe('new-refresh');
  });

  it('treats a future expiry as active and a past expiry as expired', () => {
    const service = makeService();

    service.login({ username: 'a', password: 'p' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(session());
    expect(service.isSessionExpired()).toBe(false);

    service.login({ username: 'a', password: 'p' }).subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush(session({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(service.isSessionExpired()).toBe(true);
  });

  it('rehydrates a valid session from localStorage on construction', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session()));
    const service = makeService();
    expect(service.isLoggedIn()).toBe(true);
    expect(service.getToken()).toBe('jwt-token');
  });

  it('keeps an expired-access session that still has a refresh token', () => {
    // The access token is stale, but the refresh token lets the interceptor
    // mint a new one — so the session survives a reload.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(session({ expiresAt: new Date(Date.now() - 1000).toISOString() }))
    );
    const service = makeService();
    expect(service.isLoggedIn()).toBe(true);
    expect(service.getRefreshToken()).toBe('refresh-token');
  });

  it('discards a stored session that has no refresh token', () => {
    const { refreshToken, ...noRefresh } = session();
    void refreshToken;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(noRefresh));
    const service = makeService();
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
