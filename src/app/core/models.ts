// ── Enums (serialized as strings by the API) ────────────────────────────────

export type Role = 'Admin' | 'ShiftManager' | 'Employee';

export type InviteRole = 'Employee' | 'ShiftManager';

export type ItemStatus = 'In Stock' | 'Low' | 'Out of Stock';

export type TransactionType = 'StockIn' | 'StockOut' | 'Adjustment' | 'Sale' | 'Return';

export const TRANSACTION_TYPES: TransactionType[] = ['StockIn', 'StockOut', 'Adjustment', 'Sale', 'Return'];

// ── Response DTOs ───────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  username: string;
  role: Role;
  expiresAt: string;
  userId: number;
  warehouseId: number | null;
}

export interface UserDto {
  id: number;
  username: string;
  email: string;
  role: Role;
  warehouseId: number | null;
  warehouseName: string | null;
}

export interface WarehouseDto {
  id: number;
  name: string;
  location: string;
  createdAt: string;
  updatedAt: string | null;
  userCount: number;
  parentWarehouseId: number | null;
  subWarehouses: SubWarehouseDto[];
}

export interface SubWarehouseDto {
  id: number;
  name: string;
  location: string;
}

export interface WarehouseDetailsDto {
  id: number;
  name: string;
  location: string;
  createdAt: string;
  updatedAt: string | null;
  userCount: number;
  items: ItemDto[];
  transactions: TransactionDto[];
  inventorySummary: InventorySummaryDto;
}

export interface InventorySummaryDto {
  totalItems: number;
  totalQuantity: number;
  lowStockItems: number;
  outOfStockItems: number;
  transactionCount: number;
}

export interface ItemDto {
  id: number;
  warehouseId: number;
  productCatalogId: number;
  location: string;
  quantity: number;
  minimumStockLevel: number;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string | null;
  productCatalog: ProductCatalogDto | null;
}

export interface ProductCatalogDto {
  id: number;
  sku: string;
  name: string;
  price: number;
  barcode: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TransactionDto {
  id: number;
  itemId: number;
  type: TransactionType;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

export interface PublicWarehouseDto {
  id: number;
  name: string;
}

// ── Request payloads ────────────────────────────────────────────────────────

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  warehouseName: string;
  warehouseLocation: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface WarehouseUpsertRequest {
  name: string;
  location: string;
}

export interface InviteUserRequest {
  username: string;
  email: string;
  password: string;
  role: InviteRole;
}

export interface ItemUpsertRequest {
  productCatalogId: number;
  location: string;
  quantity: number;
  minimumStockLevel: number;
  targetWarehouseId?: number;
}

export interface TransactionCreateRequest {
  itemId: number;
  type: TransactionType;
  quantity: number;
  notes?: string;
}

export interface ProductCatalogUpsertRequest {
  sku: string;
  name: string;
  price: number;
  barcode?: string;
}
