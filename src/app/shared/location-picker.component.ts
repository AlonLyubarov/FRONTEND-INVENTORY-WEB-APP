import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { environment } from '../../environments/environment';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  /** Human-readable address of the picked point (from geocoding), if any. */
  label?: string;
}

/** Shape returned by our backend geocoding proxy (GET /api/geocode). */
interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const DEFAULT_CENTER: L.LatLngExpression = [31.8, 34.9]; // Israel-ish default view

/**
 * Address → coordinates widget: the address input IS the geocoding field.
 * Typing queries OpenStreetMap's Nominatim API; picking a suggestion sets both
 * the address text and the real coordinates. The map shows the pin and allows
 * fine-tuning by clicking.
 */
@Component({
  selector: 'app-location-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <div class="location-picker">
      <div class="location-picker__search">
        <input
          type="text"
          [placeholder]="placeholder()"
          autocomplete="off"
          maxlength="200"
          [value]="address()"
          (input)="onAddressInput($any($event.target).value)"
        />
        @if (results().length > 0) {
          <ul class="location-picker__results">
            @for (result of results(); track $index) {
              <li>
                <button type="button" (click)="pickResult(result)">{{ result.displayName }}</button>
              </li>
            }
          </ul>
        }
      </div>

      <div #mapHost class="location-picker__map"></div>

      <div class="location-picker__status">
        @if (point(); as p) {
          <span>📍 {{ p.latitude | number: '1.5-5' }}, {{ p.longitude | number: '1.5-5' }}</span>
        } @else if (searching()) {
          <span class="text-muted">Looking up address…</span>
        } @else {
          <span class="text-muted">Type the address and pick a suggestion, or click the map.</span>
        }
      </div>
    </div>
  `
})
export class LocationPickerComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);

  /** Pre-existing values (edit mode). */
  readonly initialAddress = input<string>('');
  readonly initialLatitude = input<number | null>(null);
  readonly initialLongitude = input<number | null>(null);
  readonly placeholder = input<string>('Type the warehouse address…');

  /** Fires on every keystroke with the raw address text. */
  readonly addressChange = output<string>();
  /** Fires when real coordinates are resolved (suggestion picked / map click). */
  readonly picked = output<PickedLocation>();

  @ViewChild('mapHost') private mapHost!: ElementRef<HTMLDivElement>;

  protected readonly address = signal('');
  protected readonly results = signal<GeocodeResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly point = signal<PickedLocation | null>(null);

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  private readonly pinIcon = L.divIcon({
    className: 'map-pin',
    html: '<span class="map-pin__dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  ngAfterViewInit(): void {
    this.address.set(this.initialAddress());

    const lat = this.initialLatitude();
    const lng = this.initialLongitude();
    const hasInitial = lat !== null && lng !== null;

    this.map = L.map(this.mapHost.nativeElement, {
      center: hasInitial ? [lat, lng] : DEFAULT_CENTER,
      zoom: hasInitial ? 14 : 7
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    if (hasInitial) {
      this.setPoint(lat, lng, undefined, false);
    }

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.setPoint(event.latlng.lat, event.latlng.lng);
    });

    // Modals animate open — make sure tiles size correctly once visible.
    setTimeout(() => this.map?.invalidateSize(), 120);
  }

  ngOnDestroy(): void {
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }
    this.map?.remove();
    this.map = null;
  }

  onAddressInput(value: string): void {
    this.address.set(value);
    this.addressChange.emit(value);

    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }
    const term = value.trim();
    if (term.length < 3) {
      this.results.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.debounceHandle = setTimeout(() => this.search(term), 450);
  }

  private search(term: string): void {
    // Goes through OUR backend proxy — it talks to the geocoding provider.
    this.http
      .get<GeocodeResult[]>(`${environment.apiBaseUrl}/geocode`, { params: { query: term } })
      .subscribe({
        next: (results) => {
          this.searching.set(false);
          this.results.set(results);
        },
        error: () => {
          this.searching.set(false);
          this.results.set([]);
        }
      });
  }

  pickResult(result: GeocodeResult): void {
    this.results.set([]);
    const label = result.displayName.slice(0, 200);
    this.address.set(label);
    this.addressChange.emit(label);

    this.map?.setView([result.latitude, result.longitude], 15);
    this.setPoint(result.latitude, result.longitude, label);
  }

  private setPoint(lat: number, lng: number, label?: string, emit = true): void {
    const location: PickedLocation = { latitude: lat, longitude: lng, label };
    this.point.set(location);

    if (this.map) {
      if (this.marker) {
        this.marker.setLatLng([lat, lng]);
      } else {
        this.marker = L.marker([lat, lng], { icon: this.pinIcon }).addTo(this.map);
      }
    }

    if (emit) {
      this.picked.emit(location);
    }
  }
}
