# EVE Healthcare — Diagnostic Test Booking & Payments Backend

A robust, production-ready backend service for diagnostic test bookings and simulated payment processing with idempotent webhook handling.

**Tech Stack:** Node.js, Express.js, PostgreSQL, Prisma ORM, JWT Authentication, Jest, Supertest, Docker & Docker Compose.

---

## 1. How to Run the Project Locally

### Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: v16.x or higher (or use Docker)
- **npm**: v9.x or higher

### Step-by-Step Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <repository-url>
   cd Eve_Assignment
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory (or copy from `.env.example`):
   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=eve_dev
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eve_dev?schema=public"
   JWT_SECRET="dev-secret-key-change-in-production"
   PORT=3000
   ```

3. **Run Database Migrations & Prisma Client Generation:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The API server will listen on `http://localhost:3000`.

### Running Tests

Execute the automated test suite powered by Jest & Supertest (uses an in-memory Prisma mock for isolated execution):
```bash
npm test
```

---

## 2. Docker Setup

To run the full stack (Node.js API + PostgreSQL 16) inside Docker containers:

```bash
docker compose up --build
```

- **API Service**: Exposed on `http://localhost:5000` (or `http://localhost:3000` inside container).
- **PostgreSQL Service**: Exposed on port `5432` with automatic health checks and database migrations executed on startup.

To stop and clean up containers:
```bash
docker compose down -v
```

---

## 3. API Endpoints & Example Requests

### Health Check
- `GET /health` — Check backend status.

---

### Authentication

#### 1. Register User
`POST /auth/signup`

**Request Body:**
```json
{
  "email": "patient@example.com",
  "password": "securepassword123"
}
```
**Response (201 Created):**
```json
{
  "id": 1,
  "email": "patient@example.com",
  "createdAt": "2026-09-27T21:00:00.000Z"
}
```

#### 2. User Login
`POST /auth/login`

**Request Body:**
```json
{
  "email": "patient@example.com",
  "password": "securepassword123"
}
```
**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### Diagnostic Centres & Tests

#### 3. Create Diagnostic Centre *(Auth Required)*
`POST /centres/`  
*Header:* `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "name": "Apollo Diagnostics",
  "location": "New Delhi"
}
```
**Response (201 Created):**
```json
{
  "id": 1,
  "name": "Apollo Diagnostics",
  "location": "New Delhi"
}
```

#### 4. List All Centres
`GET /centres/`

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Apollo Diagnostics",
    "location": "New Delhi",
    "tests": [
      {
        "id": 1,
        "centreId": 1,
        "name": "Complete Blood Count (CBC)",
        "price": 499
      }
    ]
  }
]
```

#### 5. Add Test to Centre *(Auth Required)*
`POST /centres/:id/tests`  
*Header:* `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "name": "Lipid Profile Panel",
  "price": 899.50
}
```
**Response (201 Created):**
```json
{
  "id": 2,
  "centreId": 1,
  "name": "Lipid Profile Panel",
  "price": 899.50
}
```

---

### Booking System

#### 6. Create Test Booking *(Auth Required)*
`POST /bookings/`  
*Header:* `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "testId": 1,
  "appointmentTime": "2026-10-15T10:00:00.000Z"
}
```
**Response (201 Created):**
```json
{
  "id": 1,
  "userId": 1,
  "testId": 1,
  "centreId": 1,
  "appointmentTime": "2026-10-15T10:00:00.000Z",
  "amount": 499,
  "status": "PENDING",
  "createdAt": "2026-09-27T21:10:00.000Z",
  "updatedAt": "2026-09-27T21:10:00.000Z"
}
```

#### 7. Get User Bookings *(Auth Required)*
`GET /bookings/`  
*Header:* `Authorization: Bearer <access_token>`

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "userId": 1,
    "testId": 1,
    "centreId": 1,
    "appointmentTime": "2026-10-15T10:00:00.000Z",
    "amount": 499,
    "status": "PENDING"
  }
]
```

#### 8. Cancel Booking *(Auth Required)*
`POST /bookings/:id/cancel`  
*Header:* `Authorization: Bearer <access_token>`

**Response (200 OK):**
```json
{
  "id": 1,
  "status": "CANCELLED",
  "updatedAt": "2026-09-27T21:15:00.000Z"
}
```

---

### Payments & Webhook

#### 9. Initiate Simulated Payment *(Auth Required)*
`POST /payments/`  
*Header:* `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "bookingId": 1,
  "forceStatus": "SUCCESS"
}
```
*Note: `forceStatus` (`SUCCESS` or `FAILED`) is optional. Omitting it triggers a random simulation outcome.*

