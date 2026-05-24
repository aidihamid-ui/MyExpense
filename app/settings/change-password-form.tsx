'use client';

import { useActionState } from 'react';
import { changePasswordAction, type ChangePasswordState } from '@/lib/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChangePasswordForm() {
  const [state, dispatch, isPending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={dispatch} className="space-y-4">
      {state?.ok === false && state.general && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.general}
        </p>
      )}
      {state?.ok === true && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Password changed successfully.
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Current password
        </label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          disabled={isPending}
          className="h-11"
        />
        {state?.ok === false && state.errors?.currentPassword && (
          <p className="text-xs text-destructive">{state.errors.currentPassword[0]}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="newPassword" className="text-sm font-medium">
          New password
        </label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          disabled={isPending}
          className="h-11"
        />
        {state?.ok === false && state.errors?.newPassword && (
          <p className="text-xs text-destructive">{state.errors.newPassword[0]}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmNewPassword" className="text-sm font-medium">
          Confirm new password
        </label>
        <Input
          id="confirmNewPassword"
          name="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          disabled={isPending}
          className="h-11"
        />
        {state?.ok === false && state.errors?.confirmNewPassword && (
          <p className="text-xs text-destructive">{state.errors.confirmNewPassword[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="h-11 w-full">
        {isPending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
