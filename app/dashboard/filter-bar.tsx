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
      <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Dari</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 w-full sm:w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Hingga</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 w-full sm:w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Kategori</label>
          {/* Controlled Select (no name prop) — URL-param navigation, not FormData */}
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-11 w-full sm:w-44">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3 sm:contents">
          <Button onClick={apply} className="h-11 flex-1 sm:flex-none">
            Papar
          </Button>
          <Button onClick={reset} variant="outline" className="h-11 flex-1 sm:flex-none">
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
