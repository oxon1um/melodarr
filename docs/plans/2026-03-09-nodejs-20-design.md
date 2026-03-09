# Switch to Node.js 20 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch from Node.js 25 to Node.js 20 in Dockerfile and add .nvmrc for local development to fix Prisma schema generation issues.

**Architecture:** Simple config-only change. No code modifications needed.

**Tech Stack:** Node.js 20, Prisma, Docker

---

### Task 1: Update Dockerfile to use Node.js 20

**Files:**
- Modify: `Dockerfile:1`
- Modify: `Dockerfile:15`

**Step 1: Change base image Node version**

Edit line 1: `FROM node:25-alpine AS base` → `FROM node:20-alpine AS base`

**Step 2: Change runner image Node version**

Edit line 15: `FROM node:25-alpine AS runner` → `FROM node:20-alpine AS runner`

**Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: switch to Node.js 20 for Prisma compatibility"
```

---

### Task 2: Create .nvmrc for local development

**Files:**
- Create: `.nvmrc`

**Step 1: Write .nvmrc file**

Content: `20`

**Step 2: Commit**

```bash
git add .nvmrc
git commit -m "chore: add .nvmrc for Node.js 20"
```

---

### Task 3: Verify Prisma generates successfully

**Files:**
- Test: `prisma/schema.prisma`

**Step 1: Switch to Node.js 20**

```bash
nvm use 20
```

**Step 2: Run prisma generate**

```bash
npx prisma generate
```

Expected: Completes successfully (no hang), generates Prisma client in `node_modules/.prisma/client`

**Step 3: Commit**

```bash
git status
git commit --amend --no-edit
# Add verification result to commit message if needed
```

---

**Plan complete.**

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
