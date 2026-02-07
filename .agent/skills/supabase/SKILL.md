---
name: Supabase Development Skill
description: Guidelines for database interactions, security, and RLS in Supabase.
---

# Supabase Development Guidelines

This skill defines the rules for interacting with the Supabase backend.

## Security & Access Control
- **Row Level Security (RLS)**: **MANDATORY** for every table.
    - Default: Deny all.
    - Public Read: Enable only for public data (standings, matches).
    - Admin Write: Authenticated users with 'admin' role.
- **Storage**: Buckets must have restricted public access policies.

## Data Modeling & Queries
- **Types**: Use the generated `Database` interface.
    ```typescript
    import type { Database } from '../../types/supabase';
    type Row = Database['public']['Tables']['my_table']['Row'];
    ```
- **Filtering**:
    - **Server-Side**: Apply `.eq()`, `.order()`, `.limit()` in the query.
    - Avoid fetching all rows and filtering with JS `array.filter()`.
- **Views**: Use PostgreSQL Views for complex aggregations (e.g., `tabla_posiciones_view`).
    - Do not calculate standings/points in the application layer if a View can do it.

## Actions (Server-Side Logic)
- All critical logic (score updates, team registration) lives in `src/actions/index.ts`.
- Validate inputs using `zod` before sending to Supabase.

## Testing Migrations
- When adding tables/columns, create a `.sql` file in the root or `migrations/` folder.
- Execute SQL via the Supabase Dashboard SQL Editor or CLI.
- Run type generation script immediately after DB changes:
    - `npm run gen-types` (or equivalent command if configured)
