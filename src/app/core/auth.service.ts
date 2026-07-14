import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserDto } from './models';

/**
 * SECURITY: nothing security-related is stored in localStorage.
 *  - The refresh token lives ONLY in an HttpOnly cookie (JS cannot read it, so
 *    it is immune to XSS). The browser attaches it automatically to /api/auth.
 *  - The short-lived access token + user info live ONLY in memory (this signal).
 *    On a full page reload memory is lost, so the app calls restoreSession() at
 *    startup: /auth/refresh uses the cookie to mint a new access token silently.
 * `withCredentials` is required so the cross-origin dev setup (4200 → 5291)
 * sends/receives the cookie; behind the reverse proxy in prod it is same-origin.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly currentUserSignal = signal<AuthResponse | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUserSignal() !== null);
  readonly role = computed(() => this.currentUserSignal()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isShiftManager = computed(() => this.role() === 'ShiftManager');
  readonly isEmployee = computed(() => this.role() === 'Employee');
  readonly warehouseId = computed(() => this.currentUserSignal()?.warehouseId ?? null);

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, request, { withCredentials: true })
      .pipe(tap((response) => this.currentUserSignal.set(response)));
  }

  /**
   * Mints a new access token using the HttpOnly refresh cookie (sent
   * automatically). Called by the interceptor on a 401 and by restoreSession().
   * No body — the cookie carries the credential.
   */
  refresh(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/refresh`, {}, { withCredentials: true })
      .pipe(tap((response) => this.currentUserSignal.set(response)));
  }

  /**
   * One-shot startup restore: try to rebuild the in-memory session from the
   * refresh cookie. Never rejects — an anonymous visitor simply stays logged
   * out, so app bootstrap is not blocked.
   */
  restoreSession(): Promise<void> {
    return firstValueFrom(this.refresh()).then(
      () => undefined,
      () => undefined
    );
  }

  register(request: RegisterRequest): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.baseUrl}/register`, request);
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/verify-email`, { token });
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/resend-verification`, { email });
  }

  /**
   * Permanently deletes the current account (password re-confirmation).
   * Lives under /api/account (not /auth) so the JWT is attached.
   */
  deleteAccount(password: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/account/delete`, { password });
  }

  logout(): void {
    // Best-effort: revoke the refresh token and clear its cookie server-side.
    // Fire-and-forget; the in-memory session is dropped regardless of the result.
    // Only call the server when there is actually a session to end.
    if (this.currentUserSignal() !== null) {
      this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true }).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.currentUserSignal.set(null);
  }

  getToken(): string | null {
    return this.currentUserSignal()?.token ?? null;
  }
}
