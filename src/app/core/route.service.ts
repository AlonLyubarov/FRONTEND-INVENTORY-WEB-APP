import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OptimizeRouteRequest, OptimizeRouteResultDto, RouteTripDto } from './models';

/**
 * Driving-route planning between warehouses. The backend proxies OSRM and
 * returns the best visiting order, geometry, distance and duration by car.
 */
@Injectable({ providedIn: 'root' })
export class RouteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/route`;

  getTrip(stops: { latitude: number; longitude: number }[]): Observable<RouteTripDto> {
    const encoded = stops.map((s) => `${s.latitude},${s.longitude}`).join(';');
    return this.http.get<RouteTripDto>(`${this.baseUrl}/trip`, { params: { stops: encoded } });
  }

  /**
   * Weight- and urgency-aware optimization: our own algorithm on the server
   * (exhaustive for ≤8 stops, NN+2-opt beyond) over real road distances.
   */
  optimizeSmartRoute(request: OptimizeRouteRequest): Observable<OptimizeRouteResultDto> {
    return this.http.post<OptimizeRouteResultDto>(`${this.baseUrl}/optimize`, request);
  }
}
