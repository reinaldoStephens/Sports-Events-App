---
name: Astro Development Skill
description: Guidelines and standards for developing with Astro in the Sports Events App.
---

# Astro Development Guidelines

This skill defines the standards for developing features using Astro in this project.

## Core Architecture

### Hybrid Rendering
- **Public Pages** (`/`, `/calendario`, `/tabla`): Use **SSG** (Static Site Generation) where possible for performance.
    - `export const prerender = true;` (unless real-time data is strictly required).
- **Admin Pages** (`/admin/*`): Use **SSR** (Server-Side Rendering).
    - `output: 'server'` is configured globally, so ensure public pages explicitly opt-in to prerendering if needed/applicable.

### Framework Integration (React)
- Use **React** for highly interactive islands (complex forms, dynamic dashboards).
- Prefer **Astro** (.astro) components for static layout, content, and simple interactivity.
- When using React, always specify a client directive (e.g., `client:load`, `client:visible`) unless it's static HTML generation only.


### Middleware & Authentication
- All session validation happens in `src/middleware.ts`.
- **Private Routes**: Any access to `/admin/*` must check for an active Supabase session. Redirect to `/login` if missing.
- **Role Validation**: Ensure the user has the 'admin' or 'delegado' role for restricted areas.

## Component Development
- **Images**: ALWAYS use the native `<Image />` component from `astro:assets` for localized images or remote images (with proper configuration).
    ```astro
    import { Image } from 'astro:assets';
    // ...
    <Image src={myImage} alt="Description" />
    ```
- **Reuse**: Check `src/components` before building new UI elements.

## Data Fetching & Mutations
- **Reads**: Can be done in the component frontmatter (`---`) using Supabase client.
- **Writes**: MUST be done using **Astro Actions** (`src/actions/index.ts`).
    - **NO** direct client-side writes to Supabase.
    - Forms should use methods that bind to Actions.
    - Handle Action results (success/error) to show `ToastNotification`.

## State Management
- Use **Nano Stores** for global client-side state (e.g., active filters, shared UI state).
    ```typescript
    // src/stores/myStore.ts
    import { atom } from 'nanostores';
    export const isOpen = atom(false);
    ```

## Type Safety
- Strict TypeScript is enforced.
- Do not use `any`.
- Import types from `src/types/supabase.ts` (Database definitions).
