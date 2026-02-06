import { createTheme, MantineColorsTuple } from "@mantine/core";

/**
 * Carbon to Sea Initiative Brand Colors
 * Based on Brand Guidelines - May 2023
 */
export const brandColors = {
  // Primary dark color - used for text, logos, headings
  hadal: "#162326",
  // CTA/accent color - buttons, highlights
  coral: "#EE5919",
  // Light backgrounds
  white: "#FFFFFF",
  shell: "#F6F6F5",
  sand: "#F2EEEB",
  sunlight: "#E8EDEE",
  // Mid-tones
  twilight: "#C1CCCF",
  midnight: "#7C9298",
  // Darker accents
  abyssal: "#4F656A",
} as const;

/**
 * Data Visualization Palette
 * For charts, graphs, progress indicators, and categorical distinctions
 */
export const dataVizColors = {
  // Progress/status colors (using CtS brand darker shades)
  progressOrange: "#EE5919",  // Same as coral - poor/warning
  progressBlue: "#76A3AB",    // Medium/in-progress (darker CtS shade)
  progressGreen: "#A3BC8A",   // Good/complete (darker CtS shade)

  // Qualitative/categorical colors from brand guidelines
  ocean: "#005967",           // Deep teal - used for links

  // Extended palette for charts
  teal: "#81C7D0",
  mint: "#BFE69F",
  peach: "#FFCDBA",
  lavender: "#C4B8D0",
  gold: "#E5C76B",
  rose: "#E5A3A3",
} as const;

/**
 * All colors combined for easy access
 */
export const colors = {
  ...brandColors,
  ...dataVizColors,
} as const;

// Mantine requires color tuples (10 shades) for primaryColor
// Creating a custom "hadal" color scale based on the brand color
const hadalColors: MantineColorsTuple = [
  "#E8EDEE", // 0 - Sunlight (lightest)
  "#C1CCCF", // 1 - Twilight
  "#A7BEC5", // 2
  "#8EA5AC", // 3
  "#7C9298", // 4 - Midnight
  "#5A6D73", // 5
  "#4F656A", // 6 - Abyssal
  "#35494E", // 7
  "#2E3C40", // 8
  "#162326", // 9 - Hadal (darkest/primary)
];

// Coral accent color scale
const coralColors: MantineColorsTuple = [
  "#FFF5F0", // 0
  "#FFCDBA", // 1
  "#FF9069", // 2
  "#FF7847", // 3
  "#EE5919", // 4 - Primary coral
  "#D9480F", // 5
  "#C94B15", // 6
  "#B03D0C", // 7
  "#8A2F09", // 8
  "#6B2507", // 9
];

// Midnight color scale (blue-grey neutral)
const midnightColors: MantineColorsTuple = [
  "#F0F4F5", // 0
  "#D9E2E5", // 1
  "#B8C8CC", // 2
  "#9AB0B6", // 3
  "#7C9298", // 4 - Primary midnight
  "#6B8086", // 5
  "#5A6D73", // 6
  "#4A5B60", // 7
  "#3A494D", // 8
  "#2A373A", // 9
];

// Abyssal color scale (darker blue-grey for buttons)
const abyssalColors: MantineColorsTuple = [
  "#E8EDEE", // 0
  "#C1CCCF", // 1
  "#9AB0B6", // 2
  "#7C9298", // 3
  "#6B8086", // 4
  "#5A6D73", // 5
  "#4F656A", // 6 - Primary abyssal
  "#435558", // 7
  "#374547", // 8
  "#2B3536", // 9
];

// Progress colors for completion indicators
const progressOrangeColors: MantineColorsTuple = [
  "#FFF5F0", // 0
  "#FFCDBA", // 1
  "#FF9069", // 2
  "#FF7847", // 3
  "#EE5919", // 4 - Primary
  "#D9480F", // 5
  "#C94B15", // 6
  "#B03D0C", // 7
  "#8A2F09", // 8
  "#6B2507", // 9
];

const progressBlueColors: MantineColorsTuple = [
  "#E8F2F4", // 0
  "#C8DEE2", // 1
  "#A8CACF", // 2
  "#8FB7BD", // 3
  "#76A3AB", // 4 - Primary (CtS brand)
  "#638D94", // 5
  "#50777D", // 6
  "#3D6166", // 7
  "#2A4B4F", // 8
  "#173538", // 9
];

const progressGreenColors: MantineColorsTuple = [
  "#F2F5EE", // 0
  "#DDE5D4", // 1
  "#C8D5BA", // 2
  "#B3C5A0", // 3
  "#A3BC8A", // 4 - Primary (CtS brand)
  "#8DA876", // 5
  "#779462", // 6
  "#61804E", // 7
  "#4B6C3A", // 8
  "#355826", // 9
];

