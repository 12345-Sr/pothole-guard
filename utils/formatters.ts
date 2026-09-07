export function formatDate(isoString?: string): string {
  if (!isoString) return 'Just now';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Recently';
  }
}

export function formatSpeed(speedKmh?: number): string {
  if (speedKmh === undefined || speedKmh === null || isNaN(speedKmh) || speedKmh < 0) {
    return '0 km/h';
  }
  return `${Math.round(speedKmh)} km/h`;
}

export function formatAccuracy(accuracyMeters?: number): string {
  if (accuracyMeters === undefined || accuracyMeters === null || isNaN(accuracyMeters)) {
    return 'GPS ±?';
  }
  return `GPS ±${Math.round(accuracyMeters)}m`;
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
