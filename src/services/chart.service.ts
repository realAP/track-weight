import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { ChartConfiguration } from "chart.js";
import { WeightEntry } from "../db/queries";
import { formatDate } from "../utils/format";

const chartCanvas = new ChartJSNodeCanvas({
  width: 800,
  height: 400,
  backgroundColour: "white",
});

export async function generateWeightChart(entries: WeightEntry[]): Promise<Buffer> {
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
    data: {
      datasets: datasets as any,
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Gewichtsverlauf",
          font: { size: 18 },
        },
        legend: {
          display: userEntries.size > 1,
        },
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Datum" },
          ticks: {
            callback: function (value: any) {
              return formatDate(new Date(value));
            },
            maxTicksLimit: 10,
          },
        },
        y: {
          title: { display: true, text: "Gewicht (kg)" },
          ticks: {
            callback: function (value: any) {
              return `${value} kg`;
            },
          },
        },
      },
    },
  };

  return chartCanvas.renderToBuffer(configuration);
}
