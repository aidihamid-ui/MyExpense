'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAccountAction } from '@/lib/actions/settings';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setTyped('');
    setError('');
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteAccountAction();
      if (!result) return;
      if (result.ok) {
        await authClient.signOut();
        router.push('/login');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Padam akaun kau kekal, termasuk semua belanja, resit, dan kategori. Tak boleh patah balik.
      </p>
      <Button variant="destructive" onClick={handleOpen}>
        Padam akaun
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Padam akaun</DialogTitle>
            <DialogDescription>
              Semua data kau akan dipadam kekal. Tak boleh undo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Taip <strong className="text-foreground">PADAM</strong> untuk sahkan.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="PADAM"
              disabled={isPending}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={typed !== 'PADAM' || isPending}
            >
              {isPending ? 'Tengah padam…' : 'Padam akaun saya'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}