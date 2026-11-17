# The Daily Voice

> Newspaper-to-Audiobook Platform — Phase 1: Project Scaffolding, Environment Setup & Connectivity

---

## Architecture Overview

- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router v7, Lucide React
- **Backend**: Python 3.13, Flask (Application Factory), SQLAlchemy 2.0, Alembic (Flask-Migrate), Flask-CORS, PyJWT
- **Database & Auth**: Supabase PostgreSQL, Supabase Auth (HS256 JWT validation), Supabase Storage

---

## Directory Structure

```
dailyVoice/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   ├── .env.example
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── health.py
│   │   │   └── auth.py
│   │   ├── models/
│   │   │   ├── base.py
│   │   │   └── user.py
│   │   ├── services/
│   │   │   └── supabase_client.py
│   │   ├── middleware/
│   │   │   └── auth.py
│   │   └── config/
│   │       └── config.py
│   ├── migrations/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_health.py
│   │   ├── test_config.py
│   │   ├── test_auth_middleware.py
│   │   └── test_db.py
│   ├── run.py
│   ├── requirements.txt
│   └── .env.example
│
├── docs/
│   └── PHASE1_SETUP_GUIDE.md
│
├── .gitignore
└── README.md
```

---

## Setup & Running Instructions

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux / macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
# Edit .env with your Supabase credentials

# Initialize database migrations (if first time)
flask db init
flask db migrate -m "Initial schema: users table"
flask db upgrade

# Run Flask backend server
python run.py
```
Backend will be available at `http://127.0.0.1:5000` with health check at `http://127.0.0.1:5000/api/health`.

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Configure environment variables
copy .env.example .env

# Run development server
npm run dev
```
Frontend will be available at `http://localhost:5173`.

---

### 3. Running Backend Automated Tests

```bash
cd backend
.venv\Scripts\pytest -v
```
