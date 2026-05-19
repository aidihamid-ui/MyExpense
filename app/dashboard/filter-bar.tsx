'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Category {
  id: string;
  name: string;
}

interface FilterBarProps {
  initialFrom: string;
  initialTo: string;
  initialCategoryId: string;
  categories: Category[];
  defaultFrom: string;
  defaultTo: string;
}

export default function FilterBar({
  initialFrom,
  initialTo,
  initialCategoryId,
  categories,
  defaultFrom,
  defaultTo,
}: FilterBarProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [categoryId, setCategoryId] = useState(initialCategoryId || 'all');

  function apply() {
    const params = new URLSearchParams({ from, to });
    if (categoryId !== 'all') params.set('categoryId', categoryId);
    router.push(`/dashboard?${params.toString()}`);
  }

  function reset() {
    setFrom(defaultFrom);
    setTo(defaultTo);
    setCategoryId('all');
    router.push('/dashboard');
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-wrap items-end gap-3 pt-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          {/* Controlled Select (no name prop) — URL-param navigation, not FormData */}
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={apply} size="sm" className="h-9">
          Apply
        </Button>
        <Button onClick={reset} variant="outline" size="sm" className="h-9">
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}
