import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { AuthResponse } from './models';
import { environment } from '../../environments/environment';

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

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const authUrl = `${environment.apiBaseUrl}/auth`;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function logInAs(overrides: Partial<AuthResponse> = {}): void {
    service.login({ username: 'alice', password: 'secret' }).subscribe();
    httpMock.expectOne(`${authUrl}/login`).flush(session(overrides));
  }

  it('starts logged out', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.role()).toBeNull();
  });

  it('stores the session in memory on login — and nothing in localStorage', () => {
    service.login({ username: 'alice', password: 'secret' }).subscribe();
    const req = httpMock.expectOne(`${authUrl}/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true); // needed to receive the HttpOnly cookie
    req.flush(session());

    expect(service.isLoggedIn()).toBe(true);
    expect(service.getToken()).toBe('jwt-token');
    expect(service.isAdmin()).toBe(true);
    expect(service.warehouseId()).toBe(2);
    // SECURITY: no token is persisted to localStorage
    expect(localStorage.length).toBe(0);
  });

  it('classifies roles through computed signals', () => {
    logInAs({ role: 'Employee' });
    expect(service.isAdmin()).toBe(false);
    expect(service.isEmployee()).toBe(true);
    expect(service.isShiftManager()).toBe(false);
  });

  it('refreshes via the cookie (empty body) and updates the in-memory token', () => {
    logInAs();
    service.refresh().subscribe();

    const req = httpMock.expectOne(`${authUrl}/refresh`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({}); // the credential is the cookie, not the body
    req.flush(session({ token: 'new-jwt' }));

    expect(service.getToken()).toBe('new-jwt');
  });

  it('clears memory and revokes server-side on logout', () => {
    logInAs();
    service.logout();

    const req = httpMock.expectOne(`${authUrl}/logout`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({});

    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it('does not call the server on logout when there is no session', () => {
    service.logout();
    httpMock.expectNone(`${authUrl}/logout`);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('restoreSession rebuilds the session when the refresh cookie is valid', async () => {
    const done = service.restoreSession();
    httpMock.expectOne(`${authUrl}/refresh`).flush(session());
    await done;
    expect(service.isLoggedIn()).toBe(true);
    expect(service.getToken()).toBe('jwt-token');
  });

  it('restoreSession stays logged out (and does not throw) with no valid cookie', async () => {
    const done = service.restoreSession();
    httpMock
      .expectOne(`${authUrl}/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await done; // must resolve, never reject
    expect(service.isLoggedIn()).toBe(false);
  });
});
