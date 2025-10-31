# OAE Data Protocol - Metadata Form Builder

A dynamic form builder for Ocean Alkalinization Enhancement (OAE) data collection metadata.

## Overview

This application generates schema-driven forms for collecting structured metadata according to the OAE Data Protocol specification. The form structure is entirely driven by JSON Schema, enabling rapid iteration and updates as the protocol evolves.

### Schema Source

The JSON schema is managed in the [`submarine-mrv/oae-data-protocol`](https://github.com/submarine-mrv/oae-data-protocol) repository. This application consumes the schema output and generates interactive forms for data collection.

## Features

- **Schema-driven form generation** - Forms automatically adapt to schema changes
- **Custom UI components** - Specialized widgets for temporal coverage, spatial bounding boxes, and controlled vocabularies
- **Real-time validation** - Client-side validation with custom error messages

## Technology Stack

- **Frontend Framework**: Next.js 15 with App Router
- **Form Engine**: React JSON Schema Forms (RJSF) with `@rjsf/mantine`
- **UI Components**: Mantine v8 design system
- **Icons**: Tabler Icons React
- **Validation**: AJV JSON Schema validator
- **Build Tool**: Turbopack for fast development

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd oae-form

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `node scripts/bundle-schema.mjs` - Bundle JSON schema for human readable sea names labels

## Architecture

### Schema Processing

1. Source schema from `submarine-mrv/oae-data-protocol`
2. Schema bundling resolves references and adds controlled vocabulary labels
3. Bundled schema served from `/public/schema.bundled.json`
4. Form generation driven by bundled schema + UI configuration

### Custom Components

**Templates:**

- `CustomArrayFieldItemButtonsTemplate` - Trash icon remove buttons
- `CustomTitleFieldTemplate` - Consistent object field styling

**Widgets:**

- `IsoIntervalWidget` - ISO 8601 date interval input with validation
- `SeaNamesAutocompleteWidget` - Controlled vocabulary selection
- `SpatialCoverageMiniMap` - Geographic bounding box input with map

**Fields:**

- `ExternalProjectField` - Multi-field layouts for external research projects
- `SpatialCoverageFlatField` - Alternative spatial coverage input

### Form Configuration

The application uses two configuration layers:

1. **JSON Schema** (`/public/schema.bundled.json`) - Data structure, validation rules, field types
2. **UI Schema** (`src/app/uiSchema.ts`) - Presentation layer, widget selection, field ordering, styling

## Development

### Adding Custom Components

Custom components should be designed with portability in mind for potential future migration away from RJSF:

- Use Mantine primitives directly, not through RJSF wrappers
- Handle own state and validation logic
- Design for reuse in non-RJSF contexts

### Schema Updates

If you're actively developing the schema in the `oae-data-protocol` repository alongside this repo, the `make schema`
command can be used to pull and bundle the latest JSON Schema artifacts from `oae-data-protocol`.

First, make sure you've exported JSON Schema & project artifacts from within the oae-data-protocol repo. This can be
done by running:

```bash
make gen-project
```
**Note:** The above should __not__ be run from this repo, as it is a make task associated with the `oae-data-protocol`
project, so must be run from the root of that repository.

Then, from the root of this repository, you can import the latest JSON Schema into this project and run the
necessary schema-bundling. This bundling script (located in `scripts/bundle-schema.mjs`) prepares the JSON Schema
of the OAE Data Protocol for use in this project. It creates multiple separate root-schema artifacts (e.g. for 
Projects and Experiments), and also pulls in human-readable names for titles of dynamic enums (such as for the Sea
Names controlled vocabulary). It also makes some important fixes to enable conditional rendering of certain fields
(namely conditional rendering of `_custom` fields when a controlled vocab value is not found for a given enum field,
such as with `alkalinity_feedstock_type` and `alkalinity_feedstock_type_custom`).

```bash
# If the protocol repo is locally in the same parent directory as this repo, (e.g. ../oae-data-protocol)
make schema

# To override the schema repo path, set the corresponding environment variable: 
SCHEMA_REPO_PATH=/path/to/your/oae-data-protocol make schema
```

### Customization

- **Styling**: Modify `/src/app/globals.css` or component-level styles
- **Validation**: Add custom validation in `/src/app/page.tsx`
- **UI Layout**: Update `/src/app/uiSchema.ts` for field ordering and presentation
- **Components**: Add new widgets/fields in `/src/components/`

## Related Repositories

- [submarine-mrv/oae-data-protocol](https://github.com/submarine-mrv/oae-data-protocol) - Source schema definition and protocol specification
