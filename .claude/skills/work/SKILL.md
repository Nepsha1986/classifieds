---
name: work
description: Single entry point for building the classifieds project. Resumes from project memory in .agent/, completes one large verifiable stage of the plan, saves memory, commits, and stops. Run it again (any number of times) to continue.
---

# work — resume and complete the next stage

Project memory lives in `.agent/` inside the repository, never in the session:

- `.agent/PLAN.md` — stages broken into small steps, each `[ ]` todo, `[~]` in progress, `[x]` done.
- `.agent/PROGRESS.md` — append-only log: what was done, where we stopped, what is next.
- `.agent/DECISIONS.md` — decisions and answers to open questions, with a short rationale.

## On every run

1. **Read memory.** Read `CLAUDE.md`, `.agent/PLAN.md`, the tail of `.agent/PROGRESS.md`, and `.agent/DECISIONS.md`.
   If `.agent/` does not exist, this is the first run: create `CLAUDE.md`, this skill, the
   plan and the memory files, commit, then continue.
2. **Prepare the environment** (see "Environment" in `CLAUDE.md`): install deps with
   `pnpm install`, make sure PostgreSQL is reachable (Docker `docker compose up -d db`, or a local
   cluster when Docker is unavailable).
3. **Pick the stage.** The current stage is the first stage in `PLAN.md` that has an unfinished step.
   One run completes exactly one stage.
4. **Find the first unfinished step.** If a step is `[~]` (in progress), first inspect the code and
   `git log`/`git status` to see what is already done in it, then finish it rather than redoing it.
5. **Do the step**, then verify it: `pnpm lint`, `pnpm typecheck`, and the step's own check
   (tests via `pnpm test`, running the app, a curl against the API, a build). Fix until green.
6. **Update memory right away:** mark the step `[x]` in `PLAN.md`, append a line to `PROGRESS.md`
   (done / next), record any decision in `DECISIONS.md`, and `git commit` (code + memory together).
7. **Repeat 4–6** for the next step of the same stage.
8. **When the stage is done:** run the stage's acceptance check from `PLAN.md`, write a stage summary
   in `PROGRESS.md` (what works now, how to check it, what the next stage is), commit, push to the
   working branch, and **stop**. Do not start the next stage in the same run.

## Rules

- Steps are small; an interruption at any moment must lose at most one step of work.
- Memory is updated after every step, never only at the end.
- Never stop to ask questions: choose a reasonable option and record it in `DECISIONS.md`.
- An interruption and a planned stop look the same: state is always saved, the next `work` resumes.
- If a step turns out larger than expected, split it into sub-steps in `PLAN.md` before continuing.
- If a step is blocked by the environment (e.g. no Docker), use a documented fallback and record it in
  `DECISIONS.md`; do not mark a step done without verifying it.
- Restarts are managed from outside (manually or by a scheduler) — do not loop into the next stage.
