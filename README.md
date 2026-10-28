# Cagnar Farm utility portal

Responsive React frontend for the water utility Express API. The UI uses Tailwind CSS 4, React Router, TanStack Query, React Hook Form, Zod, Zustand, Lucide, and Sonner.

Tailwind is enabled through the Vite plugin and imported in `src/index.css`. Styling is being migrated incrementally: the login page uses Tailwind utilities, while the rest of the existing application continues using `src/App.css` until each screen is migrated.

## Source organization

```text
src/
├── App.jsx                         # Router, auth guards, and shared query provider
├── components/
│   ├── dashboard/Dashboard.jsx     # Role dashboards, dashboard tables, backend-gap notice
│   ├── layout/AppShell.jsx         # Role-aware application navigation and shell
│   └── ui/index.jsx                # Shared page title, field, status, error, empty, and dialog components
├── config/navigation.js            # Role labels and allowed navigation links
├── pages/
│   ├── AccountsPage.jsx
│   ├── ChangePasswordPage.jsx
│   ├── InvoicesPage.jsx
│   ├── LoginPage.jsx
│   ├── ProfilePage.jsx
│   └── ReadingsPage.jsx
├── services/
│   ├── api.js                      # API base URL, bearer handling, endpoint surface, HTTP errors
│   └── models.d.ts                 # Shared API request/response model definitions
├── stores/authStore.js             # Tab-scoped authentication session
└── utils/formatters.js             # Shared user-name and API-error formatting
```

Page modules and reusable UI components use named ES module exports. `App.jsx` is the default-exported application entry component imported by `src/main.jsx`. Dashboard and page modules are loaded on demand, and `services/api.js` documents endpoint payloads with the shared declarations in `services/models.d.ts`.

See [docs/API.md](./docs/API.md) for the full frontend API reference, including endpoint roles, payloads, response details, and backend-only routes.

## Local development

1. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the public API origin (defaults to `http://localhost:3500`).
2. Run `npm install` if dependencies are not installed.
3. Run `npm run dev`.
4. Configure the backend's `CORS_ORIGINS` to include the Vite origin shown in the terminal (normally `http://localhost:5173`).

Only the public API base URL belongs in frontend configuration. Do not add database credentials, Daraja credentials, or signing secrets to Vite environment variables. The browser talks only to the Express API.

## Implemented API flows

- Provisioned-user login, temporary-password change, profile read/update, and API logout.
- Role-gated administrator, meter-reader, and customer navigation.
- Customer invoice history and payment prompt requests. A payment prompt is shown as pending; the invoice is refreshed and only backend-reconciled `PAID` status is represented as paid.
- Administrator invoice and reading registers; invoice cancellation.
- Meter-reading creation, correction, and deletion, including usage-review messaging.
- Paginated user directory search for administrators and consumer-only search for readers.
- Administrator account creation, customer file import, password reset, and phone correction.
- Administrator SMS queue, announcement preferences, operational campaigns, and SMS audit history.
- Session-scoped token persistence, bearer authorization, request error states, and local logout on HTTP 401.

### SMS management integration assumptions

- The SMS administration endpoints use the existing shared API origin and authenticated bearer token; the frontend does not store separate SMS credentials.
- List endpoints return an array or an object containing a named list (`messages`, `preferences`, `campaigns`, `actions`, `audit`, or `events`) and optional `pagination`/`meta` values (`total`, `totalPages`, or `hasNextPage`).
- Message, preference, campaign, preview, and audit fields are read from conventional names such as `status`, `maskedRecipient`/`phoneNumber`, `attemptHistory`, `eligibleRecipientCount`, `eligibleRecipients`, `counts`, `metadata`, and `createdAt`. SMS content is displayed for queue review, while phone numbers and credential-like error data are masked or redacted.
- Campaign preview responses should include the exact eligible count and preferably the recipient list, plus any truncation/over-limit indication. The UI enforces the 10-minute preview expiry locally and the API remains authoritative for expiry and recipient-count conflicts.

## Known backend gaps / blocked UI

1. **No single-invoice-by-ID endpoint.** Invoice lists and permitted invoice actions work, but a dedicated invoice detail screen cannot fetch an individual invoice and is not implemented.
2. **Daraja callback path and rate limiter mismatch.** The callback is backend-to-backend and is not called by this frontend. The documented `POST /api/v1/payments/idk-callback` path and rate-limiter mount must be verified by the backend owner before relying on callback delivery and payment reconciliation.
3. **No utility-wide operational summary endpoint.** The public `/health` route confirms that the API process responds, and the application shell displays that availability. The dashboard can report the signed-in user's profile location and derive metrics from its authorized invoice/reading list, but cannot show utility-wide staff, field-region, or operational totals without additional API data.

The user directory endpoint removes the previous consumer-search and admin-directory gaps. Admins can search all roles and optionally filter by role; readers use a fixed `CONSUMER` filter. Consumers do not see or call the directory.

API authorization remains the security boundary. Client-side role checks only control navigation and visibility.
