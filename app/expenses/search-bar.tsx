'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

export default function SearchBar({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (next.trim()) params.set('q', next.trim());
      router.push(`/expenses?${params.toString()}`);
    }, 300);
  }

  return (
    <Input
      type="search"
      placeholder="Cari nota…"
      value={value}
      onChange={handleChange}
      className="h-11 max-w-sm"
    />
  );
}
