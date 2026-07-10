import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { extractErrorMessage } from '../../core/error-message.util';

type VerifyState = 'verifying' | 'success' | 'error' | 'resend';

/**
 * Landing page for the verification link sent by email
 * (/verify-email?token=…). Without a token it offers a resend form.
 */
@Component({
  selector: 'app-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Bound from the ?token= query parameter. */
  readonly token = input<string | undefined>(undefined);
  /** Optional ?email= prefill for the resend form (e.g. from the login screen). */
  readonly email = input<string | undefined>(undefined);

  protected readonly state = signal<VerifyState>('verifying');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly resendPending = signal(false);
  protected readonly resendMessage = signal<string | null>(null);
  /** Seconds until resend is allowed again — mirrors the server-side cooldown. */
  protected readonly cooldown = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly resendForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  ngOnInit(): void {
    const prefill = this.email();
    if (prefill) {
      this.resendForm.patchValue({ email: prefill });
    }

    const token = this.token();
    if (!token) {
      this.state.set('resend');
      return;
    }

    this.auth.verifyEmail(token).subscribe({
      next: () => this.state.set('success'),
      error: (err: unknown) => {
        this.errorMessage.set(extractErrorMessage(err));
        this.state.set('error');
      }
    });
  }

  showResend(): void {
    this.state.set('resend');
  }

  onResend(): void {
    if (this.resendForm.invalid || this.resendPending() || this.cooldown() > 0) {
      this.resendForm.markAllAsTouched();
      return;
    }

    this.resendPending.set(true);
    this.resendMessage.set(null);

    this.auth.resendVerification(this.resendForm.getRawValue().email).subscribe({
      next: (response) => {
        this.resendPending.set(false);
        this.resendMessage.set(response.message);
        this.startCooldown();
      },
      error: () => {
        this.resendPending.set(false);
        this.resendMessage.set('Something went wrong — try again shortly.');
      }
    });
  }

  ngOnDestroy(): void {
    this.clearCooldownTimer();
  }

  /** 60-second lockout matching the server's per-account resend cooldown. */
  private startCooldown(): void {
    this.clearCooldownTimer();
    this.cooldown.set(60);
    this.cooldownTimer = setInterval(() => {
      this.cooldown.update((seconds) => {
        if (seconds <= 1) {
          this.clearCooldownTimer();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer !== null) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }
}
