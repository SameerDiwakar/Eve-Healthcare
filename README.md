# EVE Healthcare — Diagnostic Test Booking & Payments Backend

Backend service for booking diagnostic tests and managing simulated payments.

**Tech Stack:** Node.js, Express, PostgreSQL, Prisma, JWT authentication, Jest, Supertest.

## 1. Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 16+

### Steps
```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate deploy
npx prisma generate

# Start development server
npm run dev
```

### Running Tests
```bash
npm test
```

## 2. Docker Setup

```bash
docker compose up --build
```
This boots a PostgreSQL container alongside the Express API, automatically executing database migrations on startup.

## 3. API Reference

### Authentication
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/auth/signup` | No | Register new user account |
| POST | `/auth/login` | No | Authenticate user & receive JWT bearer token |

### Diagnostic Centres & Tests
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/centres/` | Yes | Register new diagnostic centre |
| GET | `/centres/` | No | List all centres with available tests |
| GET | `/centres/:id` | No | Retrieve centre details by ID |
| POST | `/centres/:id/tests` | Yes | Add diagnostic test to centre |
| GET | `/centres/:id/tests` | No | List tests for a specific centre |

### Bookings
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/bookings/` | Yes | Create test booking (`PENDING` state) |
| GET | `/bookings/` | Yes | Get current user's bookings |
| GET | `/bookings/:id` | Yes | Retrieve booking details |
| POST | `/bookings/:id/cancel` | Yes | Cancel pending booking |

### Payments
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/payments/` | Yes | Initiate simulated payment |
| POST | `/payments/webhook` | No | Idempotent payment webhook callback |

## 4. Database Schema

- `users`: User credentials and account data.
- `diagnostic_centres` & `diagnostic_tests`: Centres and test offerings with pricing.
- `bookings`: Test reservations linked to users. Price is frozen at creation time.
- `payments`: Tracks payment attempts linked to bookings.
- `webhook_events`: Idempotency registry for processed webhook transactions.

## 5. Webhook Idempotency

Payment callbacks route through `processPaymentEvent` inside a single database transaction:
1. Inserts `event_id` into `webhook_events` table (enforces `UNIQUE` constraint).
2. If `event_id` already exists, execution halts cleanly without re-applying payment or booking updates (`duplicate: true`).
3. Updates `Payment` and `Booking` statuses (`PENDING` -> `CONFIRMED` / `FAILED`).

## 6. Future Enhancements

- Role-based access control (RBAC) for centre administration.
- Rate limiting on authentication and payment endpoints.
- Webhook signature verification (HMAC).
- Redis caching for diagnostic test catalog endpoints.
