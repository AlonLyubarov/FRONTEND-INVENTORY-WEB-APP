import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalComponent } from '../../shared/modal.component';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';

/**
 * Self-service account deletion: password re-confirmation, role-aware
 * warning (owners take their whole warehouse tree with them), then logout.
 */
@Component({
  selector: 'app-delete-account-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal title="Delete my account" (closed)="closed.emit()">
      <p class="confirm-message">
        This permanently deletes your account<strong>. There is no undo.</strong>
      </p>

      @if (auth.isAdmin()) {
        <p class="confirm-warning">
          ⚠️ You are a warehouse owner — deleting your account also permanently deletes
          <strong>all your warehouses and sub-warehouses, every item and transaction in them,
          your product catalog, and the accounts of every team member you invited.</strong>
        </p>
      } @else {
        <p class="confirm-warning">
          ⚠️ Your account and personal data (including your reminders) will be permanently removed.
        </p>
      }

      @if (serverError(); as error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <label class="field">
          <span class="field__label">Confirm your password</span>
          <input type="password" formControlName="password" autocomplete="current-password" />
          @if (form.controls.password.touched && form.controls.password.hasError('required')) {
            <div class="field__error">Password is required.</div>
          }
        </label>

        <div class="modal-actions">
          <button type="button" class="btn btn--ghost" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn btn--danger" [disabled]="pending()">
            {{ pending() ? 'Deleting…' : 'Delete my account forever' }}
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class DeleteAccountModalComponent {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly closed = output<void>();

  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    password: ['', Validators.required]
  });

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.serverError.set(null);

    this.auth.deleteAccount(this.form.getRawValue().password).subscribe({
      next: () => {
        this.toast.success('Your account was deleted. Goodbye 👋');
        this.auth.logout();
        void this.router.navigate(['/register']);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }
}
