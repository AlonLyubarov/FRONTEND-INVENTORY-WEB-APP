import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateReminderRequest, ReminderDto } from './models';

/** Personal calendar reminders — scoped server-side to the current user. */
@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/reminder`;

  getAll(): Observable<ReminderDto[]> {
    return this.http.get<ReminderDto[]>(this.baseUrl);
  }

  create(request: CreateReminderRequest): Observable<ReminderDto> {
    return this.http.post<ReminderDto>(this.baseUrl, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
