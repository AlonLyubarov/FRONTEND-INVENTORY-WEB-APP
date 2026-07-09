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
import { ModalComponent } from '../../shared/modal.component';
import { ItemService } from '../../core/item.service';
import { ProductCatalogService } from '../../core/product-catalog.service';
import { WarehouseService } from '../../core/warehouse.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { ItemDto, ItemUpsertRequest, ProductCatalogDto, WarehouseDto } from '../../core/models';

interface NodeGroup {
  main: WarehouseDto;
  subs: { id: number; name: string }[];
}

/**
 * Create/edit an inventory item (Admin & ShiftManager).
 * The warehouse-node picker sends `targetWarehouseId`: required for Admin
 * (they have no assigned warehouse claim); ShiftManagers get their own tree
 * from GET /warehouse, defaulting to the current page's node.
 */
@Component({
  selector: 'app-item-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ReactiveFormsModule],
  templateUrl: './item-form-modal.component.html'
})
export class ItemFormModalComponent implements OnInit {
  private readonly itemService = inject(ItemService);
  private readonly productService = inject(ProductCatalogService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Item being edited, or null to create. */
  readonly item = input<ItemDto | null>(null);
  /** Node preselected in the warehouse picker (usually the current page). */
  readonly defaultWarehouseId = input<number | null>(null);

  readonly saved = output<ItemDto>();
  readonly closed = output<void>();

  protected readonly products = signal<ProductCatalogDto[] | null>(null);
  protected readonly nodeGroups = signal<NodeGroup[] | null>(null);
  protected readonly productSearch = signal('');
  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly filteredProducts = computed(() => {
    const all = this.products() ?? [];
    const term = this.productSearch().trim().toLowerCase();
    if (!term) {
      return all;
    }
    const selectedId = this.form.controls.productCatalogId.value;
    // Keep the currently selected product visible even when filtered out.
    return all.filter(
      (p) =>
        p.id === selectedId ||
        p.sku.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term)
    );
  });

  protected readonly form = this.fb.group({
    productCatalogId: [null as number | null, Validators.required],
    location: ['', Validators.required],
    quantity: [0, [Validators.required, Validators.min(0)]],
    minimumStockLevel: [0, [Validators.required, Validators.min(0)]],
    targetWarehouseId: [null as number | null, Validators.required]
  });

  ngOnInit(): void {
    const editing = this.item();
    if (editing) {
      this.form.patchValue({
        productCatalogId: editing.productCatalogId,
        location: editing.location,
        quantity: editing.quantity,
        minimumStockLevel: editing.minimumStockLevel,
        targetWarehouseId: editing.warehouseId
      });
    } else if (this.defaultWarehouseId() !== null) {
      this.form.patchValue({ targetWarehouseId: this.defaultWarehouseId() });
    }

    this.productService.getAll().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.products.set([])
    });

    // The shared cache is loaded by the shell and refreshed after every
    // structural mutation, so a fetch is only needed on a cache miss.
    const cached = this.warehouseService.warehouses();
    if (cached) {
      this.nodeGroups.set(cached.map((main) => ({ main, subs: main.subWarehouses })));
    } else {
      this.warehouseService.getAll().subscribe({
        next: (warehouses) =>
          this.nodeGroups.set(warehouses.map((main) => ({ main, subs: main.subWarehouses }))),
        error: () => this.nodeGroups.set([])
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: ItemUpsertRequest = {
      productCatalogId: value.productCatalogId!,
      location: value.location,
      quantity: value.quantity,
      minimumStockLevel: value.minimumStockLevel,
      targetWarehouseId: value.targetWarehouseId!
    };

    this.pending.set(true);
    this.serverError.set(null);

    const editing = this.item();
    const call = editing ? this.itemService.update(editing.id, request) : this.itemService.create(request);

    call.subscribe({
      next: (result) => {
        this.toast.success(editing ? 'Item updated.' : 'Item created.');
        this.saved.emit(result);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }
}