export const theme = createTheme({
  // Use Abyssal as the primary color for buttons
  primaryColor: "abyssal",
  primaryShade: 6,

  // Custom colors
  colors: {
    hadal: hadalColors,
    coral: coralColors,
    midnight: midnightColors,
    abyssal: abyssalColors,
    progressOrange: progressOrangeColors,
    progressBlue: progressBlueColors,
    progressGreen: progressGreenColors,
  },

  // Typography - using Google Fonts
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", monospace',

  // Headings use Newsreader (serif display font)
  headings: {
    fontFamily: '"Newsreader", Georgia, "Times New Roman", serif',
    fontWeight: "500",
    sizes: {
      h1: { fontSize: "2.5rem", lineHeight: "1.2" },
      h2: { fontSize: "2rem", lineHeight: "1.25" },
      h3: { fontSize: "1.5rem", lineHeight: "1.3" },
      h4: { fontSize: "1.25rem", lineHeight: "1.35" },
      h5: { fontSize: "1.125rem", lineHeight: "1.4" },
      h6: { fontSize: "1rem", lineHeight: "1.5" },
    },
  },

  // Default border radius - slightly larger for softer appearance
  radius: {
    xs: "0.25rem",
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  },
  defaultRadius: "md",

  // Spacing scale
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },

  // Component-specific overrides
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        root: {
          fontWeight: 500,
        },
      },
    },

    Card: {
      defaultProps: {
        radius: "md",
      },
    },

    Input: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        input: {
          backgroundColor: "var(--background)",
        },
      },
    },

    TextInput: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        input: {
          backgroundColor: "var(--background)",
        },
      },
    },

    Select: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        input: {
          backgroundColor: "var(--background)",
        },
      },
    },

    Textarea: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        input: {
          backgroundColor: "var(--background)",
        },
      },
    },

    NumberInput: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        input: {
          backgroundColor: "var(--background)",
        },
      },
    },

    Badge: {
      defaultProps: {
        radius: "md",
      },
    },

    Pill: {
      styles: {
        root: {
          backgroundColor: brandColors.twilight,
          color: brandColors.hadal,
        },
      },
    },

    // Title component styling
    Title: {
      styles: {
        root: {
          color: brandColors.hadal,
        },
      },
    },

    // Anchor styling with ocean (qualitative categorical) color
    Anchor: {
      styles: {
        root: {
          color: dataVizColors.ocean,
          "&:hover": {
            color: "#004451",  // Darker shade on hover
          },
        },
      },
    },
  },

  // Other theme properties
  white: brandColors.white,
  black: brandColors.hadal,

  // Shadows with slightly cooler tones
  shadows: {
    xs: "0 1px 2px rgba(22, 35, 38, 0.05)",
    sm: "0 1px 3px rgba(22, 35, 38, 0.1), 0 1px 2px rgba(22, 35, 38, 0.06)",
    md: "0 4px 6px rgba(22, 35, 38, 0.1), 0 2px 4px rgba(22, 35, 38, 0.06)",
    lg: "0 10px 15px rgba(22, 35, 38, 0.1), 0 4px 6px rgba(22, 35, 38, 0.05)",
    xl: "0 20px 25px rgba(22, 35, 38, 0.1), 0 10px 10px rgba(22, 35, 38, 0.04)",
  },
});

// CSS variable mapping for use outside Mantine components
export const cssVars = {
  // Brand colors
  "--brand-hadal": brandColors.hadal,
  "--brand-coral": brandColors.coral,
  "--brand-white": brandColors.white,
  "--brand-shell": brandColors.shell,
  "--brand-sand": brandColors.sand,
  "--brand-sunlight": brandColors.sunlight,
  "--brand-twilight": brandColors.twilight,
  "--brand-midnight": brandColors.midnight,
  "--brand-abyssal": brandColors.abyssal,
  // Data visualization colors
  "--progress-orange": dataVizColors.progressOrange,
  "--progress-blue": dataVizColors.progressBlue,
  "--progress-green": dataVizColors.progressGreen,
  "--viz-ocean": dataVizColors.ocean,
  "--viz-teal": dataVizColors.teal,
  "--viz-mint": dataVizColors.mint,
  "--viz-peach": dataVizColors.peach,
  "--viz-lavender": dataVizColors.lavender,
  "--viz-gold": dataVizColors.gold,
  "--viz-rose": dataVizColors.rose,
} as const;
