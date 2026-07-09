import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../shared/modal.component';
import { WarehouseService } from '../../core/warehouse.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { InviteRole, UserDto } from '../../core/models';
import { roleLabel } from '../../shared/badges';

/**
 * Admin-only: invite an Employee or ShiftManager into a MAIN warehouse.
 * The Admin role is intentionally absent from the dropdown — owners are
 * only ever created through registration.
 */
@Component({
  selector: 'app-invite-user-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ReactiveFormsModule],
  templateUrl: './invite-user-modal.component.html'
})
export class InviteUserModalComponent {
  private readonly warehouseService = inject(WarehouseService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly warehouse = input.required<{ id: number; name: string }>();

  readonly invited = output<UserDto>();
  readonly closed = output<void>();

  protected readonly inviteRoles: InviteRole[] = ['Employee', 'ShiftManager'];
  protected readonly roleName = roleLabel;
  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['Employee' as InviteRole, Validators.required]
  });

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.serverError.set(null);

    const request = this.form.getRawValue();
    this.warehouseService.inviteUser(this.warehouse().id, request).subscribe({
      next: (user) => {
        this.toast.success(`${user.username} was invited to “${this.warehouse().name}”.`);
        this.invited.emit(user);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }
}
