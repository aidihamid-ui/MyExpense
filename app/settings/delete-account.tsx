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
        Permanently deletes your account, all expenses, receipts, and categories. This cannot be
        undone.
      </p>
      <Button variant="destructive" onClick={handleOpen}>
        Delete account
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              All your data will be permanently deleted. This action cannot be reversed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Type <strong className="text-foreground">DELETE</strong> to confirm.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
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
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={typed !== 'DELETE' || isPending}
            >
              {isPending ? 'Deleting…' : 'Delete my account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
