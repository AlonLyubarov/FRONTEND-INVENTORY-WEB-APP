import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductCatalogDto, ProductCatalogUpsertRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/productcatalog`;

  getAll(): Observable<ProductCatalogDto[]> {
    return this.http.get<ProductCatalogDto[]>(this.baseUrl);
  }

  getById(id: number): Observable<ProductCatalogDto> {
    return this.http.get<ProductCatalogDto>(`${this.baseUrl}/${id}`);
  }

  getBySku(sku: string): Observable<ProductCatalogDto> {
    return this.http.get<ProductCatalogDto>(`${this.baseUrl}/sku/${encodeURIComponent(sku)}`);
  }

  create(request: ProductCatalogUpsertRequest): Observable<ProductCatalogDto> {
    return this.http.post<ProductCatalogDto>(this.baseUrl, request);
  }

  update(id: number, request: ProductCatalogUpsertRequest): Observable<ProductCatalogDto> {
    return this.http.put<ProductCatalogDto>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
