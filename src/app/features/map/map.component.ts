import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { WarehouseService } from '../../core/warehouse.service';
import { RouteService } from '../../core/route.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { RouteTripDto, WarehouseDto } from '../../core/models';

type LocatedWarehouse = WarehouseDto & { latitude: number; longitude: number };

/**
 * Map of all main warehouses + driving-route planner: pick stops, get the
 * best visiting order (real road routing via OSRM), the drawn route, and
 * total driving distance/time by car.
 */
@Component({
  selector: 'app-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './map.component.html'
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly warehouseService = inject(WarehouseService);
  private readonly routeService = inject(RouteService);

  @ViewChild('mapHost') private mapHost!: ElementRef<HTMLDivElement>;

  protected readonly warehouses = this.warehouseService.warehouses;
  protected readonly loading = signal(true);

  /** Mains that have real coordinates and can be plotted. */
  protected readonly located = computed(() =>
    (this.warehouses() ?? []).filter(
      (w): w is LocatedWarehouse =>
        w.parentWarehouseId === null && w.latitude !== null && w.longitude !== null
    )
  );

  /** Mains missing coordinates (created before the map requirement). */
  protected readonly unlocated = computed(() =>
    (this.warehouses() ?? []).filter(
      (w) => w.parentWarehouseId === null && (w.latitude === null || w.longitude === null)
    )
  );

  /** Warehouse ids selected as route stops. */
  protected readonly selected = signal<Set<number>>(new Set());
  private selectionTouched = false;

  protected readonly routePending = signal(false);
  protected readonly routeError = signal<string | null>(null);
  protected readonly route = signal<{ trip: RouteTripDto; stops: LocatedWarehouse[] } | null>(null);

  /** Stops of the computed route, in actual visit order. */
  protected readonly orderedStops = computed(() => {
    const result = this.route();
    if (!result) {
      return [];
    }
    return result.stops
      .map((stop, index) => ({ stop, order: result.trip.visitOrder[index] }))
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.stop);
  });

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private routeLayer: L.LayerGroup | null = null;
  private viewReady = false;

  constructor() {
    this.warehouseService.getAll().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false)
    });

    effect(() => {
      const located = this.located();
      untracked(() => {
        // All stops start selected until the user starts curating the list.
        if (!this.selectionTouched) {
          this.selected.set(new Set(located.map((w) => w.id)));
        }
        this.plot(located);
      });
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapHost.nativeElement, {
      center: [31.8, 34.9],
      zoom: 7
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.viewReady = true;
    this.plot(this.located());
    setTimeout(() => this.map?.invalidateSize(), 120);
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  // ── Route planning ────────────────────────────────────────────────────

  toggleStop(id: number): void {
    this.selectionTouched = true;
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  selectedStops(): LocatedWarehouse[] {
    const ids = this.selected();
    return this.located().filter((w) => ids.has(w.id));
  }

  computeRoute(): void {
    const stops = this.selectedStops();
    if (stops.length < 2 || this.routePending()) {
      return;
    }

    this.routePending.set(true);
    this.routeError.set(null);

    this.routeService.getTrip(stops).subscribe({
      next: (trip) => {
        this.routePending.set(false);
        this.route.set({ trip, stops });
        this.drawRoute(trip, stops);
      },
      error: (err: unknown) => {
        this.routePending.set(false);
        this.routeError.set(extractErrorMessage(err));
      }
    });
  }

  clearRoute(): void {
    this.route.set(null);
    this.routeError.set(null);
    this.routeLayer?.clearLayers();
    this.plot(this.located());
  }

  protected formatDuration(seconds: number): string {
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  }

  // ── Drawing ───────────────────────────────────────────────────────────

  private pinIcon(): L.DivIcon {
    return L.divIcon({
      className: 'map-pin',
      html: '<span class="map-pin__dot"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  private stopIcon(order: number): L.DivIcon {
    return L.divIcon({
      className: 'map-stop',
      html: `<span class="map-stop__badge">${order}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  private popupFor(warehouse: LocatedWarehouse): string {
    return (
      `<div class="map-popup">` +
      `<strong>${escapeHtml(warehouse.name)}</strong><br>` +
      `${escapeHtml(warehouse.location)}<br>` +
      `<a href="/warehouse/${warehouse.id}">Open warehouse →</a>` +
      `</div>`
    );
  }

  private plot(mains: LocatedWarehouse[]): void {
    if (!this.viewReady || !this.map || !this.markersLayer) {
      return;
    }

    this.markersLayer.clearLayers();
    for (const warehouse of mains) {
      L.marker([warehouse.latitude, warehouse.longitude], { icon: this.pinIcon() })
        .bindPopup(this.popupFor(warehouse))
        .addTo(this.markersLayer);
    }

    if (mains.length > 0 && !this.route()) {
      const bounds = L.latLngBounds(mains.map((w) => [w.latitude, w.longitude] as [number, number]));
      this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    }
  }

  private drawRoute(trip: RouteTripDto, stops: LocatedWarehouse[]): void {
    if (!this.viewReady || !this.map || !this.routeLayer || !this.markersLayer) {
      return;
    }

    this.routeLayer.clearLayers();
    this.markersLayer.clearLayers();

    const line = L.polyline(trip.geometry, {
      color: '#b8912f',
      weight: 5,
      opacity: 0.85
    }).addTo(this.routeLayer);

    // Routed stops get numbered badges (visit order); the rest keep plain pins.
    const routedIds = new Set(stops.map((s) => s.id));
    stops.forEach((stop, index) => {
      L.marker([stop.latitude, stop.longitude], { icon: this.stopIcon(trip.visitOrder[index] + 1) })
        .bindPopup(this.popupFor(stop))
        .addTo(this.routeLayer!);
    });
    for (const warehouse of this.located()) {
      if (!routedIds.has(warehouse.id)) {
        L.marker([warehouse.latitude, warehouse.longitude], { icon: this.pinIcon() })
          .bindPopup(this.popupFor(warehouse))
          .addTo(this.markersLayer);
      }
    }

    this.map.fitBounds(line.getBounds(), { padding: [48, 48] });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
