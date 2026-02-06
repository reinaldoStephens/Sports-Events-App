---
name: React Development Skill
description: Guidelines for using React within the Astro project.
---

# React Development Guidelines

Use React **ONLY** when complex interactive state management is required (e.g., dynamic forms, drag-and-drop, complex dashboards) or when a robust ecosystem library is needed (e.g., certain charts, maps).

## Core Principles

### 1. Functional Components
- Always use **Functional Components** with Hooks.
- **NO** Class Components.
- Export as named exports: `export const MyComponent = () => { ... }`

### 2. TypeScript Integration
- **Props Interface**: Always define a `Props` interface.
    ```tsx
    interface Props {
      initialData: DataType[];
      onSave: (data: DataType) => void;
    }
    export const MyComponent = ({ initialData, onSave }: Props) => { ... }
    ```
- Avoid `any`. Use strict types imported from `src/types/supabase.ts` where possible.

### 3. State Management
- **Local State**: Use `useState`, `useReducer` for isolated component state.
- **Global State**: Use **Nano Stores** (`@nanostores/react`) for sharing state between Astro components, other React components, or Svelte/Vue (if any).
    ```tsx
    import { useStore } from '@nanostores/react';
    import { isCartOpen } from '../stores/cart';

    const open = useStore(isCartOpen);
    ```

### 4. Integration with Astro (Islands)
- **Directives**: Use the appropriate client directive to hydrate the component.
    - `client:load`: For immediately interactive components (e.g., Hero headers).
    - `client:visible`: For components lower down the page (e.g., Lazy loaded charts).
    - `client:only="react"`: For components accessing browser-specific APIs (window, localStorage) that crash on SSR.
- **Slot Usage**: Avoid passing complex children patterns if possible, pass data as props.

### 5. Styling
- Use **Tailwind CSS** classes (className).
- `clsx` or `tailwind-merge` can be used for conditional classes.

### 6. Hooks
- Use custom hooks to extract logic.
- Place hooks in `src/hooks/` if reused.

## Anti-Patterns
- **Avoid** full Single Page App (SPA) routing inside React unless it's a specific "App" section. Astro handles the routing.
- **Do not** fetch data inside `useEffect` if it can be passed as initial props from the Astro server (SSR).
    - **Preferred**: `<ReactComp initialData={data} client:load />`
    - **Avoid**: Component loads -> `useEffect` -> `fetch('/api/data')` (unless it's for live updates).
