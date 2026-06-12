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
  title = 'Spending by Category',
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
            No expenses in this period
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-80"
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
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine
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
        )}
      </CardContent>
    </Card>
  );
}
