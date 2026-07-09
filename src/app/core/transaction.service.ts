import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TransactionCreateRequest, TransactionDto, TransactionType } from './models';

/**
 * Direction of each transaction type — the API expects stock-removing types
 * as negative deltas. Exhaustive by construction: adding a TransactionType
 * without classifying it here is a compile error.
 */
const TYPE_SIGN: Record<TransactionType, 1 | -1> = {
  StockIn: 1,
  Return: 1,
  Adjustment: 1,
  StockOut: -1,
  Sale: -1
};

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/transaction`;

  getAll(): Observable<TransactionDto[]> {
    return this.http.get<TransactionDto[]>(this.baseUrl);
  }

  getById(id: number): Observable<TransactionDto> {
    return this.http.get<TransactionDto>(`${this.baseUrl}/${id}`);
  }

  getByItem(itemId: number): Observable<TransactionDto[]> {
    return this.http.get<TransactionDto[]>(`${this.baseUrl}/item/${itemId}`);
  }

  /**
   * The API applies `quantity` as a SIGNED delta to the item's stock
   * (`item.Quantity += quantity`) and only validates that the result is ≥ 0.
   * Callers pass the user-facing positive quantity; outbound types are
   * negated here so StockOut/Sale actually subtract and can trigger the
   * server's insufficient-stock 400.
   */
  create(request: TransactionCreateRequest): Observable<TransactionDto> {
    const signedQuantity = TYPE_SIGN[request.type] * Math.abs(request.quantity);
    return this.http.post<TransactionDto>(this.baseUrl, { ...request, quantity: signedQuantity });
  }
}
