---
name: UI Design Skill
description: Guidelines for UI/UX, Tailwind CSS, and responsiveness.
---

# UI Design Guidelines

This skill defines the visual and interactive standards for the application.

## Styling & Tailwind CSS
- **Utility First**: Use Tailwind utility classes for 99% of styling.
- **Custom CSS**: Avoid `style` tags or `.css` files unless absolutely necessary for complex animations or legacy integration.
- **Responsiveness**:
    - **Mobile First**: Design for mobile, then add `md:`, `lg:` modifiers.
    - **Full Width**: Use `w-full` for form inputs on mobile.
- **Theme**: Stick to the defined color palette (e.g., proper primary/secondary colors in `tailwind.config.mjs`).

## UX Components
- **Notifications**:
    - **NEVER** use `alert()`.
    - **USE** `ToastNotification` component or `showToast` method from actions.
- **Confirmations**:
    - **NEVER** use `confirm()`.
    - **USE** `ConfirmationModal` component.
- **Feedback**: show success/error messages after data operations (e.g., "Team updated successfully").

## Component Best Practices
- **Clean Code**: Extract complex UI parts into smaller components (e.g., `PlayerCard.astro`, `MatchRow.astro`).
- **Props**: Type your component props with `interface Props`.
- **Loading States**: Add visual feedback (spinners, skeleton loaders) during async operations if applicable (though SSR usually handles initial load).
