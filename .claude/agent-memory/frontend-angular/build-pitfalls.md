---
name: build-pitfalls
description: Recurring build/lint errors in the Faro Angular project and how they were resolved
metadata:
  type: feedback
---

**@Component imports array must stay in sync with TS import statements.** Removing a TS import without removing it from `imports: []` causes NG1010 build error ("Value could not be determined statically"). The IDE shows this as a false positive before the build catches it — trust the build output, not the language service squiggles.

**Why:** This happened during 001-login when PrimeNG modules were removed from TS imports but left in the @Component imports array.

**How to apply:** After removing any TS import, grep for its name in the same file's imports array and remove it too.

---

**computed() does NOT track ReactiveForm control state.** `AbstractControl.touched`, `.valid`, `.hasError()` are plain properties, not Angular signals. A `computed()` reading them will not re-evaluate when the control changes. Use a plain `get` getter instead.

**Why:** login.spec.ts tests for emailFieldError and passwordFieldError failed because computed() was memoized and never invalidated by form control mutations.

**How to apply:** For any derived state that reads from ReactiveForm controls (touched, valid, errors), always use a plain `get` getter, not `computed()`.

---

**CSS budget `anyComponentStyle` default is 4kB warning / 8kB error.** Page-level components (e.g., login) with many states legitimately exceed 4kB. Raised to 8kB warning / 16kB error in angular.json.

**Why:** login.css is ~7.35kB for a full authentication page with 6+ states — that is appropriate and should not warn.

**How to apply:** Raise the threshold for large page-level components; keep the error threshold to catch accidental bloat.

---

**ESLint `no-unused-vars` is strict.** Unused imports in spec files and service files (e.g., `Router` in guards.spec.ts, `roleRedirect` in auth.service.ts) fail lint. Clean up before running lint.

**How to apply:** After implementing, check all imports are actually used in the file body.
