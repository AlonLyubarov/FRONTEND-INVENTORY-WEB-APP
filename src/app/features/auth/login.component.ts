import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { AuthResponse } from '../../core/models';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** Set when arriving from a successful registration. */
  protected readonly registrationNotice = signal<string | null>(null);

  protected readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  constructor() {
    if (this.auth.isLoggedIn() && !this.auth.isSessionExpired()) {
      this.navigateForUser(this.auth.currentUser()!);
      return;
    }

    const state = history.state as {
      registeredUsername?: string;
      warehouseName?: string;
      verifyEmail?: boolean;
    } | null;
    if (state?.registeredUsername) {
      this.form.patchValue({ username: state.registeredUsername });
      if (state.verifyEmail) {
        this.registrationNotice.set(
          `Your warehouse “${state.warehouseName}” was created. We emailed you a verification link — confirm it before signing in.`
        );
      } else {
        this.registrationNotice.set(
          state.warehouseName
            ? `Your warehouse “${state.warehouseName}” was created. Sign in to start managing it.`
            : 'Your account was created. Sign in to continue.'
        );
      }
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.serverError.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => this.navigateForUser(response),
      error: (err: unknown) => {
        this.pending.set(false);
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }

  private navigateForUser(user: AuthResponse): void {
    if (user.role !== 'Admin' && user.warehouseId !== null) {
      void this.router.navigate(['/warehouse', user.warehouseId]);
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }
}
