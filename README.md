# 🎟️ TicketFlow — Event Ticket Booking Platform

TicketFlow is a backend-driven event ticket booking platform designed to manage events, seat availability, temporary seat reservations, and payment workflows. It uses a service-based architecture with PostgreSQL for persistent storage, Redis for temporary seat locking, and Apache Kafka for asynchronous event communication.

The project also aims to incorporate modern DevOps practices, including CI/CD, container orchestration, and GitOps-based deployment.

## ✨ Features

- **Authentication:** User registration, login, password hashing, and JWT-based authentication.
- **Event Management:** APIs for retrieving event information and seat availability.
- **Seat Reservation:** Temporary seat holds with Redis-based locking.
- **Booking Management:** Database transactions for seat-state updates and pending booking creation.
- **Payment Service:** Separate service for payment order creation and payment verification.
- **Event-Driven Communication:** Apache Kafka topics for seat and payment events.
- **Hold Expiration:** Background worker that checks for expired seat holds.
- **Containerized Infrastructure:** Docker and Docker Compose for local development.

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Backend | Node.js, TypeScript, Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Caching and Locking | Redis |
| Messaging | Apache Kafka |
| Authentication | JWT, bcrypt |
| Containerization | Docker, Docker Compose |
| Planned CI/CD | Jenkins |
| Planned Orchestration | Kubernetes |
| Planned GitOps | Argo CD |
| Planned Cloud Deployment | AWS |

## 🏗️ Architecture

```text
                 Frontend / API Client
                          |
                          v
                    REST API Layer
                          |
               +----------+----------+
               |                     |
               v                     v
         Event Service          Payment Service
           Port 3001               Port 3002
               |                     |
         +-----+-----+               |
         |     |     |               |
         v     v     v               |
      Postgres Redis Kafka <---------+
         |     |     |
         v     v     v
      Persistent Seat  Asynchronous
       Data     Locks   Events
```

### Event Service

Responsible for authentication, event and seat APIs, booking operations, and related background processing.

### Payment Service

Provides separate endpoints for creating payment orders and verifying payments.

### PostgreSQL

Stores persistent application data, including users, events, seats, and bookings.

### Redis

Provides temporary seat locks and expiration-based coordination to reduce conflicting booking attempts.

### Apache Kafka

Supports asynchronous communication through topics such as `seat-events` and `payment-events`.

## 🔄 Booking Workflow

1. A user logs in and receives a JWT.
2. The client retrieves events and available seats.
3. The user selects a seat and submits a booking request.
4. The Event Service authenticates the request.
5. Redis attempts to acquire a temporary lock for the selected seat.
6. PostgreSQL transactionally changes the seat from `AVAILABLE` to `HELD` and creates a `PENDING` booking.
7. The service publishes a seat-related event to Kafka.
8. The payment workflow creates an order and verifies the payment result.
9. The booking and seat states are updated according to the payment outcome and implemented business logic.
10. A background worker checks for expired holds and releases eligible seats.

The initial seat hold is temporary, with a five-minute expiry configured in the booking logic.

> **Consistency note:** Redis locking and database transactions address competing booking requests. Reliable production processing also requires appropriate handling of duplicate events, payment retries, and failures between database and Kafka operations.

## 📁 Project Structure

```text
ticketing-platform/
├── services/
│   ├── event-service/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── workers/
│   │   │   └── server.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── payment-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── docker-compose.yml
│   └── docker-compose.apps.yml
└── README.md
```

*Note: The structure above highlights the main service directories. Other files may exist in the repository.*

## 🚀 Local Development

### Prerequisites

- Node.js and npm
- Docker Desktop
- Git
- A configured PostgreSQL, Redis, and Kafka environment

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd ticketing-platform
```

### 2. Configure environment variables

Create the required `.env` files for the event and payment services using the corresponding example configuration or project documentation.

Configure database connection strings, Redis URLs, Kafka brokers, JWT secrets, and payment-provider credentials as appropriate.

**Never commit `.env` files, passwords, JWT secrets, API keys, or payment credentials.**

### 3. Start local infrastructure

From the `services` directory, start the configured infrastructure:

```bash
docker compose up -d postgres redis kafka
```

If the project uses an additional Compose override for Kafka configuration, follow the matching configuration for your local environment.

### 4. Build and start the backend services

Build the service images using the Dockerfiles in the respective service directories, or follow the existing Compose configuration for the application services.

Example:

```bash
docker compose -f docker-compose.apps.yml up -d
```

This command assumes the application images have already been built and the required environment files and Docker network are configured.

### 5. Verify service health

Event Service:

```bash
curl http://localhost:3001/health
```

Payment Service:

```bash
curl http://localhost:3002/health
```

The Event Service health endpoint returns a JSON status response when the HTTP server is responding. A health response alone does not prove that every database, Kafka, or payment operation is working.

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Event Service health check |
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Authenticate a user |
| GET | `/events` | Retrieve events |
| GET | `/events/:id/seats` | Retrieve seats for an event |
| POST | `/bookings` | Create a booking and hold a seat |
| GET | `/health` | Payment Service health check |
| POST | `/payments/orders` | Create a payment order |
| POST | `/payments/verify` | Verify a payment |

Protected endpoints require appropriate authentication. Consult the source code for request validation, response schemas, and authorization requirements.

## 🔐 Security Considerations

- Passwords are verified using bcrypt.
- JWTs protect authenticated routes.
- JWT secrets and payment credentials must be kept private.
- Production endpoints should use HTTPS.
- Seat availability must be validated server-side.
- Payment results must be verified by the backend.
- Database transactions help prevent partially committed booking operations.
- Production deployments should use least-privilege permissions and secure secrets management.

## 🧪 Testing

Recommended test coverage includes:

- Registration and login validation.
- Event and seat API responses.
- Unauthorized booking requests.
- Simultaneous requests for the same seat.
- Expiration and release of held seats.
- Kafka producer and consumer failure handling.
- Duplicate payment verification requests.
- End-to-end booking with a payment sandbox or mock provider.

## ⚙️ DevOps Roadmap

The following capabilities are planned or in progress and should be marked complete only after implementation and testing.

- [ ] Push the project to GitHub.
- [ ] Automate builds and tests using Jenkins.
- [ ] Build and publish versioned Docker images.
- [ ] Deploy application services to Kubernetes.
- [ ] Configure Argo CD for GitOps-based delivery.
- [ ] Evaluate AWS hosting options and free-tier eligibility.
- [ ] Add HTTPS, monitoring, logging, and alerting.
- [ ] Add automated integration and concurrency tests.
- [ ] Document backup, restore, and recovery procedures.

## 🔮 Future Improvements

- Transactional outbox for reliable Kafka event publication.
- Idempotent payment processing and event consumers.
- Explicit booking-state transition rules.
- Improved automated test coverage.
- Centralized logs, metrics, and distributed tracing.
- Kubernetes readiness and liveness probes.
- CI security scanning and dependency updates.
- Production-grade secret management and backup policies.

## 🎯 Project Goals

TicketFlow demonstrates practical backend engineering concepts, including REST APIs, authentication, relational data modeling, transactions, distributed locking, asynchronous messaging, and containerized services.

Its planned DevOps extension focuses on repeatable builds, automated testing, Kubernetes orchestration, GitOps deployment, and cloud infrastructure.

## 👩‍💻 Author

**Mugdha**

GitHub: <YOUR_GITHUB_PROFILE_URL>

---

*Built as a learning project focused on backend engineering, distributed systems, and DevOps.*
