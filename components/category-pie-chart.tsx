'use client';

import { PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

interface BreakdownItem {
  categoryId: string;
  categoryName: string;
  total: number;
}

const COLORS = [
  // First 10 unchanged — existing dashboards keep their look
  'hsl(217, 91%, 60%)',
  'hsl(142, 71%, 45%)',
  'hsl(25, 95%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(345, 83%, 55%)',
  'hsl(48, 96%, 53%)',
  'hsl(187, 86%, 42%)',
  'hsl(0, 72%, 51%)',
  'hsl(200, 98%, 39%)',
  'hsl(330, 81%, 60%)',
  // Extended palette — one distinct slot per default category (22 total)
  'hsl(75, 65%, 45%)',
  'hsl(100, 55%, 42%)',
  'hsl(128, 45%, 50%)',
  'hsl(163, 70%, 40%)',
  'hsl(178, 55%, 55%)',
  'hsl(28, 70%, 42%)',
  'hsl(238, 78%, 64%)',
  'hsl(285, 60%, 58%)',
  'hsl(305, 55%, 55%)',
  'hsl(20, 90%, 68%)',
  'hsl(58, 85%, 62%)',
  'hsl(210, 30%, 60%)',
];

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface CategoryPieChartProps {
  breakdown: BreakdownItem[];
  totalAmount: number;
  title?: string;
}

export default function CategoryPieChart({
  breakdown,
  totalAmount,
  title = 'Mana Duit Pi?',
}: CategoryPieChartProps) {
  if (breakdown.length === 0) return null;

  const chartData = breakdown.map((item, i) => ({
    name: item.categoryName,
    value: item.total,
    fill: COLORS[i % COLORS.length],
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((d) => [d.name, { label: d.name, color: d.fill }])
  ) satisfies ChartConfig;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {totalAmount === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Belum belanja apa-apa bulan ni
          </p>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-72"
            >
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  innerRadius="45%"
                  paddingAngle={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatRM(Number(value))}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>

            {/* Color-key legend */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: d.fill }}
                  />
                  <span className="truncate text-muted-foreground">
                    {d.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}