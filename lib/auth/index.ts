import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { env } from '@/lib/env';
import { seedDefaultCategories } from '@/lib/db/seed-categories';
import { getUserCount } from '@/lib/db/queries';

const MAX_USERS = 10;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    camelCase: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map((s) => s.trim())
    : [],
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const currentCount = await getUserCount();
          if (currentCount >= MAX_USERS) {
            throw new Error('Registration is closed. This app has reached its maximum number of users.');
          }
        },
        after: async (user) => {
          try {
            await seedDefaultCategories(user.id);
          } catch (err) {
            console.error('[auth] seedDefaultCategories failed for user', user.id, err);
          }
        },
      },
    },
  },
});
