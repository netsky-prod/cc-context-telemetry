export interface TokenEstimator {
  count(text: string): number;
}

export class ApproximateTokenEstimator implements TokenEstimator {
  count(text: string): number {
    if (text.length === 0) {
      return 0;
    }

    const words = text.trim().match(/\S+/g)?.length ?? 0;
    const charEstimate = Math.ceil(text.length / 4);
    return Math.max(1, words, charEstimate);
  }
}

export function preview(text: string, maxLength = 140): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1))}…`;
}
