import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Brand inks — pale icy blue (0) → deep KleanNr ink (9).
// Index 6 = Flow (#126684, interactive accent); 7 = ink container; 9 = Ink.
const brand: MantineColorsTuple = [
  '#eef4f8',
  '#d5e3ec',
  '#b4ccda',
  '#8bb0c5',
  '#6494ad',
  '#3f7a95',
  '#126684',
  '#1e4258',
  '#0a3346',
  '#012c41',
];

// Aqua — the "clean reward" accent. Index 3 = selected-chip aqua, 8 = on-aqua.
const aqua: MantineColorsTuple = [
  '#e7f7fe',
  '#cdeefc',
  '#a9e0f9',
  '#96dbfe',
  '#6cc6ec',
  '#45b2da',
  '#1f9cc6',
  '#0d87b1',
  '#05617f',
  '#033f54',
];

// Rose — the single warm note, reserved for destructive / cancelled. Used sparingly.
const rose: MantineColorsTuple = [
  '#fbeef0',
  '#f6dade',
  '#ecb7bf',
  '#e0909c',
  '#d56e7e',
  '#c95266',
  '#b23a4f',
  '#8f2c3e',
  '#6d2230',
  '#4c1922',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6 }, // Flow drives focus rings / active states
  colors: { brand, aqua, rose },

  // Soft precision: no boxy small radii anywhere.
  radius: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
  },
  defaultRadius: 'md',

  white: '#ffffff',
  black: '#1a2226',

  fontFamily: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, monospace",

  headings: {
    fontFamily: "'Manrope Variable', 'Inter Variable', sans-serif",
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2.4rem', lineHeight: '1.12', fontWeight: '800' },
      h2: { fontSize: '1.7rem', lineHeight: '1.18', fontWeight: '800' },
      h3: { fontSize: '1.3rem', lineHeight: '1.25', fontWeight: '700' },
      h4: { fontSize: '1.05rem', lineHeight: '1.3', fontWeight: '700' },
    },
  },

  // The signature 135° ink gradient (DESIGN.md §2).
  defaultGradient: { from: 'brand.9', to: 'brand.7', deg: 135 },

  cursorType: 'pointer',

  components: {
    Button: { defaultProps: { radius: 'xl' } },
    ActionIcon: { defaultProps: { radius: 'xl' } },
    Paper: { defaultProps: { radius: 'xl' } },
    Card: { defaultProps: { radius: 'xl' } },
    TextInput: { defaultProps: { radius: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    Badge: { defaultProps: { radius: 'xl' } },
  },
});
