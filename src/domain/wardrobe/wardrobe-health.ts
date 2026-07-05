export type WardrobeHealthStatus = {
  connected: boolean;
  rlsBlocking: boolean;
  errorMessage: string | null;
  styles: { name: string }[] | null;
};

export function interpretStylesHealthCheck(
  styles: readonly { name: string }[] | null,
  error: Error | null,
): WardrobeHealthStatus {
  if (error) {
    return {
      connected: false,
      rlsBlocking: false,
      errorMessage: error.message,
      styles: null,
    };
  }

  const resolvedStyles = styles ?? [];

  return {
    connected: true,
    rlsBlocking: resolvedStyles.length === 0,
    errorMessage: null,
    styles: [...resolvedStyles],
  };
}
