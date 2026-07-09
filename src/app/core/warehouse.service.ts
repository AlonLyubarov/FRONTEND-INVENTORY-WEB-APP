import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  InviteUserRequest,
  ItemDto,
  PublicWarehouseDto,
  TransactionDto,
  UserDto,
  WarehouseDetailsDto,
  WarehouseDto,
  WarehouseUpsertRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/warehouse`;

  /**
   * Shared cache of the warehouses visible to the current user
   * (Admin: owned mains with subs; Employee/SM: their single assigned main).
   * Null until the first load completes. Used by the nav, dashboard and node pickers.
   */
  private readonly warehousesSignal = signal<WarehouseDto[] | null>(null);
  readonly warehouses = this.warehousesSignal.asReadonly();

  private inflightGetAll: Observable<WarehouseDto[]> | null = null;

  /** Concurrent callers (shell nav + dashboard on login) share one request. */
  getAll(): Observable<WarehouseDto[]> {
    this.inflightGetAll ??= this.http.get<WarehouseDto[]>(this.baseUrl).pipe(
      tap((warehouses) => this.warehousesSignal.set(warehouses)),
      finalize(() => (this.inflightGetAll = null)),
      shareReplay(1)
    );
    return this.inflightGetAll;
  }

  clearCache(): void {
    this.warehousesSignal.set(null);
  }

  getPublicList(): Observable<PublicWarehouseDto[]> {
    return this.http.get<PublicWarehouseDto[]>(`${this.baseUrl}/public-list`);
  }

  getById(id: number): Observable<WarehouseDto> {
    return this.http.get<WarehouseDto>(`${this.baseUrl}/${id}`);
  }

  getSubWarehouses(id: number): Observable<WarehouseDto[]> {
    return this.http.get<WarehouseDto[]>(`${this.baseUrl}/${id}/sub`);
  }

  getDetails(id: number): Observable<WarehouseDetailsDto> {
    return this.http.get<WarehouseDetailsDto>(`${this.baseUrl}/${id}/details`);
  }

  /** Includes items located in sub-warehouses of the given node. */
  getItems(id: number): Observable<ItemDto[]> {
    return this.http.get<ItemDto[]>(`${this.baseUrl}/${id}/items`);
  }

  getTransactions(id: number): Observable<TransactionDto[]> {
    return this.http.get<TransactionDto[]>(`${this.baseUrl}/${id}/transactions`);
  }

  createMain(request: WarehouseUpsertRequest): Observable<WarehouseDto> {
    return this.http.post<WarehouseDto>(this.baseUrl, request);
  }

  createSub(parentId: number, request: WarehouseUpsertRequest): Observable<WarehouseDto> {
    return this.http.post<WarehouseDto>(`${this.baseUrl}/${parentId}/sub`, request);
  }

  update(id: number, request: WarehouseUpsertRequest): Observable<WarehouseDto> {
    return this.http.put<WarehouseDto>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  inviteUser(warehouseId: number, request: InviteUserRequest): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.baseUrl}/${warehouseId}/invite`, request);
  }

  getUsers(warehouseId: number): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.baseUrl}/${warehouseId}/users`);
  }

  /** Removes an invited Employee/ShiftManager from the warehouse (deletes the account). */
  removeUser(warehouseId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${warehouseId}/users/${userId}`);
  }
}
