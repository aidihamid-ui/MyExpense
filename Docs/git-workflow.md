# Git Workflow

How we use git in MyExpense. Read when working with version control or recovering from a mistake.

---

## Branch Model

- **`main`** is always deployable and always working. Don't push broken code.
- Feature branches: `feature/short-name` (e.g., `feature/expense-entry`).
- Merge to main only when the feature works end-to-end locally.

---

## Commit Hygiene

- Commit at every working state, NOT every save.
- One logical change per commit.
- Format: `[Phase N] feat|fix|chore|docs|refactor: short description`

### Examples
- ✅ `[Phase 2] feat: add expense edit form`
- ✅ `[Phase 5] fix: handle PaddleOCR timeout in worker`
- ✅ `[Phase 1.5] chore: add PM2 ecosystem config`
- ❌ `stuff`, `wip`, `more changes`, `fix bug`

---

## Tags (Your Safety Net)

Tag every phase completion. This is what you revert to when something breaks badly.

```bash
git tag -a v0.0-scaffold        -m "Phase 0: scaffold + local stack runs"
git tag -a v0.1-auth-working    -m "Phase 1: auth working locally"
git tag -a v0.1.5-first-deploy  -m "Phase 1.5: first VPS deploy successful"
git tag -a v0.2-expenses-done   -m "Phase 2: manual entry working"
git tag -a v0.3-dashboard-done  -m "Phase 3: dashboard working"
git tag -a v0.4-uploads-done    -m "Phase 4: receipt upload working"
git tag -a v0.5-ocr-working     -m "Phase 5: end-to-end OCR working"
git tag -a v1.0-production      -m "Phase 6: production ready"

git push --tags
```

---

## Recovery Cheat Sheet

```bash
# Where am I?
git status
git diff
git log --oneline -10

# Save uncommitted work without committing
git stash
git stash pop   # bring it back

# Undo last commit, KEEP the changes
git reset --soft HEAD~1

# Undo last commit, DROP the changes (dangerous!)
git reset --hard HEAD~1

# Find lost commits (after a reset)
git reflog
git checkout <commit-hash>  # to inspect

# Go back to a known-good tagged state
git checkout v0.2-expenses-done   # inspect
git checkout main                  # come back

# See history graphically
git log --oneline --graph --all

# Discard local changes to one file
git checkout -- path/to/file

# Discard all local changes (dangerous!)
git reset --hard HEAD
git clean -fd  # also removes untracked files
```

---

## `.gitignore` Essentials

These MUST be blocked:

```
.env
.env.local
.env.*.local

node_modules/
.next/
*.log

/var/

ocr-service/.venv/
ocr-service/__pycache__/

.DS_Store
*.swp
```

---

## Pre-Commit Safety

Set up `husky` + `lint-staged` in Phase 0:

- Run `tsc --noEmit` before commit (catches type errors)
- Run `npm run lint` on staged files
- Block commits containing `.env` files
- Block commits containing `console.log`

If a commit needs to bypass these (rare), `git commit --no-verify` works but should be explained in the commit message.

---

## What to Do When You've Broken Something

1. **Stop.** Don't make more changes trying to fix it.
2. `git status` and `git diff` — what's the actual state?
3. If uncommitted changes are the problem → `git stash` to set them aside.
4. If a bad commit is the problem → identify the last-known-good tag → `git checkout v0.X-...` to inspect.
5. If you can't tell what's wrong → ask in chat before doing anything destructive.
6. **`git reset --hard` and `git clean -fd` destroy data.** Never run them when uncertain.

---

## Pushing

- `git push` after every commit or two during a session.
- `git push --tags` after creating any new tag.
- The remote (GitHub) is your offsite backup. Don't go a day without pushing.
