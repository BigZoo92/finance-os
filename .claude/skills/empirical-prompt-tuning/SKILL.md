<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/empirical-prompt-tuning/SKILL.md
     Hash:   sha256:426dfe316e7b32bf
     Sync:   pnpm agent:skills:sync -->

---
name: empirical-prompt-tuning
description: A method for improving agent-facing text instructions (skills, slash commands, task prompts, CLAUDE.md sections, code-generation prompts) by having a bias-free executor actually run them, evaluating from both sides (executor self-report + instruction-side metrics), and iterating until improvements plateau. Use this right after creating or heavily revising a prompt or skill, or when you suspect an agent’s unexpected behavior is caused by ambiguity in the instruction itself.
---

# Empirical Prompt Tuning

The quality of a prompt is invisible to the person who wrote it. The clearer a writer thinks something is, the more likely another agent is to get stuck on it. The core of this skill is **to have a bias-free executor actually run the instruction, evaluate it from both sides, and iterate**. Do not stop until improvement plateaus.

## When to use it

- Immediately after creating or heavily revising a skill, slash command, or task prompt
- When an agent is not behaving as expected and you want to investigate ambiguity in the instruction itself
- When you want to harden high-importance instructions (frequently used skills, core automation prompts)

Do not use it for:

- One-off throwaway prompts where the evaluation cost is not worth it
- Cases where the goal is not improving success rate, but merely reflecting the writer’s subjective preference

## Workflow

0. **Iteration 0 — consistency check between description and body** (static, no dispatch required)

   - Read the frontmatter `description` and note the trigger/use case it claims
   - Read the body and note the scope it actually covers
   - If there is a mismatch, align either the description or the body before moving to Iteration 1
   - Example: the description says “navigation / form filling / data extraction” but the body is only a CLI reference for `npx playwright test`
   - If you skip this, the subagent will “reinterpret” the body to fit the description, and the skill may appear accurate even though it does not actually satisfy the requirements (false positive)

1. **Prepare the baseline**: lock the target prompt and prepare the following two things:
   - **2–3 evaluation scenarios** (1 median case + 1–2 edge cases). These should be realistic tasks where the target prompt would actually be used.
   - **A requirement checklist** (for computing accuracy). For each scenario, list **3–7 requirements** the output must satisfy. Accuracy % = number of satisfied items / total items. Fix this checklist in advance and do not change it afterward.
2. **Bias-free reading**: have a “blank slate” executor read the instruction. Use the Task tool to **dispatch a fresh subagent**. Do not rely on self-rereading; it is structurally impossible to objectively inspect text you just wrote. If running multiple scenarios in parallel, place multiple Agent calls in a single message. For environments where dispatch is impossible, see the “Environment constraints” section.
3. **Execution**: pass the subagent a prompt that follows the **subagent invocation contract** described later, and have it execute the scenario. The executor should generate the implementation or output, then return a self-report at the end.
4. **Evaluate from both sides**: record the following from the returned result:
   - **Executor self-report** (extract from the subagent report): unclear points / places where judgment had to fill gaps / places where applying the template caused friction
   - **Instruction-side measurements** (the judgment rules are defined centrally here; other sections should refer back here):
     - Success/failure: only counted as success (○) if **all requirements tagged `[critical]` are fully satisfied**. If even one is × or partial, it is failure (×). The label is strictly binary: ○ / ×.
     - Accuracy (requirement checklist completion %; score ○ = 1, × = 0, partial = 0.5, summed and divided by total item count)
     - Step count (use the Task tool usage metadata field `tool_uses` as-is; include Read / Grep and do not exclude them)
     - Duration (from the Task tool usage metadata `duration_ms`)
     - Retry count (how many times the subagent re-did the same judgment; extract from the subagent self-report, since the instruction side cannot measure it directly)
     - **On failure, append one line identifying which `[critical]` item failed in the “Unclear points” section of the reporting format** (for root-cause tracking)
   - The requirement checklist must include **at least one `[critical]` item**. If there are zero, the success criterion becomes vacuous.
   - Do not add or remove `[critical]` tags after the fact.
5. **Apply a diff**: make the smallest possible prompt fix that resolves the unclear point. One iteration = one theme (multiple related edits are fine; unrelated edits should wait until the next round).
   - **Before editing, explicitly state which checklist item(s) or judgment wording this fix is meant to satisfy**. Fixes guessed only from the name of an axis often fail to land. See “Fix propagation patterns” below.
