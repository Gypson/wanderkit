export function formatDisplayTimestamp(
  value: string | null | undefined
): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  });
}

export function formatShortContentHash(value: string): string {
  return value.length > 10 ? value.slice(0, 10) : value;
}
