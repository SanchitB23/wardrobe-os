/**
 * Layout + spacing tokens. The raw scale is Tailwind's 4px step; these named
 * constants capture the app's recurring compositions so pages stay consistent.
 */

/** Page container: centered, max width, responsive horizontal + vertical padding. */
export const PAGE_CONTAINER =
  "mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8";

/** Wide page container for data-dense views (inventory, import, review). */
export const WIDE_PAGE_CONTAINER =
  "mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-8 lg:px-8 lg:py-10";

/** Vertical rhythm between stacked sections. */
export const SECTION_GAP = "space-y-6";

/** Standard grid for summary/stat tiles. */
export const STAT_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/**
 * Motion: keep transitions small and purposeful. Use these instead of ad-hoc
 * durations so animation feels consistent and never excessive.
 */
export const TRANSITION_COLORS = "transition-colors";
export const TRANSITION_OPACITY = "transition-opacity";
