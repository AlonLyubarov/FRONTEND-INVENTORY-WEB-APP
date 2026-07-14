import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreatePersonalTaskRequest,
  PersonalTaskDto,
  UpdatePersonalTaskRequest
} from './models';

/** Personal to-do tasks — scoped server-side to the current user. */
@Injectable({ providedIn: 'root' })
export class PersonalTaskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tasks`;

  getAll(): Observable<PersonalTaskDto[]> {
    return this.http.get<PersonalTaskDto[]>(this.baseUrl);
  }

  create(request: CreatePersonalTaskRequest): Observable<PersonalTaskDto> {
    return this.http.post<PersonalTaskDto>(this.baseUrl, request);
  }

  update(id: number, request: UpdatePersonalTaskRequest): Observable<PersonalTaskDto> {
    return this.http.put<PersonalTaskDto>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
