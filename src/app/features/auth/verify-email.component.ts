import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
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
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Bound from the ?token= query parameter. */
  readonly token = input<string | undefined>(undefined);

  protected readonly state = signal<VerifyState>('verifying');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly resendPending = signal(false);
  protected readonly resendMessage = signal<string | null>(null);

  protected readonly resendForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  ngOnInit(): void {
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
    if (this.resendForm.invalid || this.resendPending()) {
      this.resendForm.markAllAsTouched();
      return;
    }

    this.resendPending.set(true);
    this.resendMessage.set(null);

    this.auth.resendVerification(this.resendForm.getRawValue().email).subscribe({
      next: (response) => {
        this.resendPending.set(false);
        this.resendMessage.set(response.message);
      },
      error: () => {
        this.resendPending.set(false);
        this.resendMessage.set('Something went wrong — try again shortly.');
      }
    });
  }
}