6. **Re-evaluate**: dispatch a **new** subagent and repeat steps 2 → 5 (do not reuse the same agent; it has already learned from the previous round). Only increase parallelism if improvements stop plateauing as iterations continue.
7. **Convergence check**: as a rule of thumb, stop when you have **2 consecutive iterations with zero new unclear points and metric improvements below the threshold** (defined later). For high-importance prompts, require 3 consecutive iterations.

## Evaluation axes

| Axis                               | How to measure                                                  | Meaning                                           |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Success/failure                    | Whether the executor produced the intended deliverable (binary) | Minimum bar                                       |
| Accuracy                           | What % of requirements the deliverable satisfied                | Degree of partial success                         |
| Step count                         | Number of tool calls / reasoning steps used by the executor     | Signal of wasted effort caused by the instruction |
| Duration                           | Executor `duration_ms`                                          | Proxy for cognitive load                          |
| Retry count                        | How many times the same judgment had to be retried              | Signal of instruction ambiguity                   |
| Unclear points (self-report)       | Executor lists them in bullets                                  | Qualitative material for improvement              |
| Judgment-fill points (self-report) | Decisions that were not determined by the instruction           | Surfaces implicit spec gaps                       |

**Weighting**: prioritize qualitative signals (unclear points, judgment-fill points), and use quantitative ones (time, step count) as secondary support. If you optimize only for speed, the prompt often gets too thin.

### Qualitative interpretation of `tool_uses`

Looking only at accuracy can hide skill problems. If you use `tool_uses` as a **relative value across scenarios**, structural flaws become visible:

- If one scenario is **3–5x or more** compared with others, that skill is drifting toward a **decision-tree index** and losing self-containedness. The executor is being forced into reference descent.
- Typical example: all scenarios show `tool_uses` of 1–3, but one scenario alone takes 15+ → the recipe for that scenario is missing from the skill, so the executor is crawling across `references/`
- Fix: in Iteration 2, add a “minimal complete example inline” or guidance on “when to read references” near the top of `SKILL.md`; this often drops `tool_uses` sharply

Even if accuracy is 100%, skew in `tool_uses` can justify triggering Iteration 2. Stopping purely because “accuracy looks good” often misses structural defects.

### Fix propagation patterns (conservative / upside / zero effect)

Fixes do not produce linear effects. Beforehand, expect one of these three patterns:

- **Conservative effect** (estimate > actual): one fix was intended to improve multiple axes, but only one moved. “Multi-axis fixes often miss”
- **Upside effect** (estimate < actual): a single structural piece of information (for example, command + config + expected output together) satisfied multiple judgment criteria at once. “Information combinations can structurally affect multiple axes”
- **Zero effect** (estimate > 0, actual = 0): a fix inferred from the axis name never actually touched the wording used in the judgment rule. “Axis names and judgment wording are different things”

To stabilize this, **before applying a diff, have the subagent explicitly state which judgment wording the fix is intended to satisfy**. Unless the fix is tied to threshold-level wording, estimate accuracy stays poor. When adding a new evaluation axis, define the point thresholds concretely enough that the subagent can judge them from wording alone (for example: “everything explicitly stated” or “full working minimal setup”).

## Subagent invocation contract

The prompt passed to the executor should use this structure. This is the input contract for “evaluation from both sides.”

```

You are a blank-slate executor reading <target prompt name>.

## Target prompt

<Paste the full prompt body here, or give a path to read via Read>

## Scenario

<One-paragraph situation setup>

## Requirement checklist (items the deliverable must satisfy)

1. [critical] <item included in the minimum bar>
2. <normal item>
3. <normal item>

...
(The judgment rules are defined centrally in “Workflow 4. Evaluate from both sides / instruction-side measurements”. At least one `[critical]` item is required.)

## Task

1. Execute the scenario by following the target prompt and generate the deliverable.
2. At the end, respond using the report structure below.

## Report structure

* Deliverable: <generated output or execution-result summary>
* Requirement fulfillment: for each item, mark ○ / × / partial (with reason)
* Unclear points: places where the target prompt caused friction, wording that was hard to interpret (bullet list)
* Judgment-fill: places not decided by the instruction that you had to fill in using your own judgment (bullet list)
* Retries: how many times you re-did the same judgment and why

```

The caller extracts the self-report sections from the report, then fills the evaluation table using `tool_uses` / `duration_ms` from the Agent tool usage metadata.

## Environment constraints

If you are in an environment where you **cannot dispatch a fresh subagent** (for example, you are already operating as a subagent, or the Task tool is disabled), then **do not apply this skill**.

