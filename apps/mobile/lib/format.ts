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

export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 MB";
  }

  const megabytes = bytes / (1024 * 1024);

  if (megabytes < 0.1) {
    return "<0.1 MB";
  }

  return `${megabytes.toFixed(1)} MB`;
}
