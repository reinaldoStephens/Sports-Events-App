---
name: Vercel Deployment Skill
description: Guidelines for deployment to Vercel.
---

# Vercel Deployment Guidelines

This skill ensures smooth deployments to the Vercel platform.

## Pre-Deployment Checks
Before pushing to production or opening a PR, run the local build command to catch errors that `npm run dev` might miss.
- **Command**: `npm run build`
- **Output**: Ensure there are no errors in the build log.

## Environment Variables
- Ensure all new secrets (Supabase keys, API tokens) are added to the Vercel Project Settings > Environment Variables.
- **Structure**:
    - `PUBLIC_SUPABASE_URL`
    - `PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (Only if strictly needed for specific admin actions, handle with care)

## Configuration
- **Adapter**: Ensure `@astrojs/vercel/serverless` is configured in `astro.config.mjs` if using SSR.
- **Node Version**: Check compatibility if adding new Node.js specific libraries.

## Troubleshooting
- **500 Errors**: Check the Vercel Function Logs.
- **Missing Styles**: Ensure `tailwind.config.mjs` content paths include all new file types (e.g., if you added a new folder).
