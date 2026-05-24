'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { deleteUserData } from '@/lib/db/queries';
import fs from 'fs/promises';

// ── Change Password ──────────────────────────────────────────────────────────

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'Passwords do not match.',
    path: ['confirmNewPassword'],
  });

export type ChangePasswordState =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]>; general?: string }
  | null;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  // 1. Zod validation
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmNewPassword: formData.get('confirmNewPassword'),
  });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  // 2. Session check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, errors: {}, general: 'Not authenticated.' };
  }

  // 3. Delegate to Better-Auth — it verifies currentPassword internally
  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: false,
      },
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'Invalid password') {
      return { ok: false, errors: { currentPassword: ['Current password is incorrect.'] } };
    }
    if (msg === 'Password too short') {
      return { ok: false, errors: { newPassword: ['New password is too short.'] } };
    }
    return { ok: false, errors: {}, general: 'Failed to change password. Please try again.' };
  }
}

// ── Delete Account ───────────────────────────────────────────────────────────

export type DeleteAccountState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function deleteAccountAction(): Promise<DeleteAccountState> {
  // 1. Session check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Not authenticated.' };
  }
  const userId = session.user.id;

  // 2. Delete all DB rows; collect receipt file paths
  let imagePaths: string[];
  try {
    imagePaths = await deleteUserData(userId);
  } catch {
    return { ok: false, error: 'Failed to delete account. Please try again.' };
  }

  // 3. Delete physical receipt files — best effort, never fail the action
  for (const filePath of imagePaths) {
    await fs.unlink(filePath).catch(() => {});
  }

  return { ok: true };
}
