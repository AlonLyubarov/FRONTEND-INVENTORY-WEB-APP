import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ModalComponent } from '../../shared/modal.component';
import { WarehouseService } from '../../core/warehouse.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { WarehouseDto } from '../../core/models';

export type WarehouseFormMode = 'create-main' | 'create-sub' | 'edit';

/**
 * One modal for the three warehouse mutations: new MAIN warehouse (Admin),
 * new sub-warehouse under a main (Admin owner), and edit name/location.
 */
@Component({
  selector: 'app-warehouse-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ReactiveFormsModule],
  templateUrl: './warehouse-form-modal.component.html'
})
export class WarehouseFormModalComponent implements OnInit {
  private readonly warehouseService = inject(WarehouseService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly mode = input.required<WarehouseFormMode>();
  /** Parent main warehouse — required when mode is 'create-sub'. */
  readonly parent = input<{ id: number; name: string } | null>(null);
  /** Warehouse being edited — required when mode is 'edit'. */
  readonly warehouse = input<{ id: number; name: string; location: string } | null>(null);

  readonly saved = output<WarehouseDto>();
  readonly closed = output<void>();

  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly title = computed(() => {
    switch (this.mode()) {
      case 'create-main':
        return 'New main warehouse';
      case 'create-sub':
        return `New sub-warehouse in “${this.parent()?.name}”`;
      case 'edit':
        return `Edit “${this.warehouse()?.name}”`;
    }
  });

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    location: ['', [Validators.required, Validators.maxLength(200)]]
  });

  ngOnInit(): void {
    const existing = this.warehouse();
    if (this.mode() === 'edit' && existing) {
      this.form.patchValue({ name: existing.name, location: existing.location });
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    const request = this.form.getRawValue();
    let call: Observable<WarehouseDto>;
    let successMessage: string;

    switch (this.mode()) {
      case 'create-main':
        call = this.warehouseService.createMain(request);
        successMessage = `Warehouse “${request.name}” created.`;
        break;
      case 'create-sub':
        call = this.warehouseService.createSub(this.parent()!.id, request);
        successMessage = `Sub-warehouse “${request.name}” created.`;
        break;
      case 'edit':
        call = this.warehouseService.update(this.warehouse()!.id, request);
        successMessage = `Warehouse “${request.name}” updated.`;
        break;
    }

    this.pending.set(true);
    this.serverError.set(null);

    call.subscribe({
      next: (result) => {
        this.toast.success(successMessage);
        this.saved.emit(result);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }
}
