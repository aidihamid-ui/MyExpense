/**
 * All user-data queries live here. This is the multi-tenancy audit boundary.
 * Every exported function that returns user data MUST filter by userId.
 *
 * Naming convention: getUser*, updateUser*, deleteUser*
 * First parameter is always userId: string.
 */

// Phase 2+ will add expense/category queries here.
// Phase 1 only needs Better-Auth built-in session management.

export {};
