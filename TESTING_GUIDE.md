# Testing Guide

## Quick Start

The test suite has been configured to work around PostCSS/Tailwind CSS issues during testing.

### Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/utils/__tests__/validation.test.ts

# Run in watch mode
npm test -- --watch
```

## PostCSS Configuration Fix

The `postcss.config.mjs` has been updated to conditionally skip the Tailwind CSS plugin during testing:

```javascript
const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

const config = {
  plugins: isTest ? [] : ["@tailwindcss/postcss"]
};
```

The `vitest.config.ts` sets `VITEST=true` in the test environment to trigger this.

## If Tests Still Fail to Start

If you get PostCSS errors when running tests, try:

1. **Set environment variable manually:**
   ```bash
   VITEST=true npm test
   ```

2. **Alternative: Temporarily disable CSS processing in vitest.config.ts:**
   ```typescript
   test: {
     css: false,  // Change from true to false
     // ... rest of config
   }
   ```

3. **Check that postcss.config.mjs has the conditional logic:**
   The file should check for `process.env.VITEST` and return empty plugins array.

## Expected Test Results

After fixing the PostCSS issue, you should see tests run for:

1. ✅ Schema Views (src/utils/__tests__/schemaViews.test.ts)
2. ✅ Validation (src/utils/__tests__/validation.test.ts)
3. ✅ Experiment Page (src/app/experiment/__tests__/page.test.tsx)
4. ✅ Project Page (src/app/project/__tests__/page.test.tsx)
5. ✅ Bundle Schema (scripts/__tests__/bundle-schema.test.mjs)
6. ✅ Export/Import (src/utils/__tests__/exportImport.test.ts)
7. ✅ AppStateContext (src/contexts/__tests__/AppStateContext.test.tsx)
8. ✅ Navigation (src/components/__tests__/Navigation.test.tsx)

## Common Issues and Solutions

### Issue: "Cannot find module '@/...'"

**Solution:** The path alias is configured in `vitest.config.ts`. Ensure it's set:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src')
  }
}
```

### Issue: Tests failing with "useAppState must be used within AppStateProvider"

**Solution:** This is expected for some tests that intentionally test error conditions. The error is suppressed in console output via `src/test/setup.ts`.

### Issue: Mock-related errors

**Solution:** Some tests require mocks for:
- Next.js router (mocked in setup.ts)
- RJSF components (mocked in individual test files)
- Window APIs (mocked in setup.ts)

Ensure `src/test/setup.ts` is being loaded.

### Issue: Component tests failing with React errors

**Solution:** Ensure these are installed:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## Test Coverage

Expected coverage (configured thresholds):
- Lines: 70%
- Functions: 70%
- Branches: 60%
- Statements: 70%

To see detailed coverage:
```bash
npm run test:coverage
```

Coverage report will be in `coverage/` directory. Open `coverage/index.html` in a browser.

## Excluded from Coverage

These files are intentionally excluded from coverage:
- `src/components/rjsf/**` - Custom RJSF widgets (mostly presentational)
- `src/app/**/layout.tsx` - Next.js layout files
- `src/app/**/loading.tsx` - Next.js loading states
- Test files themselves

## Writing New Tests

### For Utility Functions

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myModule';

describe('MyModule', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### For React Components

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle click', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    await user.click(screen.getByRole('button'));
    // Assert expected behavior
  });
});
```

### For Components Using AppStateContext

```typescript
import { AppStateProvider } from '@/contexts/AppStateContext';

it('should work with context', () => {
  render(
    <AppStateProvider>
      <MyComponent />
    </AppStateProvider>
  );
  // Test component
});
```

## Debugging Tests

### Run single test file
```bash
npm test -- src/utils/__tests__/validation.test.ts
```

### Run single test
```bash
npm test -- -t "should validate valid project data"
```

### Enable verbose output
```bash
npm test -- --reporter=verbose
```

### Use test UI for debugging
```bash
npm run test:ui
```

This opens a browser UI where you can:
- See test results in real-time
- Filter tests
- View detailed error messages
- Debug individual tests

## CI/CD Integration

To run tests in CI:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test -- --run

- name: Upload coverage
  run: npm run test:coverage -- --run
```

The `--run` flag ensures tests exit after running (no watch mode).

## Next Steps

1. Run `npm test` to verify all tests pass
2. Run `npm run test:coverage` to check coverage
3. Fix any failing tests
4. Add more tests as needed for new features
5. Keep tests up to date as code changes

## Questions?

See `TEST_SUITE_SUMMARY.md` for detailed information about what each test file covers.
