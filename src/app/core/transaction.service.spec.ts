import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionService } from './transaction.service';
import { TransactionType } from './models';
import { environment } from '../../environments/environment';

/**
 * The service's job is the SIGN contract: the API applies `quantity` as a signed
 * delta, so outbound types (StockOut/Sale) must be sent negative and inbound types
 * positive, always from the absolute value the user typed.
 */
describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiBaseUrl}/transaction`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function postedQuantityFor(type: TransactionType, quantity: number): number {
    service.create({ itemId: 1, type, quantity }).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as { quantity: number };
    req.flush({});
    return body.quantity;
  }

  it('sends StockOut as a negative delta', () => {
    expect(postedQuantityFor('StockOut', 5)).toBe(-5);
  });

  it('sends Sale as a negative delta', () => {
    expect(postedQuantityFor('Sale', 3)).toBe(-3);
  });

  it('sends StockIn as a positive delta', () => {
    expect(postedQuantityFor('StockIn', 7)).toBe(7);
  });

  it('sends Return as a positive delta', () => {
    expect(postedQuantityFor('Return', 2)).toBe(2);
  });

  it('sends Adjustment as a positive delta', () => {
    expect(postedQuantityFor('Adjustment', 4)).toBe(4);
  });

  it('normalizes a negative input for an inbound type back to positive', () => {
    // The sign is decided by the TYPE, not by the number the caller happened to pass
    expect(postedQuantityFor('StockIn', -9)).toBe(9);
  });

  it('normalizes a negative input for an outbound type to a consistent negative', () => {
    expect(postedQuantityFor('StockOut', -6)).toBe(-6);
  });

  it('preserves the other request fields', () => {
    service.create({ itemId: 42, type: 'Sale', quantity: 1, notes: 'hello' }).subscribe();
    const req = httpMock.expectOne(url);
    const body = req.request.body as { itemId: number; type: string; notes: string };
    expect(body.itemId).toBe(42);
    expect(body.type).toBe('Sale');
    expect(body.notes).toBe('hello');
    req.flush({});
  });
});
