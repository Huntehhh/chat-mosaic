# TypeScript Skill

*Load with: base.md*

---

## Strict Mode (Non-Negotiable)

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## Project Structure

```
project/
├── src/
│   ├── core/               # Pure business logic
│   │   ├── types.ts        # Domain types/interfaces
│   │   ├── services/       # Pure functions
│   │   └── index.ts        # Public API
│   ├── infra/              # Side effects
│   │   ├── api/            # HTTP handlers
│   │   ├── db/             # Database operations
│   │   └── external/       # Third-party integrations
│   └── utils/              # Shared utilities
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

---

## Type Patterns

### Discriminated Unions for Results
```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function parseUser(data: unknown): Result<User> {
  // Type-safe error handling without exceptions
}
```

### Branded Types for IDs
```typescript
type UserId = string & { readonly brand: unique symbol };
type OrderId = string & { readonly brand: unique symbol };

// Can't accidentally pass UserId where OrderId expected
function getOrder(orderId: OrderId): Order { ... }
```

### Const Assertions for Literals
```typescript
const STATUSES = ['pending', 'active', 'closed'] as const;
type Status = typeof STATUSES[number]; // 'pending' | 'active' | 'closed'
```

### Zod for Runtime Validation
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

type User = z.infer<typeof UserSchema>;
```

---

## TypeScript Anti-Patterns

- `any` type - use `unknown` and narrow
- Type assertions (`as`) - use type guards
- Non-null assertions (`!`) - handle null explicitly
- `@ts-ignore` without explanation
- Enums - use const objects or union types
- Classes for data - use interfaces/types
- Default exports - use named exports
