import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ProductCatalogService } from '../../core/product-catalog.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { ProductCatalogDto } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ProductFormModalComponent } from './product-form-modal.component';

/** Product catalog: CRUD for Admin/ShiftManager, read-only for Employee. */
@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, ConfirmDialogComponent, ProductFormModalComponent],
  templateUrl: './products.component.html'
})
export class ProductsComponent {
  private readonly productService = inject(ProductCatalogService);
  private readonly toast = inject(ToastService);

  private readonly auth = inject(AuthService);
  protected readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isShiftManager());

  protected readonly products = signal<ProductCatalogDto[] | null>(null);
  protected readonly search = signal('');

  protected readonly filteredProducts = computed(() => {
    const all = this.products();
    if (!all) {
      return null;
    }
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return all;
    }
    return all.filter(
      (p) =>
        p.sku.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term) ||
        (p.barcode ?? '').toLowerCase().includes(term)
    );
  });

  protected readonly formModal = signal<{ product: ProductCatalogDto | null } | null>(null);
  protected readonly deleteTarget = signal<ProductCatalogDto | null>(null);
  protected readonly deletePending = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.productService.getAll().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.products.set([])
    });
  }

  onSaved(): void {
    this.formModal.set(null);
    this.reload();
  }

  askDelete(product: ProductCatalogDto): void {
    this.deleteError.set(null);
    this.deleteTarget.set(product);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deletePending()) {
      return;
    }

    this.deletePending.set(true);
    this.deleteError.set(null);

    this.productService.delete(target.id).subscribe({
      next: () => {
        this.deletePending.set(false);
        this.deleteTarget.set(null);
        this.toast.success(`Product “${target.name}” deleted.`);
        this.reload();
      },
      error: (err: unknown) => {
        this.deletePending.set(false);
        this.deleteError.set(extractErrorMessage(err));
      }
    });
  }
}
