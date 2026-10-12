---
name: testing-patterns
description: Use whenever writing, reviewing, or deleting tests in emdash-resend-email — including tests for code you just wrote, bug regressions, choosing expected values or fixtures, choosing the test host, and deciding what stays real.
---

# Testing patterns

A test here is a **challenge test**: it fails when the plugin does the wrong
thing for its requirement. A **confirmation test** is derived from the code it
checks, so it stays green when that code is wrong and fails only when the code
changes. It costs runtime, maintenance and review attention and proves nothing.
Write challenge tests; delete confirmation tests on sight.

`AGENTS.md` owns which gates run before a release. This skill makes each test
earn its place. Its only per-test output is one line in the completion report
(see the end).

## A test earns its place when

1. It names the plausible defect it catches.
2. Its expected value comes from the requirement, the EmDash hook contract, the
   Resend API, or a hand-checked example — never from the implementation.
3. It fails when the rule is broken, not merely when the code is rearranged.
4. It runs at the one layer that owns the rule, with that layer's real
   dependency.
5. Nothing else already covers the rule, and the type checker or
   `emdash-plugin validate` does not already guarantee it.
6. Its value is worth its runtime. Every case boots a workerd isolate.

A test that misses any of these gets fixed or deleted. The default budget for a
small change is zero new tests: update the case that already owns the rule.

## 1. Establish the requirement

The requirement sources, in order:

- The EmDash `email:deliver` contract: the event carries `to`, optional `cc`,
  optional `replyTo`, `subject`, `text` and optional `html`, and a provider
  "that drops `cc` silently leaves those recipients without the message".
  A failed delivery throws; EmDash reports it to the caller.
- The Resend `POST /emails` API: field names (`reply_to`, not `replyTo`),
  `Authorization: Bearer`, a mandatory `User-Agent`, and the
  `{ statusCode, name, message }` error body.
- The EmDash settings contract: `secret` fields are encrypted with
  `EMDASH_ENCRYPTION_KEY` and never returned to the admin.
- RFC 5322 for sender display names.
- `README.md`, which is the public promise to every site that installs this.

When you also wrote the implementation, your reading of the requirement and
your code share blind spots. Write the cases and their expected values from
those sources **before** rereading the implementation. If you cannot state an
expected value without looking at the code, the requirement is not established
yet: find its source or ask.

Keep expected values explicit literals. Never import a constant, helper or
regex from `src/` into a test, and never rebuild the payload with the code's
own logic.

```ts
// Confirmation: rebuilds the sender with the plugin's own logic, so a wrong
// quoting rule passes.
expect(body.from).toBe(formatSender(email, name));

// Challenge: a hand-checked RFC 5322 quoted string.
expect(body.from).toBe('"Example, \\"The\\" CMS" <cms@example.com>');
```

## 2. Pick the owner layer

| Risk | Owner layer |
| --- | --- |
| What reaches Resend: fields, headers, sender, errors, "no request when unconfigured" | `createPluginRuntimeTestHost()`, invoke `email:deliver` through `transport.invokeHook`, queue the Resend reply with `http.respond`, read `http.requests()` |
| Settings trust: the API key is encrypted at rest | Runtime host: `actions.plugin.updateSettings`, then `inspect.settings.raw` |
| Manifest shape, capabilities, `allowedHosts` | `emdash-plugin validate`, already part of `bun run test`. Write no test for it |
| Admin form rendering, provider selection in Settings → Email, the magic-link pipeline, the in-process (`plugins: []`) load path | EmDash owns these. When a change touches how the plugin is registered or configured, verify once on a disposable local EmDash site and say so in the report |
| Resend actually accepting mail | Manual, with a real key on a real verified domain. Never in the suite |

The only substitute in this suite is the Resend API, through the host's
`http` queue. Do not mock `ctx`, `ctx.settings`, `ctx.http` or the plugin
context: the host runs the real EmDash sandbox wrapper and bridge, and that is
the point. If a rule needs a mock to be tested, report it instead of mocking
around it.

Write nothing for what the types already forbid. If a case exists only to
reject a state the types could forbid, tighten the type and report it.

## 3. Write a discriminating case

- Send every optional field at once, with values that cannot be confused:
  distinct `to`, `cc` and `replyTo` addresses, and different `text` and `html`.
  A provider that drops or swaps one must fail.
- Assert the full JSON body with `toEqual`, so an extra or renamed field fails.
- Assert errors by their message as the admin will read it — status, Resend
  error name and detail — never "it threw".
- Assert the absent side effect when the requirement forbids it: an
  unconfigured plugin makes no request to Resend.
- Never let a secret leak into an error: assert the rejection does not contain
  the API key.
- Give distinct branches distinct fixtures (a plain sender name and one with
  RFC 5322 specials) so the wrong branch cannot satisfy the assertion.
- Await the hook. Never sleep.

## 4. Recognize confirmation tests

Replace these with a challenge case, or delete them:

- The expected value comes from `src/`, a shared constant, or a copy of the
  algorithm.
- The test reads `emdash-plugin.jsonc`, `package.json`, `README.md` or `dist/`
  and asserts on text.
- It asserts that a mock was called with whatever the code passes, with no
  Resend or EmDash contract behind it.
- It passes for almost any output: `toBeDefined`, `toBeTruthy`, bare
  `rejects.toThrow()`, `not.toThrow`.
- Several cases run through the same branch and cannot fail independently.

## 5. Prove the test can fail

A new test that has never failed has not shown that it can. Ask whether
dropping the field, taking the wrong branch, or returning early would still
pass. Tighten the case if so.

When reading cannot settle it, **probe**: break the rule, run the one focused
test, confirm it fails for the right reason, then restore and check
`git diff`. Real examples from this repo:

- Change `apiKey` from `"secret"` to `"string"` in `emdash-plugin.jsonc`; the
  encryption test must fail with the plaintext key in the output.
- Remove `cc` from the payload; the full-body test must fail.

For a bug, write the regression first and confirm it fails for the reported
reason, then fix. Never change an expectation to match current output without
evidence from a requirement source.

## 6. Mechanics

- Tests live in `tests/*.test.ts` and run with `bun run test`, which validates
  the manifest, builds the plugin and loads it through `@emdash-cms/plugin-test`.
- Vitest stays on 4.x until `@emdash-cms/plugin-test` supports Vitest 5. Use
  explicit imports from `vitest`.
- Create one host per test and dispose it in `afterEach`. Hosts do not share
  state.
- The suite sets a fixed, valid `EMDASH_ENCRYPTION_KEY` in `beforeAll`. Secret
  settings need it.
- No test reaches the network. `http.respond` must cover every request.
- When a hook throws inside the isolate, workerd prints `uncaught exception`
  and `code had hung` lines. That is the harness, not a failure: the test
  result is what counts.
- Run one case with `bunx vitest run -t "<name>"`.

## Report

For each test you add or rewrite, name in the completion report the defect it
catches and say that `bun run test` ran it. A test whose defect you cannot name
is a confirmation test: delete it before reporting.
