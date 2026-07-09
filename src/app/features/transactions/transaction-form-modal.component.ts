import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../shared/modal.component';
import { TransactionService } from '../../core/transaction.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { ItemDto, TRANSACTION_TYPES, TransactionDto, TransactionType } from '../../core/models';

/**
 * Record a stock movement. Any authenticated user with access to the item's
 * warehouse tree can create transactions; the server validates stock levels
 * and its 400 message (e.g. insufficient stock) is shown verbatim.
 */
@Component({
  selector: 'app-transaction-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ReactiveFormsModule],
  templateUrl: './transaction-form-modal.component.html'
})
export class TransactionFormModalComponent {
  private readonly transactionService = inject(TransactionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Items the current user can transact against (from the page context). */
  readonly items = input.required<ItemDto[]>();

  readonly saved = output<TransactionDto>();
  readonly closed = output<void>();

  protected readonly transactionTypes = TRANSACTION_TYPES;
  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    itemId: [null as number | null, Validators.required],
    type: ['StockIn' as TransactionType, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    notes: ['']
  });

  protected itemLabel(item: ItemDto): string {
    const product = item.productCatalog;
    const name = product ? `${product.sku} — ${product.name}` : `Item #${item.id}`;
    return `${name} (${item.quantity} in stock)`;
  }

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.pending.set(true);
    this.serverError.set(null);

    this.transactionService
      .create({
        itemId: value.itemId!,
        type: value.type,
        quantity: value.quantity,
        notes: value.notes.trim() || undefined
      })
      .subscribe({
        next: (transaction) => {
          this.toast.success(`${value.type} of ${value.quantity} recorded.`);
          this.saved.emit(transaction);
        },
        error: (err: unknown) => {
          this.pending.set(false);
          this.serverError.set(extractErrorMessage(err));
        }
      });
  }
}
