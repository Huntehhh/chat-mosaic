# Security Skill

*Load with: base.md*

Security best practices for all projects.

---

## Core Principle

**Security is not optional.** Every project must pass security checks before merge. Assume all input is malicious, all secrets will leak if committed, and all dependencies have vulnerabilities.

---

## Required Security Setup

### 1. Gitignore (Non-Negotiable)

Every project must have these in `.gitignore`:

```gitignore
# Environment files - NEVER commit
.env
.env.*
!.env.example

# Secrets
*.pem
*.key
*.p12
*.pfx
credentials.json
secrets.json
*-credentials.json
service-account*.json

# IDE and OS
.idea/
.vscode/settings.json
.DS_Store
Thumbs.db

# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# Build outputs
dist/
build/
*.egg-info/

# Logs that might contain sensitive data
*.log
logs/
```

### 2. Environment Variables

**Create `.env.example`** with all required vars (no values):
```bash
# .env.example - Copy to .env and fill in values

# Server-side only (NEVER prefix with VITE_ or NEXT_PUBLIC_)
DATABASE_URL=
ANTHROPIC_API_KEY=

# Client-side safe (public, non-sensitive)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Frontend Environment Variables (Critical!)

**NEVER put secrets in client-exposed env vars:**

| Framework | Client-Exposed Prefix | Server-Only |
|-----------|----------------------|-------------|
| Vite | `VITE_*` | No prefix |
| Next.js | `NEXT_PUBLIC_*` | No prefix |
| Create React App | `REACT_APP_*` | N/A (no server) |

**Validate environment at startup:**
```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

export const env = envSchema.parse(process.env);
```

---

## Input Validation (OWASP Top 10)

### 1. SQL Injection Prevention

**Never use string concatenation:**
```typescript
// BAD - SQL injection vulnerable
const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);

// GOOD - Parameterized query
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

### 2. XSS Prevention

```typescript
// Always sanitize user input before rendering
import DOMPurify from 'dompurify';

// BAD - XSS vulnerable
element.innerHTML = userInput;

// GOOD - Sanitized
element.innerHTML = DOMPurify.sanitize(userInput);

// BEST - Use framework's built-in escaping (React does this by default)
return <div>{userInput}</div>;  // Safe in React
```

### 3. Input Validation at Boundaries

```typescript
// Validate ALL external input with Zod
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
});

// In route handler
app.post('/users', async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  // result.data is now typed and validated
});
```

### 4. Path Traversal Prevention

```typescript
import path from 'path';

// BAD - Path traversal vulnerable
const filePath = `./uploads/${req.params.filename}`;

// GOOD - Validate and sanitize path
const filename = path.basename(req.params.filename);  // Strips ../
const filePath = path.join('./uploads', filename);

// Verify it's still within allowed directory
if (!filePath.startsWith(path.resolve('./uploads'))) {
  throw new Error('Invalid path');
}
```

---

## Authentication & Authorization

### Password Hashing

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;  // Minimum 10, recommended 12+

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Apply to auth routes
app.use('/api/auth', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 5,                // 5 attempts per minute
  message: 'Too many login attempts, please try again later',
}));
```

---

## Security Anti-Patterns

- Secrets in `VITE_*`, `NEXT_PUBLIC_*`, or `REACT_APP_*` env vars (client-exposed!)
- Secrets in code or config files committed to git
- .env files without .gitignore entry
- String concatenation for SQL queries
- `dangerouslySetInnerHTML` without sanitization
- `eval()` or `new Function()` with user input
- Passwords stored as plain text or weak hash (MD5, SHA1)
- No rate limiting on authentication endpoints
- Logging sensitive data (passwords, tokens, PII)
- Using `*` for CORS origins in production
- Ignoring npm audit warnings
