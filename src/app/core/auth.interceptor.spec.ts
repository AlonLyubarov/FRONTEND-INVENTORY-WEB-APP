import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthResponse } from './models';
import { environment } from '../../environments/environment';

const authUrl = `${environment.apiBaseUrl}/auth`;

function session(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    token: 'jwt-token',
    username: 'alice',
    role: 'Admin',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    userId: 1,
    warehouseId: 2,
    ...overrides
  };
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function setup(loggedIn: boolean): void {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    if (loggedIn) {
      // Establish an in-memory session (login is a public URL → no token attached)
      TestBed.inject(AuthService).login({ username: 'a', password: 'p' }).subscribe();
      httpMock.expectOne(`${authUrl}/login`).flush(session());
    }
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches the Bearer token to API requests when logged in', () => {
    setup(true);
    http.get(`${environment.apiBaseUrl}/warehouse`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouse`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({});
  });

  it('does NOT attach the token to public /auth endpoints', () => {
    setup(true);
    http.post(`${authUrl}/resend-verification`, {}).subscribe();

    const req = httpMock.expectOne(`${authUrl}/resend-verification`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('leaves external (non-API) requests untouched', () => {
    setup(true);
    http.get('https://nominatim.openstreetmap.org/search').subscribe();

    const req = httpMock.expectOne('https://nominatim.openstreetmap.org/search');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('refreshes on 401 (via the cookie) and transparently retries the request', () => {
    setup(true);
    const auth = TestBed.inject(AuthService);
    const results: unknown[] = [];

    http.get(`${environment.apiBaseUrl}/warehouse`).subscribe({ next: (r) => results.push(r), error: () => {} });

    // 1) original request rejected
    httpMock
      .expectOne(`${environment.apiBaseUrl}/warehouse`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    // 2) interceptor calls /auth/refresh with the cookie (empty body)
    const refreshReq = httpMock.expectOne(`${authUrl}/refresh`);
    expect(refreshReq.request.withCredentials).toBe(true);
    expect(refreshReq.request.body).toEqual({});
    refreshReq.flush(session({ token: 'new-jwt' }));

    // 3) original request replayed with the NEW access token
    const retried = httpMock.expectOne(`${environment.apiBaseUrl}/warehouse`);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-jwt');
    retried.flush({ ok: true });

    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.getToken()).toBe('new-jwt');
    expect(results).toEqual([{ ok: true }]);
  });

  it('logs out and redirects to /login when the refresh itself fails', () => {
    setup(true);
    const router = TestBed.inject(Router);
    const auth = TestBed.inject(AuthService);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(`${environment.apiBaseUrl}/warehouse`).subscribe({ next: () => {}, error: () => {} });
    httpMock
      .expectOne(`${environment.apiBaseUrl}/warehouse`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    // refresh attempt fails → session is dead
    httpMock.expectOne(`${authUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

    // logout fires a best-effort revoke; flush it so the mock is satisfied
    httpMock.expectOne(`${authUrl}/logout`).flush({});

    expect(auth.isLoggedIn()).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(['/login']);
  });

  it('does NOT log out on a 403 (access denied, not a bad session)', () => {
    setup(true);
    const auth = TestBed.inject(AuthService);

    http.get(`${environment.apiBaseUrl}/warehouse/1`).subscribe({ next: () => {}, error: () => {} });
    httpMock
      .expectOne(`${environment.apiBaseUrl}/warehouse/1`)
      .flush({}, { status: 403, statusText: 'Forbidden' });

    expect(auth.isLoggedIn()).toBe(true);
  });
});
