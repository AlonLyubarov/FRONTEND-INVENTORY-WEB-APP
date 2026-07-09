# Inventory App — Frontend

An Angular 22 single-page application for warehouse and inventory management. This is the client for the [BACKEND-INVENTORY-WEB-APP](https://github.com/AlonLyubarov/BACKEND-INVENTORY-WEB-APP) ASP.NET Core Web API — warehouse owners register, build their warehouse tree, invite their team, and track stock in real time.

## Features

- **Owner Dashboard**: Each registered user becomes the owner (Admin) of their own main warehouse; the dashboard shows every owned warehouse with its sub-warehouses, team size, and quick actions
- **Warehouse Tree**: Main warehouses with one level of sub-warehouses — create, edit, and delete nodes, with items from sub-warehouses rolled up into the main warehouse view
- **Inventory**: Item management with product catalog lookup, per-node placement, minimum stock levels, and live status badges (In Stock / Low / Out of Stock)
- **Transactions**: Stock movements (StockIn, StockOut, Adjustment, Sale, Return) with server-validated stock levels and a full audit table
- **Team Management**: Owners invite Employees and Shift Managers into a main warehouse, and can remove them; role-based UI hides anything a role cannot do
- **Product Catalog**: Shared SKU catalog with full CRUD for Admins and Shift Managers, read-only for Employees

## Roles

| Action | Admin (owner) | Shift Manager | Employee |
|---|---|---|---|
| View warehouse tree, items, transactions | ✔ | ✔ | ✔ |
| Create / edit / delete warehouses | ✔ | ✖ | ✖ |
| Invite / remove users | ✔ | ✖ | ✖ |
| Create / edit items | ✔ | ✔ | ✖ |
| Delete items | ✔ | ✖ | ✖ |
| Create transactions | ✔ | ✔ | ✔ |
| Product catalog | full | full | read-only |

The UI mirrors these rules for usability only — authorization is always enforced server-side.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- The [backend API](https://github.com/AlonLyubarov/BACKEND-INVENTORY-WEB-APP) running at `http://localhost:5291` (its CORS policy already allows this app's origin)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Open `http://localhost:4200` and register — registration creates your account **and** your first main warehouse in one step.

### Configuration

The API base URL lives in a single place: `src/environments/environment.ts` (`apiBaseUrl`, default `http://localhost:5291/api`).

## Architecture

- **Standalone components** with lazy-loaded routes (no NgModules), preloaded in the background after startup
- **Signals + zoneless change detection** for state and rendering
- **Typed services per resource** (`AuthService`, `WarehouseService`, `ItemService`, `TransactionService`, `ProductCatalogService`) mirroring the API contract in `src/app/core`
- **Single functional HTTP interceptor**: attaches the JWT Bearer token, treats an expired token as a 401, redirects to login on 401, and surfaces 403/500 as toasts without logging out
- **Shared UI kit** (`src/app/shared`): modal, confirm dialog, toasts, and badge helpers over a global SCSS design system
- **Feature screens** (`src/app/features`): login, register, dashboard, warehouse page (Overview / Items / Transactions / Users tabs), and product catalog

## Session & Security Notes

- The `AuthResponse` (JWT, role, warehouse assignment, expiry) is stored in `localStorage` and hydrated on startup; expired sessions are discarded
- Server error bodies (`{ error }`, plain-string 400s, and ASP.NET ModelState) are normalized by one helper and shown next to the form or action that caused them
- All role checks in the UI are cosmetic — the backend verifies ownership and warehouse-tree access on every request

## Scripts

```bash
npm start       # dev server at http://localhost:4200
npm run build   # production build (dist/)
npm test        # unit tests (Vitest)
```

## Related Projects

- **Backend**: [BACKEND-INVENTORY-WEB-APP](https://github.com/AlonLyubarov/BACKEND-INVENTORY-WEB-APP) — .NET 10 ASP.NET Core Web API with JWT auth, warehouse-tree authorization, and audit trails. This app is built against its API contract exactly; run it first.
