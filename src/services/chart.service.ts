import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { ChartConfiguration } from "chart.js";
import { WeightEntry } from "../db/queries";
import { formatDate } from "../utils/format";
import { linearRegression } from "../utils/math";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const chartCanvas = new ChartJSNodeCanvas({
  width: 800,
  height: 400,
  backgroundColour: "white",
});

export type ChartMode = "absolute" | "relative";

export async function generateWeightChart(
  entries: WeightEntry[],
  mode: ChartMode = "absolute"
): Promise<Buffer> {
  // Group entries by user
  const userEntries = new Map<string, { x: Date; y: number }[]>();
  for (const entry of entries) {
    const name = entry.display_name;
    if (!userEntries.has(name)) userEntries.set(name, []);
    userEntries.get(name)!.push({
      x: new Date(entry.recorded_at),
      y: Number(entry.weight_kg),
    });
  }

  const colors = ["#4CAF50", "#2196F3", "#FF9800", "#E91E63", "#9C27B0"];
  let colorIdx = 0;

  if (mode === "absolute") {
    return renderAbsoluteChart(userEntries, colors);
  } else {
    return renderRelativeChart(userEntries, colors);
  }
}

async function renderAbsoluteChart(
  userEntries: Map<string, { x: Date; y: number }[]>,
  colors: string[]
): Promise<Buffer> {
  let colorIdx = 0;
  const datasets: any[] = [];
  const trendDatasets: any[] = [];

  for (const [name, data] of userEntries.entries()) {
    const color = colors[colorIdx % colors.length];
    colorIdx++;
    const points = data.map((d) => ({ x: d.x.getTime(), y: d.y }));

    datasets.push({
      label: name,
      data: points,
      borderColor: color,
      backgroundColor: color + "20",
      fill: false,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
    });

    if (data.length >= 2) {
      const reg = linearRegression(points);
      if (reg) {
        const slopePerDay = reg.slope * MS_PER_DAY;
        const xStart = points[0].x;
        const xEnd = points[points.length - 1].x;
        trendDatasets.push({
          label: `${name} Trend (${slopePerDay >= 0 ? "+" : ""}${slopePerDay.toFixed(3)} kg/Tag)`,
          data: [
            { x: xStart, y: reg.slope * xStart + reg.intercept },
            { x: xEnd, y: reg.slope * xEnd + reg.intercept },
          ],
          borderColor: color,
          backgroundColor: "transparent",
          borderDash: [10, 5],
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
        });
      }
    }
  }

  const configuration: ChartConfiguration = {
    type: "line",
    data: { datasets: [...datasets, ...trendDatasets] as any },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Gewichtsverlauf",
          font: { size: 18 },
        },
        legend: { display: userEntries.size > 1 || trendDatasets.length > 0 },
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Datum" },
          ticks: {
            callback: (value: any) => formatDate(new Date(value)),
            maxTicksLimit: 10,
          },
        },
        y: {
          title: { display: true, text: "Gewicht (kg)" },
          ticks: {
            callback: (value: any) => `${value} kg`,
          },
        },
      },
    },
  };

  return chartCanvas.renderToBuffer(configuration);
}

async function renderRelativeChart(
  userEntries: Map<string, { x: Date; y: number }[]>,
  colors: string[]
): Promise<Buffer> {
  let colorIdx = 0;
  const datasetsKg: any[] = [];
  const datasetsPct: any[] = [];
  const datasetsTrend: any[] = [];

  for (const [name, data] of userEntries.entries()) {
    if (data.length === 0) continue;
    const baseline = data[0].y;
    const color = colors[colorIdx % colors.length];
    colorIdx++;

    const deltaKgPoints = data.map((d) => ({
      x: d.x.getTime(),
      y: +(d.y - baseline).toFixed(2),
    }));

    datasetsKg.push({
      label: `${name} (kg)`,
      data: deltaKgPoints,
      borderColor: color,
      backgroundColor: color + "20",
      fill: false,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      yAxisID: "yKg",
    });

    datasetsPct.push({
      label: `${name} (%)`,
      data: data.map((d) => ({
        x: d.x.getTime(),
        y: +(((d.y - baseline) / baseline) * 100).toFixed(2),
      })),
      borderColor: color,
      backgroundColor: "transparent",
      borderDash: [5, 5],
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      yAxisID: "yPct",
    });

    if (data.length >= 2) {
      const reg = linearRegression(deltaKgPoints);
      if (reg) {
        const slopePerDay = reg.slope * MS_PER_DAY;
        const xStart = deltaKgPoints[0].x;
        const xEnd = deltaKgPoints[deltaKgPoints.length - 1].x;
        datasetsTrend.push({
          label: `${name} Trend (${slopePerDay >= 0 ? "+" : ""}${slopePerDay.toFixed(3)} kg/Tag)`,
          data: [
            { x: xStart, y: reg.slope * xStart + reg.intercept },
            { x: xEnd, y: reg.slope * xEnd + reg.intercept },
          ],
          borderColor: color,
          backgroundColor: "transparent",
          borderDash: [10, 5],
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          yAxisID: "yKg",
        });
      }
    }
  }

  const configuration: ChartConfiguration = {
    type: "line",
    data: { datasets: [...datasetsKg, ...datasetsTrend, ...datasetsPct] as any },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Veränderung zum Startwert",
          font: { size: 18 },
        },
        legend: { display: true },
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Datum" },
          ticks: {
            callback: (value: any) => formatDate(new Date(value)),
            maxTicksLimit: 10,
          },
        },
        yKg: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Δ kg" },
          ticks: {
            callback: (value: any) => `${value > 0 ? "+" : ""}${value} kg`,
          },
        },
        yPct: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Δ %" },
          ticks: {
            callback: (value: any) => `${value > 0 ? "+" : ""}${value}%`,
          },
          grid: { drawOnChartArea: false },
        },
      },
    },
  };

  return chartCanvas.renderToBuffer(configuration);
}
