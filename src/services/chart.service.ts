import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { ChartConfiguration } from "chart.js";
import { WeightEntry } from "../db/queries";
import { formatDate } from "../utils/format";

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
  const datasets = Array.from(userEntries.entries()).map(([name, data]) => {
    const color = colors[colorIdx % colors.length];
    colorIdx++;
    return {
      label: name,
      data: data.map((d) => ({ x: d.x.getTime(), y: d.y })),
      borderColor: color,
      backgroundColor: color + "20",
      fill: false,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  const configuration: ChartConfiguration = {
    type: "line",
    data: { datasets: datasets as any },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Gewichtsverlauf",
          font: { size: 18 },
        },
        legend: { display: userEntries.size > 1 },
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

  for (const [name, data] of userEntries.entries()) {
    if (data.length === 0) continue;
    const baseline = data[0].y;
    const color = colors[colorIdx % colors.length];
    colorIdx++;

    datasetsKg.push({
      label: `${name} (kg)`,
      data: data.map((d) => ({ x: d.x.getTime(), y: +(d.y - baseline).toFixed(2) })),
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
  }

  const configuration: ChartConfiguration = {
    type: "line",
    data: { datasets: [...datasetsKg, ...datasetsPct] as any },
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
