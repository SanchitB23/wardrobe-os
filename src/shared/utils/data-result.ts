export function toError(message: string) {
  return new Error(message);
}

export function unwrapData<T>(result: { data: T | null; error: Error | null }): T {
  if (result.error) {
    throw result.error;
  }
  if (result.data === null) {
    throw new Error("No data returned");
  }
  return result.data;
}