- Alternative 1: ask the user in the parent session to launch another Claude Code session and evaluate there
- Alternative 2: skip evaluation and explicitly report: `empirical evaluation skipped: dispatch unavailable`
- **Not allowed**: substituting self-rereading (bias contaminates the result, so the evaluation cannot be trusted)

**Structural review mode**: if you want to check only the **consistency and clarity of the writing** in a skill or prompt, and not run an empirical evaluation, explicitly split it out as structural review mode. In the subagent request prompt, write: “This time: structural review mode — check text consistency, do not execute.” That way the subagent does not trigger the skip behavior in the environment-constraints section and can return a static review. Structural review is not a substitute for empirical evaluation; it is only a supplement.

## Iteration stopping criteria

- **Convergence (stop)**: after **2 consecutive rounds**, all of the following are satisfied:
  - New unclear points: 0
  - Accuracy improvement vs previous round: no more than +3 points (for example, 5% → 8% saturation)
  - Step-count change vs previous round: within ±10%
  - Duration change vs previous round: within ±15%
  - **Overfitting check**: when convergence is reached, add **1 hold-out scenario** that has not been used so far. If accuracy drops by more than 15 points from the recent average, it is overfitting. Go back to baseline scenario design and add more edge coverage.
- **Divergence (question the design)**: if after 3+ iterations new unclear points are not decreasing, the prompt design itself may be wrong. Stop patching and rewrite the structure instead.
- **Resource cutoff**: stop when importance and improvement cost are no longer worth it (make the “ship at 80” judgment)

## Reporting format

For each iteration, record and present the result in this shape:

```

## Iteration N

### Changes (diff from previous round)

* <one-line description of the fix>

### Execution results (by scenario)

| Scenario | Success/failure | Accuracy | steps | duration | retries |
| -------- | --------------- | -------- | ----- | -------- | ------- |
| A        | ○               | 90%      | 4     | 20s      | 0       |
| B        | ×               | 60%      | 9     | 41s      | 2       |

### Unclear points (new this round)

* <Scenario B>: [critical] item N is × — <one-line reason it failed>   # always include this on failure
* <Scenario B>: <one-line additional note>
* <Scenario A>: (none newly observed)

### Judgment-fill (new this round)

* <Scenario B>: <filled-in judgment detail>

### Next fix

* <one-line minimal fix>

(Convergence status: cleared X rounds in a row / Y rounds left until stop condition)

```

## Red flags (watch for rationalization)

| Rationalization you will hear                                  | Reality                                                                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Rereading it myself has the same effect”                      | You cannot objectively inspect text you just wrote. Always dispatch a fresh subagent.                                                                                       |
| “One scenario is enough”                                       | One scenario overfits. Minimum 2, ideally 3.                                                                                                                                |
| “There were zero unclear points once, so we are done”          | That can happen by chance. Require 2 consecutive rounds.                                                                                                                    |
| “Let’s crush multiple unclear points at once”                  | Then you lose track of what actually worked. One iteration, one theme.                                                                                                      |
| “Let’s split even tiny related fixes into separate iterations” | Trap in the other direction. “One theme” is semantic, not mechanical. 2–3 related micro-fixes can be grouped in one iteration. Splitting too much explodes iteration count. |
| “Metrics look good, so we can ignore qualitative feedback”     | Shorter time can also mean the prompt got too thin. Qualitative feedback comes first.                                                                                       |
| “It would be faster to rewrite it”                             | If unclear points still do not decrease after 3+ rounds, that is correct. Before that, it is usually an escape.                                                             |
| “Let’s reuse the same subagent”                                | It has already learned from the previous round. Always dispatch a fresh one.                                                                                                |

## Common failure modes

- **Scenarios are too easy / too hard**: either way, they stop producing signal. Use one median real-world case and one edge case.
- **Looking only at metrics**: if you optimize only for shorter time, critical explanatory detail gets removed and the prompt becomes fragile
- **Too many changes per iteration**: then you cannot tell which fix actually worked. One fix, one iteration.
- **Tuning the scenario to match the fix**: making the scenario easier so it looks like the unclear point disappeared → completely backwards

## Related

- `superpowers:writing-skills` — TDD-style approach for writing skills. Its baseline → fix → rerun loop with subagents is essentially the same as this skill
- `retrospective-codify` — for capturing lessons after a task. This skill is for prompt development during the task; `retrospective-codify` is for after the task is done
- `superpowers:dispatching-parallel-agents` — how to run multiple scenarios in parallel
