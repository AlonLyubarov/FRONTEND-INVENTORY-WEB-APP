import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../shared/modal.component';
import { ProductCatalogService } from '../../core/product-catalog.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { ProductCatalogDto, ProductCatalogUpsertRequest } from '../../core/models';

@Component({
  selector: 'app-product-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ReactiveFormsModule],
  templateUrl: './product-form-modal.component.html'
})
export class ProductFormModalComponent implements OnInit {
  private readonly productService = inject(ProductCatalogService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Product being edited, or null to create. */
  readonly product = input<ProductCatalogDto | null>(null);

  readonly saved = output<ProductCatalogDto>();
  readonly closed = output<void>();

  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    sku: ['', Validators.required],
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    barcode: ['']
  });

  ngOnInit(): void {
    const editing = this.product();
    if (editing) {
      this.form.patchValue({
        sku: editing.sku,
        name: editing.name,
        price: editing.price,
        barcode: editing.barcode ?? ''
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: ProductCatalogUpsertRequest = {
      sku: value.sku,
      name: value.name,
      price: value.price,
      barcode: value.barcode.trim() || undefined
    };

    this.pending.set(true);
    this.serverError.set(null);

    const editing = this.product();
    const call = editing
      ? this.productService.update(editing.id, request)
      : this.productService.create(request);

    call.subscribe({
      next: (result) => {
        this.toast.success(editing ? `Product “${result.name}” updated.` : `Product “${result.name}” created.`);
        this.saved.emit(result);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }
}
