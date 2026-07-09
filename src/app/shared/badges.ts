import { ItemStatus, Role, TransactionType } from '../core/models';

export function roleBadgeClass(role: Role): string {
  switch (role) {
    case 'Admin':
      return 'badge badge--admin';
    case 'ShiftManager':
      return 'badge badge--shift-manager';
    case 'Employee':
      return 'badge badge--employee';
  }
}

export function roleLabel(role: Role): string {
  return role === 'ShiftManager' ? 'Shift Manager' : role === 'Admin' ? 'Admin (Owner)' : role;
}

export function statusBadgeClass(status: ItemStatus): string {
  switch (status) {
    case 'In Stock':
      return 'badge badge--success';
    case 'Low':
      return 'badge badge--warning';
    case 'Out of Stock':
      return 'badge badge--danger';
  }
}

export function transactionBadgeClass(type: TransactionType): string {
  switch (type) {
    case 'StockIn':
    case 'Return':
      return 'badge badge--success';
    case 'StockOut':
    case 'Sale':
      return 'badge badge--danger';
    case 'Adjustment':
      return 'badge badge--neutral';
  }
}
