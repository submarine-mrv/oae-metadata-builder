# Testing Strategy

This document outlines the testing approach for the OAE Metadata Builder project.

## Current Test Suite Status

- **77 passing tests** (100% pass rate)
- **21 skipped tests** (intentionally skipped integration tests)
- **0 failing tests**

## Testing Philosophy

This project follows a **pragmatic, high-value testing approach** rather than aiming for exhaustive coverage. The focus is on:

1. **Business logic correctness** - Core state management, validation, and data transformations
2. **Critical user paths** - Functionality that would cause major issues if broken
3. **Test maintainability** - Tests that are easy to understand and update
4. **Build stability** - All tests must pass; no flaky or intermittently failing tests

## What We Test

### Unit Tests (77 tests)

#### State Management (`src/contexts/__tests__/AppStateContext.test.tsx` - 42 tests)
- ✅ Project data management
- ✅ Experiment CRUD operations
- ✅ State synchronization (activeTab, activeExperiment, etc.)
- ✅ Auto-incrementing IDs
- ✅ Completion percentage calculations
- ✅ Import/export state management

**Rationale**: The AppStateContext is the backbone of the application. All features depend on it working correctly, so comprehensive testing here prevents cascading failures.

#### Validation Logic (`src/utils/__tests__/validation.test.ts` - 14 tests)
- ✅ Required field validation
- ✅ Conditional field requirements
- ✅ Error message generation
- ✅ Form submission validation

**Rationale**: Validation determines whether users can successfully submit their data. Bugs here directly impact the user's ability to complete their work.

#### Schema Views (`src/utils/__tests__/schemaViews.test.ts` - 21 tests)
- ✅ Conditional field visibility logic
- ✅ Schema transformation for different experiment types
- ✅ Field filtering and selection

**Rationale**: The form dynamically changes based on experiment type. These transformations must work correctly to show users the right fields at the right time.

### Integration Tests (21 tests - skipped)

#### Bundle Schema Script (`scripts/__tests__/bundle-schema.test.mjs` - 21 skipped)
- ⏭️ Git hash validation
- ⏭️ Sea names decoration
- ⏭️ Conditional fields processing
- ⏭️ Schema output generation

**Why Skipped**: These are integration tests for a Node.js build script that requires:
- Valid schema files on disk
- Git repository context
- External API calls (for sea names vocabulary)
- File system write permissions

These tests document the expected behavior of the build script and can be enabled when setting up a proper integration test environment.

## What We Don't Test (Yet)

### React Components
We intentionally do NOT unit test complex React components because:
- They're tightly coupled to UI libraries (Mantine, RJSF) that require extensive mocking
- Component tests are brittle and break frequently with UI changes
- Better covered by E2E tests when critical user flows need verification

### Hooks (except critical ones)
- Simple hooks like `useMetadataDownload` don't need tests if they're just coordinating calls to other tested functions
- Complex hooks with non-trivial logic should be extracted into testable utility functions

### Pages
- Page components are composition layers that wire up tested components and state
- Testing them requires mocking many dependencies
- E2E tests provide better coverage for page-level integration

## When to Add New Tests

### Always Add Tests For:
1. **New validation rules** - Add to `validation.test.ts`
2. **New state management features** - Add to `AppStateContext.test.tsx`
3. **New conditional logic** - Add to `schemaViews.test.ts`
4. **Bug fixes** - Write a failing test first, then fix the bug

### Consider E2E Tests For:
1. **Critical user workflows** - "Happy path" scenarios that must never break
2. **Complex interactions** - Multi-step processes involving multiple components
3. **Regression prevention** - High-impact bugs that have occurred in production

## Test Quality Standards

All tests must:
- ✅ **Pass consistently** - No flaky tests
- ✅ **Run quickly** - Unit tests should complete in milliseconds
- ✅ **Be readable** - Test names clearly describe what's being tested
- ✅ **Be maintainable** - Minimal mocking, clear assertions
- ✅ **Test behavior, not implementation** - Focus on what the code does, not how

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/contexts/__tests__/AppStateContext.test.tsx
```

## CI/CD Integration

Tests run automatically on every pull request via GitHub Actions (`.github/workflows/test.yml`). PRs cannot be merged if tests fail.

## Future Improvements

1. **E2E Testing**: Add Playwright or Cypress tests for critical user workflows
2. **Visual Regression Testing**: Catch unintended UI changes
3. **Performance Testing**: Monitor bundle size and render performance
4. **Integration Test Environment**: Enable bundle-schema tests in CI with proper fixtures

## Migration from Previous Approach

This testing strategy represents a **focused refinement** from the initial testing PR that had:
- 220 total tests (54 passing, 166 skipped)
- 75% skip rate
- Many complex component tests that were difficult to maintain

The new approach:
- 77 passing tests (100% pass rate)
- 27% skip rate (only build-time integration tests)
- Focus on high-value business logic
- Easier to maintain and extend

---

**Last Updated**: 2025-11-14
**Test Suite Version**: v1.0 (First stable release)
