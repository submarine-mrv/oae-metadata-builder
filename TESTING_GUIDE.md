# Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/state/__tests__/actions.test.ts

# Run in watch mode (for development)
npm test -- --watch
```

## Current Test Suite

**Status**: ✅ 77 passing tests, 21 skipped (98 total)

### Passing Tests (77 tests)

1. **State** (`src/state/__tests__/`)
   - Project reducers and action atoms: CRUD, id propagation, import
   - Atoms: active project, selection, narrow reads
   - Persistence: debounced and immediate saves, flush on hide
   - Narrow reads and render counts (`narrowAtoms.test.tsx`)

2. **Validation** (`src/utils/__tests__/validation.test.ts`) - 14 tests
   - Required field validation
   - Conditional requirements
   - Error message generation
   - Form submission validation

3. **Schema Views** (`src/utils/__tests__/schemaViews.test.ts`) - 21 tests
   - Schema transformations
   - Conditional field visibility
   - Protocol metadata extraction
   - Sea names decoration

### Skipped Tests (21 tests)

4. **Bundle Schema** (`scripts/__tests__/bundle-schema.test.mjs`) - 21 skipped
   - Build-time integration tests
   - Require schema files and git context
   - Documented for future integration test setup

## Test Environment

### Configuration Files

**vitest.config.ts**
- jsdom environment for React testing
- Path aliases configured (`@/` → `src/`)
- Coverage thresholds: 70% lines, 70% functions, 60% branches
- Excludes RJSF custom widgets and layout files

**src/test/setup.ts**
- Global test setup with automatic cleanup
- Mocks for Next.js router
- Mocks for window APIs (URL, scrollTo, matchMedia)
- Mock Blob constructor for downloads
- Console error suppression for known warnings

### PostCSS Configuration

The `postcss.config.mjs` conditionally skips Tailwind CSS during testing:

```javascript
const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

const config = {
  plugins: isTest ? [] : ["@tailwindcss/postcss"]
};
```

## Writing New Tests

### For State Management

State lives in Jotai atoms (`src/state/`). Test pure updates in `projectReducers.test.ts`. Test actions and atoms against a store: `store.set(action, ...args)`, then `store.get(atom)`. Render components inside `StoreWrapper` / `makeWrapper` from `src/state/testing.tsx`. `createTestStore(seed?)` hydrates a store from a workspace, and `workspaceWithProject()` builds one with an active project.

```typescript
import { describe, it, expect } from 'vitest';
import { updateProjectDataAtom } from '@/state/actions';
import { projectDataAtom } from '@/state/atoms';
import { createTestStore, workspaceWithProject } from '@/state/testing';

describe('MyFeature', () => {
  it('updates the project data', () => {
    const store = createTestStore(workspaceWithProject());
    store.set(updateProjectDataAtom, { project_id: 'test' });
    expect(store.get(projectDataAtom).project_id).toBe('test');
  });
});
```

### For Utility Functions

```typescript
import { describe, it, expect } from 'vitest';
import { validateProject } from '../validation';

describe('MyUtility', () => {
  it('should validate correctly', () => {
    const result = validateProject({ project_id: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('project.description is required');
  });
});
```

### For Schema Transformations

```typescript
import { describe, it, expect } from 'vitest';
import { getProjectSchema } from '../schemaViews';
import schema from '../../schemas/bundle.json';

describe('MyTransformation', () => {
  it('should transform schema correctly', () => {
    const projectSchema = getProjectSchema(schema);
    expect(projectSchema.$defs).toBeDefined();
    expect(projectSchema.properties.project_id).toBeDefined();
  });
});
```

## Common Issues and Solutions

### Issue: "Cannot find module '@/...'"

**Solution**: The path alias is configured in `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src')
  }
}
```

### Issue: PostCSS errors during tests

**Solution**:
1. Ensure `VITEST=true` is set in environment
2. Check `postcss.config.mjs` has conditional logic
3. Alternatively, set `css: false` in vitest.config.ts

### Issue: Mock-related errors

**Solution**: Ensure `src/test/setup.ts` is being loaded. It provides mocks for:
- Next.js router (useRouter, usePathname, useSearchParams)
- Window APIs (URL.createObjectURL, scrollTo, matchMedia)
- Blob constructor

## Debugging Tests

### Run single test file
```bash
npm test -- src/state/__tests__/actions.test.ts
```

### Run single test by name
```bash
npm test -- -t "should add experiment with auto-incrementing ID"
```

### Enable verbose output
```bash
npm test -- --reporter=verbose
```

### Use test UI for debugging
```bash
npm run test:ui
```

The test UI provides:
- Real-time test results
- Test filtering
- Detailed error messages
- Individual test debugging

## Test Coverage

View detailed coverage:
```bash
npm run test:coverage
```

Coverage report will be in `coverage/` directory. Open `coverage/index.html` in browser.

**Excluded from coverage**:
- `src/components/rjsf/**` - RJSF custom widgets
- `src/app/**/layout.tsx` - Next.js layouts
- `src/app/**/loading.tsx` - Next.js loading states
- Test files

## CI/CD Integration

Tests run automatically on every PR via GitHub Actions (`.github/workflows/test.yml`).

**Jobs**:
- **Test**: Runs all tests, blocks merge if tests fail
- **Build**: Verifies production build

**To run in CI**:
```yaml
- name: Run tests
  run: npm test -- --run

- name: Run build
  run: npm run build
```

The `--run` flag ensures tests exit after running (no watch mode).

## Testing Philosophy

See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for detailed information about:
- What we test and why
- What we don't test (yet)
- When to add new tests
- Test quality standards
- Future improvements

## Next Steps

1. ✅ Run `npm test` to verify all tests pass
2. ✅ Run `npm run test:coverage` to check coverage
3. ✅ Review [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for testing philosophy
4. ✅ Add tests for new features following the patterns above
5. ✅ Keep tests up to date as code changes

---

**Last Updated**: 2025-11-14
**Test Suite Version**: v1.0