**Response (201 Created):**
```json
{
  "payment": {
    "id": 1,
    "bookingId": 1,
    "providerReference": "8f3b2d11-4a92-411a-bc01-92bdf8811e9a",
    "amount": 499,
    "status": "SUCCESS"
  },
  "booking": {
    "id": 1,
    "status": "CONFIRMED"
  },
  "eventId": "e72f91a0-9c12-4211-b844-3011a78b9821"
}
```

#### 10. Process Payment Webhook *(Idempotent)*
`POST /payments/webhook`

**Request Body:**
```json
{
  "eventId": "e72f91a0-9c12-4211-b844-3011a78b9821",
  "providerReference": "8f3b2d11-4a92-411a-bc01-92bdf8811e9a",
  "status": "SUCCESS"
}
```

**Response — First Processing (200 OK):**
```json
{
  "received": true,
  "duplicate": false,
  "payment": {
    "id": 1,
    "status": "SUCCESS"
  }
}
```

**Response — Repeated / Replayed Event (200 OK):**
```json
{
  "received": true,
  "duplicate": true,
  "payment": {
    "id": 1,
    "status": "SUCCESS"
  }
}
```

---

## 4. Database Schema Design

The application models diagnostic test bookings, payments, and webhook idempotency using PostgreSQL & Prisma:

```mermaid
erDiagram
    User ||--o{ Booking : "places"
    DiagnosticCentre ||--o{ DiagnosticTest : "offers"
    DiagnosticCentre ||--o{ Booking : "hosts"
    DiagnosticTest ||--o{ Booking : "includes"
    Booking ||--o{ Payment : "has"

    User {
        Int id PK
        String email UK
        String hashedPassword
        DateTime createdAt
    }

    DiagnosticCentre {
        Int id PK
        String name
        String location
    }

    DiagnosticTest {
        Int id PK
        Int centreId FK
        String name
        Float price
    }

    Booking {
        Int id PK
        Int userId FK
        Int testId FK
        Int centreId FK
        DateTime appointmentTime
        Float amount
        BookingStatus status
    }

    Payment {
        Int id PK
        Int bookingId FK
        String providerReference UK
        Float amount
        PaymentStatus status
    }

    WebhookEvent {
        Int id PK
        String eventId UK
        Json payload
        DateTime processedAt
    }
```

### Key Models & Enums

- **`User`**: Account details and authentication hash.
- **`DiagnosticCentre` & `DiagnosticTest`**: Medical centres and their tests.
- **`Booking`**: Holds booking state (`PENDING`, `CONFIRMED`, `FAILED`, `CANCELLED`). Freezes the test price into `amount` at creation time.
- **`Payment`**: Records payment attempts linked to a booking with a unique `providerReference`.
- **`WebhookEvent`**: Stores incoming webhook event IDs with a `UNIQUE` index (`eventId`), serving as the idempotency ledger.

---

## 5. Important Assumptions Made

1. **Price Integrity / Price Freezing**:
   - When a booking is created, `amount` is copied from `DiagnosticTest.price` at that instant. Future price changes to the test will not affect existing bookings.

2. **Booking & Payment Lifecycle**:
   - Bookings start in `PENDING` state.
   - Successful payment transitions the booking to `CONFIRMED`.
   - Failed payment transitions the booking to `FAILED`.
   - Only `PENDING` bookings can be cancelled or paid.

3. **Webhook Idempotency Strategy**:
   - The payment gateway may deliver webhooks multiple times (at-least-once delivery).
   - `processPaymentEvent` executes inside an atomic database transaction (`prisma.$transaction`).
   - Inserting `eventId` into `WebhookEvent` relies on the `UNIQUE` constraint. If a duplicate `eventId` is received, Prisma throws a unique constraint error (`P2002`), which is caught gracefully to return `{ duplicate: true }` without corrupting payment or booking state.

4. **Resource Authorization**:
   - Users can only view, pay for, or cancel their own bookings. Requests for another user's booking return `403 Forbidden`.

---

## 6. What I Would Improve With More Time

1. **Add role-based permissions**: I would separate patient and admin accounts so only admins can create diagnostic centres or change test details.
2. **Verify payment webhooks**: I would check a shared secret signature before accepting a payment update, helping prevent fake webhook requests.
3. **Expand automated tests**: I would add more Jest and Supertest cases for invalid input and booking or payment edge cases.
4. **Improve validation and error handling**: I would return consistent, clear error responses when a request is invalid or cannot be completed.
