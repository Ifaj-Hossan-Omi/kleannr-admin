# Design System Strategy: KleanNr Digital Identity

## 1. Overview & Creative North Star
The design system for KleanNr is anchored by a Creative North Star we define as **"Atmospheric Serenity."** 

We are moving away from the "utility-first" look of standard service apps and toward a high-end editorial experience. Laundry is often a chore; this system transforms it into a premium wellness service. We achieve this through **Intentional Asymmetry**—where content isn't always perfectly centered, but balanced through weight and whitespace—and **Tonal Layering**, replacing rigid structural lines with soft, fluid transitions that mimic the movement of water and fabric.

The goal is to make the user feel as though they are interacting with a high-end lifestyle magazine. Every interaction should feel "laundered"—crisp, fresh, and meticulously organized.

---

### 2. Colors: The Palette of Fluidity
Our palette is derived from the core of the KleanNr brand: the intersection of deep-sea authority and minty freshness.

*   **Primary (`#012c41`):** The "Ink." Used for high-level branding, primary CTAs, and authoritative headings.
*   **Secondary (`#126684`):** The "Flow." Used for active states and secondary iconography.
*   **Tertiary (`#002e2e`):** The "Anchor." Used for deep-contrast accents and subtle weight in typography.
*   **Surface System:** A sophisticated range from `surface-container-lowest` (`#ffffff`) to `surface-dim` (`#d8dadb`).

#### The "No-Line" Rule
Standard UI relies on 1px borders to separate content. **In this system, solid 1px borders are prohibited.** You must define boundaries through background color shifts. For example, a card component (`surface-container-lowest`) should sit atop a section background (`surface-container-low`). The contrast is felt, not seen, creating a softer, more premium interface.

#### Signature Textures & Glassmorphism
To capture the "clean" essence, use a subtle gradient for Hero backgrounds and Primary Buttons:
*   **Primary Gradient:** From `primary` (`#012c41`) to `primary_container` (`#1e4258`) at a 135-degree angle.
*   **Glass Effects:** For floating navigation or modals, use `surface` at 80% opacity with a `24px` backdrop blur. This allows the colors of the underlying "laundry" to bleed through, maintaining a sense of transparency and trust.

---

### 3. Typography: The Editorial Voice
We use a dual-typeface system to balance character with legibility.

*   **Display & Headlines (Manrope):** This is our "Editorial" voice. Manrope’s geometric but warm curves echo the swirl of the logo. Use `display-lg` (3.5rem) with tighter letter-spacing (-0.02em) for hero headlines to create an authoritative, premium impact.
*   **Body & Utility (Inter):** The "Workhorse." Inter provides exceptional readability for service descriptions and price points.
*   **Hierarchy Tip:** Never use the same weight for a title and its supporting body text. If the title is `title-lg` (Bold), the body must be `body-md` (Regular) to ensure the eye knows exactly where to land first.

---

### 4. Elevation & Depth: Tonal Layering
We do not use shadows to create "pop"; we use depth to create "atmosphere."

*   **The Layering Principle:** Depth is achieved by "stacking" the surface tiers. 
    *   *Base:* `surface` (`#f8fafb`)
    *   *Section:* `surface-container-low` (`#f2f4f5`)
    *   *Card:* `surface-container-lowest` (`#ffffff`)
*   **Ambient Shadows:** If a floating element (like a "Book Now" FAB) requires a shadow, it must be an "Ambient Shadow." Use `on-surface` (`#191c1d`) at 4-6% opacity with a blur of `32px` and a Y-offset of `8px`. It should feel like a soft glow, not a hard drop.
*   **The "Ghost Border":** If a container is placed on an identical background color, use the `outline-variant` (`#c2c7cd`) at **15% opacity**. This creates a "suggestion" of a border that guides the eye without cluttering the visual field.

---

### 5. Components: Soft Precision
All components utilize the **Roundedness Scale** to ensure the app feels approachable and "soft" like fresh linens.

*   **Primary Buttons:** 
    *   **Shape:** `full` (9999px) for a modern, pill-shaped look. 
    *   **Style:** Primary Gradient with `on_primary` (`#ffffff`) text. 
    *   **Padding:** `spacing-3` (vertical) and `spacing-6` (horizontal).
*   **Cards:** 
    *   **Corner Radius:** `xl` (1.5rem).
    *   **Separation:** Never use dividers. Use `spacing-5` or `spacing-6` to let the content breathe.
*   **Service Selection Chips:** 
    *   **Unselected:** `surface-container-high` (`#e6e8e9`) with `on_surface_variant` text.
    *   **Selected:** `secondary_container` (`#96dbfe`) with `on_secondary_container` (`#05617f`) text.
*   **Input Fields:** 
    *   **Background:** `surface-container-lowest`. 
    *   **Interaction:** On focus, the border doesn't change color; instead, the container should shift to `surface-bright` with a 2pt `primary` ghost-border (20% opacity).
*   **Order Progress Tracker:** Use the **Accent Color** (Mint/Aqua gradient) to indicate completed stages. This provides a refreshing "reward" for the user as their laundry moves toward "Clean."

---

### 6. Do’s and Don'ts

#### Do:
*   **Embrace the White Space:** Use `spacing-10` or `spacing-12` between major sections. Generous breathing room equals premium positioning.
*   **Use Asymmetric Grids:** Offset images of clean clothes slightly to the left or right of center-aligned text to create a custom, editorial feel.
*   **Tint Your Neutrals:** Always use the `surface` tokens. Never use pure `#FFFFFF` for the entire background; keep pure white reserved for the top-level cards to make them "glow."

#### Don't:
*   **Don't Use Dividers:** If you feel the need to add a line, increase your `spacing` token by one level instead.
*   **Don't Use High-Contrast Shadows:** If the shadow looks "grey" or "black," it’s too heavy. It should look like a subtle darkening of the background color.
*   **Don't Cramp the Icons:** Use `spacing-2` or `spacing-3` as a mandatory safety zone around all iconography to maintain the "clean" aesthetic.
*   **Don't Use Default Shapes:** Avoid the `sm` (0.25rem) corner radius. It feels dated and "boxy." Stick to `lg` and `xl` for a friendly, professional touch.