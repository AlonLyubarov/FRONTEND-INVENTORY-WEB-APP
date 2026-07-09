import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ItemDto, ItemUpsertRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/item`;

  getAll(): Observable<ItemDto[]> {
    return this.http.get<ItemDto[]>(this.baseUrl);
  }

  getById(id: number): Observable<ItemDto> {
    return this.http.get<ItemDto>(`${this.baseUrl}/${id}`);
  }

  getByProduct(productCatalogId: number): Observable<ItemDto[]> {
    return this.http.get<ItemDto[]>(`${this.baseUrl}/product/${productCatalogId}`);
  }

  getByLocation(location: string): Observable<ItemDto[]> {
    return this.http.get<ItemDto[]>(`${this.baseUrl}/location/${encodeURIComponent(location)}`);
  }

  create(request: ItemUpsertRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(this.baseUrl, request);
  }

  update(id: number, request: ItemUpsertRequest): Observable<ItemDto> {
    return this.http.put<ItemDto>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
