import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserDto } from './models';

const STORAGE_KEY = 'inventory.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly currentUserSignal = signal<AuthResponse | null>(readStoredSession());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUserSignal() !== null);
  readonly role = computed(() => this.currentUserSignal()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isShiftManager = computed(() => this.role() === 'ShiftManager');
  readonly isEmployee = computed(() => this.role() === 'Employee');
  readonly warehouseId = computed(() => this.currentUserSignal()?.warehouseId ?? null);

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, request).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  /**
   * Exchanges the stored refresh token for a fresh access token (and a rotated
   * refresh token). Called by the interceptor when the access token has expired.
   */
  refresh(): Observable<AuthResponse> {
    const refreshToken = this.currentUserSignal()?.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, { refreshToken }).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  /** Saves the session to memory (signal) and localStorage. */
  private persistSession(response: AuthResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
    this.currentUserSignal.set(response);
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
    // Best-effort server-side revocation so the refresh token can't be reused.
    // Fire-and-forget: the local session is cleared regardless of the result.
    const refreshToken = this.currentUserSignal()?.refreshToken;
    if (refreshToken) {
      this.http.post(`${this.baseUrl}/logout`, { refreshToken }).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    localStorage.removeItem(STORAGE_KEY);
    this.currentUserSignal.set(null);
  }

  getToken(): string | null {
    return this.currentUserSignal()?.token ?? null;
  }

  getRefreshToken(): string | null {
    return this.currentUserSignal()?.refreshToken ?? null;
  }

  /** The token's expiresAt is checked before every request; expired ⇒ treated as 401. */
  isSessionExpired(): boolean {
    const user = this.currentUserSignal();
    return !user || isExpired(user.expiresAt);
  }
}

/** Single source of truth for expiry: malformed timestamps count as expired. */
function isExpired(expiresAt: string): boolean {
  const expiration = Date.parse(expiresAt);
  return !Number.isFinite(expiration) || expiration <= Date.now();
}

function readStoredSession(): AuthResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthResponse;
    // Keep the session as long as it can be refreshed: the access token may have
    // expired (e.g. the tab was closed for an hour), but a valid refresh token
    // lets the interceptor mint a new one on the first API call. A session with
    // no refresh token is unusable and discarded.
    if (!parsed.token || !parsed.refreshToken) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
