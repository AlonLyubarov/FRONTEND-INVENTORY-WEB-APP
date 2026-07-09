import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { WarehouseService } from '../../core/warehouse.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { WarehouseDto } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import {
  WarehouseFormModalComponent,
  WarehouseFormMode
} from '../warehouse/warehouse-form-modal.component';
import { InviteUserModalComponent } from '../warehouse/invite-user-modal.component';

interface WarehouseFormState {
  mode: WarehouseFormMode;
  parent?: { id: number; name: string };
  warehouse?: { id: number; name: string; location: string };
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    ConfirmDialogComponent,
    WarehouseFormModalComponent,
    InviteUserModalComponent
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly warehouseService = inject(WarehouseService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly auth = inject(AuthService);
  protected readonly warehouses = this.warehouseService.warehouses;
  protected readonly loading = signal(true);

  protected readonly formModal = signal<WarehouseFormState | null>(null);
  protected readonly inviteTarget = signal<{ id: number; name: string } | null>(null);
  protected readonly deleteTarget = signal<WarehouseDto | null>(null);
  protected readonly deletePending = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.warehouseService.getAll().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false)
    });
  }

  openCreateMain(): void {
    this.formModal.set({ mode: 'create-main' });
  }

  openCreateSub(warehouse: WarehouseDto): void {
    this.formModal.set({ mode: 'create-sub', parent: { id: warehouse.id, name: warehouse.name } });
  }

  openEdit(warehouse: WarehouseDto): void {
    this.formModal.set({
      mode: 'edit',
      warehouse: { id: warehouse.id, name: warehouse.name, location: warehouse.location }
    });
  }

  onFormSaved(): void {
    this.formModal.set(null);
    this.reload();
  }

  onInvited(): void {
    this.inviteTarget.set(null);
    this.reload();
  }

  askDelete(warehouse: WarehouseDto): void {
    this.deleteError.set(null);
    this.deleteTarget.set(warehouse);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deletePending()) {
      return;
    }

    this.deletePending.set(true);
    this.deleteError.set(null);

    this.warehouseService.delete(target.id).subscribe({
      next: () => {
        this.deletePending.set(false);
        this.deleteTarget.set(null);
        this.toast.success(`Warehouse “${target.name}” deleted.`);
        this.reload();
      },
      error: (err: unknown) => {
        this.deletePending.set(false);
        this.deleteError.set(extractErrorMessage(err));
      }
    });
  }

  openSubWarehouse(subId: number): void {
    void this.router.navigate(['/warehouse', subId]);
  }
}
