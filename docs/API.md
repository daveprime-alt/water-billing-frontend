# Frontend API reference

This frontend calls the existing Express API only. It never connects directly to PostgreSQL or stores database, Daraja, or signing secrets.

## Configuration and request conventions

- The API origin is configured with `VITE_API_BASE_URL`; it defaults to `http://localhost:3500`.
- Set the backend `CORS_ORIGINS` to include the frontend's origin (Vite defaults to `http://localhost:5173`).
- JSON requests send `Accept: application/json` and `Content-Type: application/json`. Protected requests include `Authorization: Bearer <token>`.
- API requests time out after 20 seconds. A timed-out request shows a clear error and can be submitted again manually; credentials are never retried automatically.
- Customer import is `multipart/form-data`, with a file field named `file`; the browser sets the multipart boundary.
- API errors may return `{ "error": "..." }`. The frontend surfaces the message and clears its session on HTTP 401. It does not automatically retry submitted credentials.
- Money values use integer cents and are rendered as Ksh after division by 100.

## Authentication and user accounts

| Method | Endpoint | Who can call it | Request | Response / behavior |
| --- | --- | --- | --- | --- |
| `POST` | `/api/users/login` | Public | JSON: `{ "phoneNumber": "0712345678", "password": "..." }` | On success: `{ "message": "...", "token": "...", "mustChangePassword": true, "user": { "id", "accountNumber", "firstName", "middleName", "lastName", "phoneNumber", "role", "location" } }`. Phone numbers are normalized by the backend. When `mustChangePassword` is true, only the password-change screen is available. |
| `POST` | `/api/users/change-password` | Any signed-in user, including a first-login user | JSON: `{ "currentPassword": "...", "newPassword": "..." }` | Success instructs the user to sign in again; the frontend clears the session and returns to login. The frontend requires at least 8 characters, no more than 72 UTF-8 bytes, and a value different from the user's phone number. |
| `GET` | `/api/users/profile` | Signed-in user who has changed any temporary password | No body | Returns the caller's profile. |
| `PUT` | `/api/users/profile` | Signed-in user who has changed any temporary password | JSON may contain `firstName`, `middleName` (including `null`), `lastName`, and/or `location`. Example: `{ "firstName": "Amina", "middleName": null, "lastName": "Wanjiku", "location": "Village" }`. Do not send role, account number, phone number, or password. | Returns the updated profile. |
| `GET` | `/api/users/directory` | `ADMIN`, `READER` | Query: `search` (optional), `page` (default `1`), `pageSize` (default `20`, maximum `100`), `role` (optional `ADMIN`, `READER`, or `CONSUMER`). Example: `/api/users/directory?search=Amina&page=1&pageSize=20&role=CONSUMER`. | `{ "users": [], "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 } }`. Results contain directory fields only, not password hashes. Search covers names, account number, and phone. Readers can see consumers only; the frontend fixes their role filter to `CONSUMER`. Admins may search all roles and optionally filter. Consumers cannot access this endpoint. |
| `GET` | `/api/users/:id` | `ADMIN`, `READER` | User ID in the path; no body | Returns the user for the known ID. There is no endpoint to list/search users other than the directory endpoint above. |

The initial/reset password is the user's normalized phone number. The frontend warns users to change it immediately and warns administrators to communicate it only through a verified channel.

## Administrator operations

| Method | Endpoint | Who can call it | Request | Response / behavior |
| --- | --- | --- | --- | --- |
| `POST` | `/api/admin/users` | `ADMIN` | JSON: `{ "firstName": "Amina", "middleName": null, "lastName": "Wanjiku", "phoneNumber": "0712345678", "role": "CONSUMER", "accountNumber": "WTR-KAK-611AE3D4", "location": "optional" }`. `role` must be `CONSUMER` or `READER`; phone and account number are required. The account number format example reflects the format shown by the current utility; preserve the established account-number value format. | HTTP 201 on success. Duplicate phone or account number is HTTP 409. Initial password is the normalized phone number. This route cannot create admins. |
| `DELETE` | `/api/admin/users/:id` | `ADMIN` | User ID in the path; no body. | **Frontend integration requires this endpoint.** Return a success response when deletion is safe; reject with HTTP 409 when billing, payment, or meter-reading history must be retained. Never cascade-delete financial or reading records. |
| `POST` | `/api/admin/users/:id/reset-password` | `ADMIN` | User ID in path; no body. The UI requires confirmation. | Resets the temporary password to the user's normalized phone number. Remind the administrator to verify the user's identity outside the app. |
| `PATCH` | `/api/admin/users/:id/phone` | `ADMIN` | JSON: `{ "phoneNumber": "0711222333" }`. The UI requires confirmation. | Changes the phone number and resets the temporary password to the normalized new number. Phone numbers must be unique. |
| `DELETE` | `/api/admin/users/:id/phone` | `ADMIN` | User ID in the path; no body. | **Frontend integration requires this endpoint.** Removes the user's phone number without deleting their account. Enforce sign-in, billing-notification, and account-integrity rules server-side; return a clear error if removal is not allowed. |
| `POST` | `/api/admin/import-customers` | `ADMIN` | Multipart form upload with field `file`. Accepts `.xls`, `.xlsx`, `.xlsm`, `.csv`, up to 10 MB. | The UI reports imported/skipped totals and phone warnings from the API response. Invalid or missing phone values may import as null; duplicate or invalid rows may be skipped. |
| `POST` | `/api/admin/logout` | Signed-in user who has changed any temporary password | No body | Revokes the current token. The frontend clears the local session after success and also clears it locally if the request fails. |

