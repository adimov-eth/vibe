# CODESTYLE

## MISSION

• Design rapid, robust, secure solutions in **pragmatic TypeScript**.
• Ship working code that _explains itself_ through structure and intent.
• Every deliverable optimizes for the next developer who has to understand it.

## INFLUENCE PALETTE

• **Sindre Sorhus** → ruthless simplicity, perfect naming, single‑purpose functions  
• **Anders Hejlsberg** → clean interfaces, progressive type refinement  
• **Ryan Dahl** → performance‑first async architecture, no exposed complexity  
• **Tanner Linsley** → APIs hiding complexity behind intuitive facades  
• **Matt Pocock** → advanced TypeScript made readable and practical

Their common lesson: **clarity beats cleverness**.

## GUIDING PRINCIPLES

**Meta-Principle: Optimize for the Next Developer**
Every decision should make the code easier for someone else to understand, modify, and debug six months from now.

1. **Intent Over Implementation** - Names reveal what and why, not how
2. **Obvious Flow** - Input → Processing → Output is traceable at a glance
3. **Functional by Default** - Pure functions unless state/objects clarify the domain
4. **Composable Design** - `pipe(load, validate, enrich, persist)` reads as prose
5. **Appropriate Granularity** - Files, functions, and types each model one coherent concept
6. **Explicit Dependencies** - Side effects, errors, and assumptions are visible
7. **Progressive Complexity** - Use TypeScript power to simplify, not to show off

## PRAGMATIC DEFAULTS

**Runtime & Tooling**

- Prefer Bun for speed and simplicity, but don't let it block deployment
- Use the standard library before adding dependencies
- Avoid editing package.json during development; propose commands instead

**Code Organization**

- Functional programming by default - no classes unless they genuinely clarify the domain
- Immutable data structures unless mutation has a clear performance/clarity benefit
- `camelCase` for values, `PascalCase` for types
- Files under 800 lines, functions under 80 lines (guidelines, not laws)

**Type Safety**

- Use `readonly` when it prevents bugs or communicates intent
- Prefer explicit types over inference when they clarify business logic
- Design types to make impossible states unrepresentable

## TYPESCRIPT STYLE

**Advanced but Accessible**
Break complex types into named pieces:

```typescript
type UserFormData<T> = Omit<T, "id" | "createdAt">; // Business intent clear
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
```

**Type Composition**

- Small, composable helper types over deep conditional gymnastics
- Type factories like `Result<T>`, `EventMap<T>` for common patterns
- Wrap inscrutable mapped types in well-named aliases

**When to Use Advanced Features**

- Conditional types: when they prevent runtime errors
- Mapped types: when they ensure data consistency
- Template literals: when they catch typos in string constants
- Generic constraints: when they guide correct usage

## FUNCTION DESIGN

**Parameter Patterns**

- Single parameter: use directly
- 2-3 parameters: consider direct parameters vs object
- 4+ parameters: always use object (RO-RO pattern)

**Error Handling**

- Result objects for expected failures: `{ ok: false; error: string }`
- Exceptions for programmer errors and unexpected failures
- Early returns over nested conditionals

**Async Patterns**

- async/await by default
- Streaming for large data sets
- Never leak transport details into domain logic

## WHEN TO BREAK THE RULES

**Comments**

- Complex algorithms that can't be simplified
- Business rules that aren't obvious from code
- Workarounds for external systems
- Performance optimizations
- Why decisions were made, not what the code does

**Classes**

- When modeling entities with behavior and lifecycle
- When you need private state with controlled access
- When the domain naturally thinks in objects
- Framework integration that expects classes

**Mutation**

- Performance-critical paths with profiling data
- Large data structures where immutability is prohibitive
- When working with mutable external APIs

**Complex Types**

- When they prevent entire classes of runtime errors
- When they make impossible states unrepresentable
- When the complexity is in the types, not the runtime code

## STATE & DATA FLOW

**Default Patterns**

- Immutable data structures
- Pure reducers for state changes
- Event-driven architecture for complex flows

**When to Deviate**

- Performance bottlenecks with measurements
- Integration with mutable external systems
- Frameworks that expect mutation

## API DESIGN

**Consistency**

- Standardized `{ ok, data, error }` payloads for operations that can fail
- Consistent naming across similar operations
- Predictable parameter order

**Error Communication**

- Type-safe error unions when callers need to handle specific errors
- Generic error types for "something went wrong" scenarios
- Include enough context for debugging without exposing internals

## UTILITIES & HELPERS

**Organization**

- Each utility does one thing well
- Named exactly for its purpose
- Independently testable
- Group related utilities, avoid "misc" buckets

**Reusability**

- Design for the specific use case first
- Generalize only when you have multiple real use cases
- Don't build abstractions for hypothetical futures

## DECISION FRAMEWORK

When principles conflict, optimize in this order:

1. **Correctness** - Does it work reliably?
2. **Clarity** - Will the next developer understand it?
3. **Maintainability** - Can it be safely changed?
4. **Performance** - Is it fast enough for the use case?
5. **Consistency** - Does it match existing patterns?

**Red Flags**

- "This is clever" - probably too clever
- "We'll need this later" - probably won't
- "It's more elegant" - probably less practical
- "Everyone does it this way" - check if everyone is wrong

## COMMUNICATION STYLE

**Code Reviews**

- Lead with questions, not conclusions
- Suggest specific alternatives, not just criticism
- Explain the business impact of technical decisions
- Acknowledge when something is preference vs necessity

**Documentation**

- Start with why, then what, then how
- Include examples of common usage
- Document the assumptions and tradeoffs
- Update docs when behavior changes

## THE CORE INSIGHT

> **The best code is no code.**  
> When code is needed, optimize for the developer who has to understand and change it under pressure at 3 AM.

Everything else is implementation details.

**Success Metrics**

- New team members can contribute quickly
- Bugs are caught by the type system, not in production
- Features can be safely modified without understanding the entire codebase
- Code reviews focus on business logic, not syntax

This guide succeeds when following it makes you faster, not when it makes you feel pure.
