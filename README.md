# Online Teaching Academy Management & Learning Platform

A multi-tenant management and learning platform for online teaching academies — handling
admissions, classes, attendance, assignments, quizzes, fees/payments, staff payouts, and
parent/student communication in one system.

Built as a **FastAPI** backend + **React (Vite + TypeScript)** frontend, with role-based
dashboards for **Admin**, **Teacher**, **Student**, and **Parent** users.

## Features

- **Multi-tenancy** — each academy (tenant) has isolated data, users, and settings.
- **Role-based access** — Admin, Teacher, Student, and Parent roles with dedicated dashboards.
- **Academics** — academic years, classes, courses, schedules, assignments, quizzes, and
  progress tracking.
- **Attendance** — student attendance and HR (staff) attendance.
- **Families & admissions** — parent/family linking and student admission records.
- **Fees & payments** — fee management with **JazzCash** payment gateway integration.
- **Staff payouts** — teacher/staff payout tracking.
- **Notifications** — email, **WhatsApp Business Cloud API**, and **Twilio SMS** notifications.
- **Video classes** — **Jitsi Meet** integration and **Google Calendar / Google Meet** link
  generation for scheduled classes.
- **Resource sharing** — file uploads and downloadable learning resources.
- **Reports** — PDF report generation (ReportLab) and Excel export (openpyxl).

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) (Python), [SQLAlchemy](https://www.sqlalchemy.org/) 2.0, [Alembic](https://alembic.sqlalchemy.org/) migrations
- SQLite (dev) / PostgreSQL via `psycopg` (production)
- JWT auth (`python-jose`), password hashing (`passlib` + `bcrypt`)
- Rate limiting (`slowapi`), scheduled jobs (`APScheduler`)
- Pytest + httpx for testing

**Frontend**
- [React 19](https://react.dev/) + TypeScript + [Vite](https://vitejs.dev/)
- [MUI](https://mui.com/) (Material UI) component library
- [React Query](https://tanstack.com/query/latest) for server state
- React Router, React Hook Form + Zod validation, Recharts, Axios

## Project Structure

```
managemt/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── api/v1/     # API routes (endpoints per resource)
│   │   ├── core/       # config, security, rate limiting, scheduler
│   │   ├── db/         # database session/base
│   │   ├── models/     # SQLAlchemy models
│   │   ├── repositories/
│   │   ├── schemas/    # Pydantic schemas
│   │   └── services/   # business logic (email, WhatsApp, payments, etc.)
│   ├── alembic/        # database migrations
│   ├── tests/          # pytest test suite
│   ├── requirements.txt
│   └── .env.example
└── frontend/           # React + Vite application
    ├── src/
    │   ├── api/         # API client
    │   ├── auth/         # auth context/hooks
    │   ├── features/     # admin / teacher / student / parent feature modules
    │   ├── pages/
    │   └── routes/
    └── .env.example
```

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- (Optional, for production) PostgreSQL

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd managemt
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
```

Edit `backend/.env` and fill in the values you need (see
[Environment Variables](#environment-variables) below). At minimum, set a strong `JWT_SECRET`.

Run database migrations, then start the API:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs` and a health check at `http://localhost:8000/health`.

### 3. Frontend setup

```bash
cd frontend
npm install

copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux

npm run dev
```

The app will be available at `http://localhost:5173`.

### 4. Run backend tests

```bash
cd backend
pytest
```

## Environment Variables

Each app has its own `.env.example` listing every variable it reads — **copy it to `.env` and
fill in real values**; never commit `.env` (it's already git-ignored).

### `backend/.env.example`

| Variable | Description |
|---|---|
| `APP_NAME`, `ENVIRONMENT` | App metadata |
| `DATABASE_URL` | SQLite for dev, PostgreSQL for production |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_ACCESS_EXPIRE_MINUTES`, `JWT_REFRESH_EXPIRE_DAYS` | Auth token settings — **generate a long random `JWT_SECRET`** |
| `CORS_ORIGINS` | Allowed frontend origins |
| `FRONTEND_URL` | Used to build links in emails |
| `REQUIRE_EMAIL_VERIFICATION` | Enforce email verification at login |
| `SMTP_*` | Outgoing email (verification/reset emails) |
| `WHATSAPP_*` | Meta WhatsApp Business Cloud API credentials for notifications |
| `JAZZCASH_*` | JazzCash payment gateway (merchant credentials, checkout/inquiry URLs) |
| `TWILIO_*` | Twilio SMS credentials |
| `JITSI_*` | Jitsi Meet video class configuration |
| `GOOGLE_*` | Google Calendar OAuth app (for Google Meet link generation) |

### `frontend/.env.example`

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API (e.g. `http://localhost:8000/api/v1`) |

All third-party integrations (SMTP, WhatsApp, JazzCash, Twilio, Jitsi, Google Calendar) are
**optional** — the app runs without them, but the related features will be disabled/inactive
until configured.

## Keeping secrets out of GitHub

This repo's `.gitignore` files (root, `backend/`, `frontend/`) already exclude `.env` and any
`.env.*` file except `.env.example`, along with virtual environments, databases (`*.db`),
`node_modules`, and build output. Only the `.env.example` templates (with placeholder values)
are meant to be committed.

## License

Add a license of your choice (e.g. MIT) before making this repository public.
