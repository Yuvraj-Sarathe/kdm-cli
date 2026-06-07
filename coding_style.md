# Coding Style & CodeScene Compliance Guide

This guide establishes the mandatory coding style rules for this repository to ensure that all future code modifications automatically pass CodeScene quality gates. Any AI agent or developer modifying the codebase MUST strictly follow these rules.

---

## 🚀 Core Health Metrics Thresholds

We enforce the **Bare Minimum** quality gate profile on PR delta analysis:

| Code biomarker | Rule threshold | Target score |
| :--- | :--- | :--- |
| **Cyclomatic Complexity** | Strictly `< 9` per function | `10.00 / 10.00` |
| **Nesting Depth** | Strictly `< 4` levels of indentation | `10.00 / 10.00` |
| **Bumpy Road Ahead** | Max `1` nested conditional block per function | `10.00 / 10.00` |
| **Docstring Coverage** | Strictly `> 80%` of functions & modules documented | Green check |

---

## 🛠️ Rules & Refactoring Patterns

### 1. Cyclomatic Complexity Control
If a function has multiple branches (`if`, `else if`, `for`, `flatMap`, `switch`, or ternaries), its complexity climbs rapidly.
* **Rule**: Keep functions under **7 lines of active logic** whenever possible.
* **Pattern**: Extract complex branches into single-purpose helper functions.
  ```typescript
  // ❌ BAD: High complexity aggregation
  const getFailures = (resource: any) => {
    const failures = [];
    if (resource.spec?.replicas > resource.status?.available) {
      failures.push({ text: 'Replica mismatch' });
    }
    for (const condition of resource.status?.conditions ?? []) {
      if (condition.type === 'Ready' && condition.status === 'False') {
        failures.push({ text: 'Not Ready' });
      }
    }
    return failures;
  };

  // class=line-numbers
  // 🟢 GOOD: Split into simple testable helpers
  const checkReplicas = (resource: any) => ...;
  const checkConditions = (resource: any) => ...;
  const getFailures = (resource: any) => [...checkReplicas(resource), ...checkConditions(resource)];
  ```

### 2. Nested Indentation & Bumpy Road Ahead
Nesting conditionals or loops inside other blocks creates deep paths that are hard to read and trigger "Deep, Nested Complexity" warnings.
* **Rule**: Indentation depth must never exceed **3 levels**.
* **Pattern**: Return early (guard clauses) and delegate loops or child elements.
  ```typescript
  // ❌ BAD: Indentation level = 4
  const validatePorts = (ports: Port[], pods: Pod[]) => {
    for (const port of ports) {
      if (typeof port.target === 'string') {
        const resolved = pods.some(pod => pod.spec.containers.some(c => c.portName === port.target));
        if (!resolved) { ... }
      }
    }
  };

  // 🟢 GOOD: Indentation level <= 2
  const isPortResolved = (target: string, pods: Pod[]) => ...;
  const validateSinglePort = (port: Port, pods: Pod[]) => {
    if (typeof port.target !== 'string') return [];
    if (!isPortResolved(port.target, pods)) {
      return [{ text: 'Unresolved port' }];
    }
    return [];
  };
  ```

### 3. Complex Conditionals
Avoid checking multiple states in a single line.
* **Rule**: Split long compound boolean expressions.
* **Pattern**: Assign checks to descriptive variables or helper methods.
  ```typescript
  // ❌ BAD: Compound conditional with multiple branches
  if (selector && Object.keys(selector).length > 0 && matchingPods.length > 0) { ... }

  // 🟢 GOOD: Extracted variables
  const hasSelector = selector && Object.keys(selector).length > 0;
  if (hasSelector && matchingPods.length > 0) { ... }
  ```

### 4. Docstring Coverage (>80%)
CodeScene checks for standard JSDoc/TSDoc blocks on functions and modules.
* **Rule**: Every exported class, interface, command handler, helper method, and analyzer function must have a JSDoc block describing:
  1. A clear sentence of what it does.
  2. Description of every `@param`.
  3. Description of the `@returns` type.

---

## 📈 Verification Checklist Before Pushing
Always execute the following checks before committing code:

1. **Build Checklist**: Ensure type compiling is clean:
   ```bash
   npm run build
   ```
2. **Test Checklist**: Ensure zero test regressions:
   ```bash
   npm run test
   ```
3. **Complexity Checklist**: Do a mental dry-run of modified functions to check that cyclomatic complexity is `< 9`.
