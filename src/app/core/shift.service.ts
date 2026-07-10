import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateShiftRequest, ShiftDto } from './models';

/**
 * Work-schedule shifts: owners manage a warehouse's schedule; every user
 * reads their own upcoming shifts.
 */
@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/shift`;

  getMine(): Observable<ShiftDto[]> {
    return this.http.get<ShiftDto[]>(`${this.baseUrl}/mine`);
  }

  getForWarehouse(warehouseId: number): Observable<ShiftDto[]> {
    return this.http.get<ShiftDto[]>(`${this.baseUrl}/warehouse/${warehouseId}`);
  }

  create(request: CreateShiftRequest): Observable<ShiftDto> {
    return this.http.post<ShiftDto>(this.baseUrl, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