## Meter readings

| Method | Endpoint | Who can call it | Request | Response / behavior |
| --- | --- | --- | --- | --- |
| `POST` | `/api/readings` | `ADMIN`, `READER` | JSON: `{ "customerId": "<user-id>", "currentReading": 12345 }`. Reading must be a whole number from `0` through `99,999`. | Creates a reading and invoice. Success includes `{ "message": "...", "invoice": ..., "usageReview": { "onHold": false, "averageUnits": null, "threshold": null, "previousReadingsCount": 0 } }`. Usage over three times the available previous-three-month average may be held for admin review. A customer can have only one reading per billing month. |
| `GET` | `/api/readings` | `ADMIN`, `READER` | No body | Lists readings. Readers receive current-month readings; admins receive all readings. The admin reading-history view uses `customer`, `billingMonth` (or `billingPeriod`), `previousReading`, `consumptionUnits`, `createdAt`, and reader attribution (`recordedBy`, `reader`, `createdBy`, `meterReader`, or `recorder`) when those fields are returned. Month labels fall back to the reading date, and missing reader/previous-reading details are shown as unavailable; the current endpoint documentation does not guarantee those fields. |
| `GET` | `/api/readings/:id` | `ADMIN`, `READER` | Reading ID in path; no body | Returns one reading. Readers can view only current-month readings. |
| `PUT` | `/api/readings/:id` | `ADMIN`, `READER` | JSON: `{ "currentReading": 12345 }`. | Corrects the reading. Readers may correct only readings they recorded. The backend may recalculate later readings and affected unpaid invoices; settled invoices can result in HTTP 409. |
| `DELETE` | `/api/readings/:id` | `ADMIN`, `READER` | Reading ID in path; no body | Deletes the reading only if it has no invoice and no later dependent readings. Readers may delete only readings they recorded. |

The reading-entry customer picker uses `GET /api/users/directory`; it does not use sample customers. Until a matching consumer is returned by that endpoint, the UI cannot submit a reading for them.

## Invoices and payments

| Method | Endpoint | Who can call it | Request | Response / behavior |
| --- | --- | --- | --- | --- |
| `GET` | `/api/invoices` | `ADMIN` | No body | Lists all invoices with reading and selected customer details. |
| `GET` | `/api/invoices/my-bills` | Signed-in user who has changed any temporary password | No body | Returns the caller's invoices. Include `consumptionUnits` from the related meter reading so the consumer dashboard can show monthly usage. |
| `POST` | `/api/invoices/:id/pay` | Invoice owner or `ADMIN` | JSON: `{ "phoneNumber": "0712345678" }` | Initiates an STK Push to the supplied phone number and returns a message and `checkoutRequestId`. This means the prompt was sent/accepted for processing, not that the invoice is paid. The invoice remains pending until backend callback processing reconciles its status. |
| `PUT` | `/api/invoices/:id/cancel` | `ADMIN` | Invoice ID in path; no body | Cancels an invoice, subject to backend rules. Not offered to readers or consumers. |

Invoice statuses include `UNPAID`, `PENDING_PAYMENT`, `PAID`, `CANCELLED`, and `ADMIN_HOLD`. `ADMIN_HOLD` is distinct from pending payment; the frontend does not present held invoices as payable. There is no endpoint to fetch a single invoice by ID.

## Health and backend-only callback

| Method | Endpoint | Who can call it | Request | Behavior |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Public | No body | Confirms that the API process is responding. The application shell uses it for the API availability indicator. |
| `POST` | `/api/v1/payments/idk-callback` (reported current path) | Daraja/backend only; never the frontend | Daraja callback payload | Daraja calls the backend directly. The callback path reportedly does not match the path used to mount its rate limiter (`/api/v1/payments/server-callback`); backend owners must verify and align configuration. Frontend payment flows do not call this route. |

## Known backend limitations

- There is no public signup endpoint; administrators create accounts.
- There is no password-recovery endpoint; password recovery is administrator-assisted.
- There is no endpoint to fetch an invoice by ID.
- The consumer invoice response must include `consumptionUnits` from its related meter reading for the dashboard to show monthly usage; until then the dashboard indicates that usage details are unavailable.
- The callback route and rate-limiter path require backend verification; the frontend must not attempt to repair or call the callback.
