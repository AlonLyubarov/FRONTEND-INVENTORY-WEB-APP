import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  // Mirrors the server-side validation rules.
  protected readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    warehouseName: ['', [Validators.required, Validators.maxLength(100)]],
    warehouseLocation: ['', [Validators.required, Validators.maxLength(200)]]
  });

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.serverError.set(null);

    const request = this.form.getRawValue();
    this.auth.register(request).subscribe({
      next: (user) => {
        this.toast.success(`Your warehouse “${request.warehouseName}” was created.`);
        void this.router.navigate(['/login'], {
          state: { registeredUsername: user.username, warehouseName: request.warehouseName }
        });
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }
}
