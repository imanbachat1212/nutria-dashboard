# Nutri Backend

Node.js / Express / MongoDB backend for the nutrition + gym practice-management platform.

## Setup

```bash
cd backend
cp .env.example .env   # edit with your values
npm install
```

## Run

```bash
npm run dev    # development with nodemon
npm start      # production
```

## Seed

Creates permission keys, dietitian + assistant roles, and an admin user (`admin@nutri.app` / `admin123`).

```bash
npm run seed
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `SERVICE_API_KEY` | Yes | API key for automation / service-to-service auth |

| `PORT` | No | Server port (default 4000) |

## API

All routes are prefixed with `/api`. Auth routes (`/api/auth/login`) are public; everything else requires a Bearer token or `x-api-key` header.

### Health check

```
GET /health → { "status": "ok" }
```
