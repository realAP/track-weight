export interface LinearRegressionResult {
  slope: number;
  intercept: number;
}

export function linearRegression(
  points: { x: number; y: number }[]
): LinearRegressionResult | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const xMean = sumX / n;
  const yMean = sumY / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    const dx = p.x - xMean;
    num += dx * (p.y - yMean);
    den += dx * dx;
  }

  if (den === 0) return null;

  const slope = num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}
