import { Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { WarehouseService } from './core/warehouse.service';
import { ToastContainerComponent } from './shared/toast-container.component';
import { roleBadgeClass, roleLabel } from './shared/badges';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent],
  templateUrl: './app.html'
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly router = inject(Router);

  protected readonly isLoggedIn = this.auth.isLoggedIn;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly currentUser = this.auth.currentUser;
  protected readonly warehouses = this.warehouseService.warehouses;

  protected readonly roleBadge = computed(() => {
    const user = this.currentUser();
    return user ? roleBadgeClass(user.role) : '';
  });

  protected readonly roleName = computed(() => {
    const user = this.currentUser();
    return user ? roleLabel(user.role) : '';
  });

  /** Employee/ShiftManager: their assigned warehouse for the contextual nav link. */
  protected readonly myWarehouse = computed(() => {
    const user = this.currentUser();
    if (!user || user.role === 'Admin' || user.warehouseId === null) {
      return null;
    }
    const loaded = this.warehouses()?.find((w) => w.id === user.warehouseId);
    return { id: user.warehouseId, name: loaded?.name ?? 'My warehouse' };
  });

  constructor() {
    // Keep the side-nav warehouse list in sync with the session.
    effect(() => {
      if (this.isLoggedIn()) {
        untracked(() => this.warehouseService.getAll().subscribe({ error: () => undefined }));
      } else {
        untracked(() => this.warehouseService.clearCache());
      }
    });
  }

  onLogout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
