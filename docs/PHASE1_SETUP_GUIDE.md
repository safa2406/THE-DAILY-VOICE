# The Daily Voice — Phase 1 Architecture & Setup Guide

## 1. Overview
The Daily Voice is an accessible newspaper-to-audiobook platform converting printed newspapers and periodicals into narrated audiobooks. Phase 1 establishes the verified foundation across:
- **Frontend**: React 19 + Vite + Tailwind CSS + React Router + Lucide React
- **Backend**: Python 3.13 + Flask application factory + SQLAlchemy 2.0 + Alembic + Flask-CORS
- **Database, Auth & Storage**: Supabase PostgreSQL + Supabase Auth (JWT) + Supabase Storage

---

## 2. Security Architecture & RLS (Row Level Security)

### 2.1 Backend Token Validation Strategy
- The backend never trusts client identity claims blindly.
- Every protected endpoint requires a Bearer JWT passed via the `Authorization` header.
- The JWT is verified using `PyJWT` against `SUPABASE_JWT_SECRET` using HMAC-SHA256 (`HS256`).
- Expiration (`exp`) and identity (`sub`) claims are strictly enforced.

### 2.2 Key Isolation
- `SUPABASE_ANON_KEY`: Safe for client-side / frontend consumption. Embedded in Vite bundle.
- `SUPABASE_SERVICE_ROLE_KEY`: Strictly restricted to trusted backend worker processes. **NEVER** exposed to frontend.
- `SUPABASE_JWT_SECRET`: Backend only.

### 2.3 Supabase Row Level Security (RLS) Schema
When running against Supabase PostgreSQL, RLS policies must be applied on the `users` table:

```sql
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid()::text = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid()::text = id);

-- Policy 3: Service role full access for backend worker processes
CREATE POLICY "Service role full access"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

---

## 3. Storage Buckets
Supabase Storage buckets required for upcoming phases:
- `audiobooks`: Storage for generated audiobook MP3/M4A segments.
- `newspapers`: Storage for uploaded newspaper PDF issues and page images.
