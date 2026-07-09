import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { WarehouseService } from '../../core/warehouse.service';
import { ItemService } from '../../core/item.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import {
  ItemDto,
  TransactionDto,
  UserDto,
  WarehouseDetailsDto,
  WarehouseDto
} from '../../core/models';
import { roleBadgeClass, roleLabel, statusBadgeClass, transactionBadgeClass } from '../../shared/badges';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ItemFormModalComponent } from '../items/item-form-modal.component';
import { TransactionFormModalComponent } from '../transactions/transaction-form-modal.component';
import {
  WarehouseFormModalComponent,
  WarehouseFormMode
} from './warehouse-form-modal.component';
import { InviteUserModalComponent } from './invite-user-modal.component';

type TabId = 'overview' | 'items' | 'transactions' | 'users';

interface WarehouseFormState {
  mode: WarehouseFormMode;
  parent?: { id: number; name: string };
  warehouse?: { id: number; name: string; location: string };
}

@Component({
  selector: 'app-warehouse-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    ConfirmDialogComponent,
    ItemFormModalComponent,
    TransactionFormModalComponent,
    WarehouseFormModalComponent,
    InviteUserModalComponent
  ],
  templateUrl: './warehouse-page.component.html'
})
export class WarehousePageComponent {
  private readonly warehouseService = inject(WarehouseService);
  private readonly itemService = inject(ItemService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly auth = inject(AuthService);

  /** Bound from the route (:id) and query string (?tab=) via component input binding. */
  readonly id = input.required<string>();
  readonly tab = input<string | undefined>(undefined);

  protected readonly warehouseId = computed(() => Number(this.id()));

  protected readonly warehouse = signal<WarehouseDto | null>(null);
  protected readonly details = signal<WarehouseDetailsDto | null>(null);
  protected readonly items = signal<ItemDto[] | null>(null);
  protected readonly transactions = signal<TransactionDto[] | null>(null);
  protected readonly users = signal<UserDto[] | null>(null);
  protected readonly loadError = signal<string | null>(null);

  protected readonly itemModal = signal<{ item: ItemDto | null } | null>(null);
  protected readonly transactionModalOpen = signal(false);
  protected readonly formModal = signal<WarehouseFormState | null>(null);
  protected readonly inviteOpen = signal(false);
  protected readonly deleteItemTarget = signal<ItemDto | null>(null);
  protected readonly deleteItemPending = signal(false);
  protected readonly deleteItemError = signal<string | null>(null);

  protected readonly deleteWarehouseTarget = signal<{ id: number; name: string } | null>(null);
  protected readonly deleteWarehousePending = signal(false);
  protected readonly deleteWarehouseError = signal<string | null>(null);

  protected readonly removeUserTarget = signal<UserDto | null>(null);
  protected readonly removeUserPending = signal(false);
  protected readonly removeUserError = signal<string | null>(null);

  private usersRequested = false;

  protected readonly isMain = computed(() => this.warehouse()?.parentWarehouseId === null);
  protected readonly canManageItems = computed(() => this.auth.isAdmin() || this.auth.isShiftManager());
  protected readonly showUsersTab = computed(() => this.auth.isAdmin() && this.isMain());

  protected readonly activeTab = computed<TabId>(() => {
    const requested = this.tab();
    if (requested === 'items' || requested === 'transactions') {
      return requested;
    }
    if (requested === 'users' && this.showUsersTab()) {
      return 'users';
    }
    return 'overview';
  });

  protected readonly sortedTransactions = computed(() => {
    const list = this.transactions();
    return list
      ? [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      : null;
  });

  private readonly itemsById = computed(() => {
    const map = new Map<number, ItemDto>();
    for (const item of this.items() ?? []) {
      map.set(item.id, item);
    }
    return map;
  });

  /** id → display name for every node of this page's tree (main + subs). */
  private readonly nodeNames = computed(() => {
    const map = new Map<number, string>();
    const warehouse = this.warehouse();
    if (warehouse) {
      map.set(warehouse.id, warehouse.name);
      for (const sub of warehouse.subWarehouses) {
        map.set(sub.id, sub.name);
      }
    }
    return map;
  });

  constructor() {
    effect(() => {
      const id = this.warehouseId();
      untracked(() => this.loadCore(id));
    });

    // Lazy load for the users tab (admin-only, separate endpoint).
    effect(() => {
      const tab = this.activeTab();
      const id = this.warehouseId();
      untracked(() => {
        if (tab === 'users' && !this.usersRequested) {
          this.usersRequested = true;
          this.loadUsers(id);
        }
      });
    });
  }

  // ── Loading ───────────────────────────────────────────────────────────

  private loadCore(id: number): void {
    this.warehouse.set(null);
    this.details.set(null);
    this.items.set(null);
    this.transactions.set(null);
    this.users.set(null);
    this.loadError.set(null);
    this.usersRequested = false;

    if (!Number.isFinite(id)) {
      this.loadError.set('Invalid warehouse.');
      return;
    }

    // Render the header/tree instantly from the shared cache when this node
    // is a known main warehouse; the network response replaces it when it lands.
    const cached = this.warehouseService.warehouses()?.find((w) => w.id === id);
    if (cached) {
      this.warehouse.set(cached);
    }

    this.warehouseService.getById(id).subscribe({
      next: (warehouse) => this.warehouse.set(warehouse),
      error: (err: unknown) => this.loadError.set(extractErrorMessage(err))
    });
    this.loadDetails(id);
  }

  /**
   * One request feeds the overview summary, the Items tab, and the
   * Transactions tab: /details carries the same hierarchy-scoped items
   * and transactions the dedicated endpoints would return.
   */
  private loadDetails(id: number): void {
    this.warehouseService.getDetails(id).subscribe({
      next: (details) => {
        this.details.set(details);
        this.items.set(details.items);
        this.transactions.set(details.transactions);
      },
      error: () => {
        this.items.set([]);
        this.transactions.set([]);
      }
    });
  }

  private loadUsers(id: number): void {
    this.warehouseService.getUsers(id).subscribe({
      next: (users) => this.users.set(users),
      error: () => this.users.set([])
    });
  }

  /** Re-sync the shared nav/dashboard cache after structural changes. */
  private refreshSharedCache(): void {
    this.warehouseService.getAll().subscribe({ error: () => undefined });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────

  setTab(tab: TabId): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  // ── Display helpers ───────────────────────────────────────────────────

  protected nodeName(id: number): string {
    return this.nodeNames().get(id) ?? `Warehouse #${id}`;
  }

  protected itemLabel(tx: TransactionDto): string {
    const live = this.itemsById().get(tx.itemId);
    const product = live?.productCatalog;
    if (product) {
      return `${product.sku} — ${product.name}`;
    }
    // Not in the live items list ⇒ the item was deleted; the server still
    // resolves its product so the audit trail says what was removed.
    if (tx.productName) {
      return `${tx.productSku ? tx.productSku + ' — ' : ''}${tx.productName} (deleted)`;
    }
    return `Item #${tx.itemId} (deleted)`;
  }

  /**
   * The API stores outbound movements as negative deltas (and some internal
   * audit records as positive ones) — show the magnitude; the type badge
   * carries the direction.
   */
  protected txQuantity(tx: TransactionDto): number {
    return Math.abs(tx.quantity);
  }

  protected statusClass = statusBadgeClass;
  protected txClass = transactionBadgeClass;
  protected roleClass = roleBadgeClass;
  protected roleName = roleLabel;

  // ── Mutations ─────────────────────────────────────────────────────────

  onItemSaved(): void {
    this.itemModal.set(null);
    this.loadDetails(this.warehouseId());
  }

  onTransactionSaved(): void {
    this.transactionModalOpen.set(false);
    this.loadDetails(this.warehouseId());
  }

  askDeleteItem(item: ItemDto): void {
    this.deleteItemError.set(null);
    this.deleteItemTarget.set(item);
  }

  confirmDeleteItem(): void {
    const target = this.deleteItemTarget();
    if (!target || this.deleteItemPending()) {
      return;
    }

    this.deleteItemPending.set(true);
    this.deleteItemError.set(null);

    this.itemService.delete(target.id).subscribe({
      next: () => {
        this.deleteItemPending.set(false);
        this.deleteItemTarget.set(null);
        this.toast.success('Item deleted.');
        this.loadDetails(this.warehouseId());
      },
      error: (err: unknown) => {
        this.deleteItemPending.set(false);
        this.deleteItemError.set(extractErrorMessage(err));
      }
    });
  }

  openEditWarehouse(): void {
    const warehouse = this.warehouse();
    if (warehouse) {
      this.formModal.set({
        mode: 'edit',
        warehouse: { id: warehouse.id, name: warehouse.name, location: warehouse.location }
      });
    }
  }

  openCreateSub(): void {
    const warehouse = this.warehouse();
    if (warehouse) {
      this.formModal.set({
        mode: 'create-sub',
        parent: { id: warehouse.id, name: warehouse.name }
      });
    }
  }

  onWarehouseFormSaved(): void {
    this.formModal.set(null);
    this.loadCore(this.warehouseId());
    this.refreshSharedCache();
  }

  askDeleteWarehouse(target: { id: number; name: string }): void {
    this.deleteWarehouseError.set(null);
    this.deleteWarehouseTarget.set(target);
  }

  confirmDeleteWarehouse(): void {
    const target = this.deleteWarehouseTarget();
    if (!target || this.deleteWarehousePending()) {
      return;
    }

    this.deleteWarehousePending.set(true);
    this.deleteWarehouseError.set(null);

    this.warehouseService.delete(target.id).subscribe({
      next: () => {
        this.deleteWarehousePending.set(false);
        this.deleteWarehouseTarget.set(null);
        this.toast.success(`Warehouse “${target.name}” deleted.`);
        this.refreshSharedCache();
        if (target.id === this.warehouseId()) {
          // The page's own node is gone — go up to its parent, or home.
          const parentId = this.warehouse()?.parentWarehouseId ?? null;
          void this.router.navigate(parentId !== null ? ['/warehouse', parentId] : ['/dashboard']);
        } else {
          // A sub-warehouse was deleted from this page's tree — refresh it.
          this.loadCore(this.warehouseId());
        }
      },
      error: (err: unknown) => {
        this.deleteWarehousePending.set(false);
        this.deleteWarehouseError.set(extractErrorMessage(err));
      }
    });
  }

  onInvited(): void {
    this.inviteOpen.set(false);
    this.usersRequested = true;
    this.loadUsers(this.warehouseId());
    this.loadDetails(this.warehouseId());
    this.refreshSharedCache();
  }

  askRemoveUser(user: UserDto): void {
    this.removeUserError.set(null);
    this.removeUserTarget.set(user);
  }

  confirmRemoveUser(): void {
    const target = this.removeUserTarget();
    if (!target || this.removeUserPending()) {
      return;
    }

    this.removeUserPending.set(true);
    this.removeUserError.set(null);

    this.warehouseService.removeUser(this.warehouseId(), target.id).subscribe({
      next: () => {
        this.removeUserPending.set(false);
        this.removeUserTarget.set(null);
        this.toast.success(`${target.username} was removed from this warehouse.`);
        this.loadUsers(this.warehouseId());
        this.refreshSharedCache();
      },
      error: (err: unknown) => {
        this.removeUserPending.set(false);
        this.removeUserError.set(extractErrorMessage(err));
      }
    });
  }
}
