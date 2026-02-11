import { describe, it, expect } from 'vitest';
import {
  getBaseSchema,
  getProtocolMetadata,
  getProjectSchema,
  getExperimentSchema,
  getInterventionSchema,
  getTracerSchema,
  getInterventionWithTracerSchema
} from '../schemaViews';

describe('Schema Views', () => {
  describe('getBaseSchema', () => {
    it('should return the bundled schema', () => {
      const schema = getBaseSchema();

      expect(schema).toBeDefined();
      expect(schema.$defs).toBeDefined();
      expect(typeof schema.$defs).toBe('object');
    });

    it('should have protocol version metadata', () => {
      const schema = getBaseSchema();

      expect(schema['x-protocol-version']).toBeDefined();
      expect(typeof schema['x-protocol-version']).toBe('string');
    });

    it('should have Container definition in $defs', () => {
      const schema = getBaseSchema();

      expect(schema.$defs.Container).toBeDefined();
      expect(schema.$defs.Project).toBeDefined();
      expect(schema.$defs.Experiment).toBeDefined();
    });
  });

  describe('getProtocolMetadata', () => {
    it('should extract version and git hash from schema', () => {
      const metadata = getProtocolMetadata();

      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('gitHash');
    });

    it('should return strings for version and gitHash', () => {
      const metadata = getProtocolMetadata();

      expect(typeof metadata.version).toBe('string');
      expect(typeof metadata.gitHash).toBe('string');
    });
  });

  describe('getProjectSchema', () => {
    it('should create schema with Project definition as root', () => {
      const schema = getProjectSchema();

      expect(schema.$id).toBe('ProjectSchema');
      expect(schema.title).toBeDefined();
      expect(schema.properties).toBeDefined();
    });

    it('should have required project fields', () => {
      const schema = getProjectSchema();

      expect(schema.properties.project_id).toBeDefined();
      expect(schema.properties.description).toBeDefined();
      expect(schema.properties.mcdr_pathway).toBeDefined();
      expect(schema.properties.sea_names).toBeDefined();
      expect(schema.properties.spatial_coverage).toBeDefined();
      expect(schema.properties.temporal_coverage).toBeDefined();
    });

    it('should preserve all $defs from base schema', () => {
      const baseSchema = getBaseSchema();
      const projectSchema = getProjectSchema();

      expect(projectSchema.$defs).toBeDefined();
      expect(Object.keys(projectSchema.$defs).length).toBeGreaterThan(0);

      // Should have same definitions as base
      expect(projectSchema.$defs.SpatialCoverage).toBeDefined();
      expect(projectSchema.$defs.MCDRPathway).toBeDefined();
    });

    it('should preserve protocol metadata', () => {
      const projectSchema = getProjectSchema();

      expect(projectSchema['x-protocol-version']).toBeDefined();
      expect(typeof projectSchema['x-protocol-version']).toBe('string');
    });

    it('should have experiments array in properties', () => {
      const schema = getProjectSchema();

      expect(schema.properties.experiments).toBeDefined();
      // Schema now allows null values, so type is ['array', 'null']
      expect(schema.properties.experiments.type).toEqual(['array', 'null']);
    });
  });

  describe('getExperimentSchema', () => {
    it('should create schema with Experiment definition as root', () => {
      const schema = getExperimentSchema();

      expect(schema.$id).toBe('ExperimentSchema');
      expect(schema.properties).toBeDefined();
    });

    it('should have required experiment fields', () => {
      const schema = getExperimentSchema();

      expect(schema.properties.experiment_id).toBeDefined();
      expect(schema.properties.experiment_type).toBeDefined();
      expect(schema.properties.description).toBeDefined();
      expect(schema.properties.principal_investigators).toBeDefined();
    });

    it('should preserve $defs and metadata', () => {
      const schema = getExperimentSchema();

      expect(schema.$defs).toBeDefined();
      expect(schema['x-protocol-version']).toBeDefined();
    });
  });

  describe('getInterventionSchema', () => {
    it('should create schema with Intervention definition as root', () => {
      const schema = getInterventionSchema();

      expect(schema.$id).toBe('InterventionSchema');
      expect(schema.properties).toBeDefined();
    });

    it('should have intervention-specific fields', () => {
      const schema = getInterventionSchema();

      // Intervention-specific fields
      expect(schema.properties.alkalinity_feedstock).toBeDefined();
      expect(schema.properties.alkalinity_feedstock_form).toBeDefined();
      expect(schema.properties.alkalinity_feedstock_processing).toBeDefined();
      expect(schema.properties.dosing_location).toBeDefined();
      expect(schema.properties.dosing_delivery_type).toBeDefined();
    });

    it('should also include base experiment fields (extends Experiment)', () => {
      const schema = getInterventionSchema();

      // Base experiment fields should also be present
      expect(schema.properties.experiment_id).toBeDefined();
      expect(schema.properties.experiment_type).toBeDefined();
      expect(schema.properties.description).toBeDefined();
    });
  });

  describe('getTracerSchema', () => {
    it('should create schema with Tracer definition as root', () => {
      const schema = getTracerSchema();

      expect(schema.$id).toBe('TracerSchema');
      expect(schema.properties).toBeDefined();
    });

    it('should have tracer-specific fields', () => {
      const schema = getTracerSchema();

      // Tracer-specific fields
      expect(schema.properties.tracer_form).toBeDefined();
      expect(schema.properties.tracer_details).toBeDefined();
    });
  });

  describe('getInterventionWithTracerSchema', () => {
    it('should create schema with InterventionWithTracer definition as root', () => {
      const schema = getInterventionWithTracerSchema();

      expect(schema.$id).toBe('InterventionWithTracerSchema');
      expect(schema.properties).toBeDefined();
    });

    it('should have both intervention and tracer fields', () => {
      const schema = getInterventionWithTracerSchema();

      // Should have intervention fields
      expect(schema.properties.alkalinity_feedstock).toBeDefined();

      // Should have tracer fields
      expect(schema.properties.tracer_form).toBeDefined();
    });
  });

  describe('Bug Regression: Schema decoration path (Bug #3)', () => {
    it('should find sea_names in Project definition (not at root)', () => {
      const projectSchema = getProjectSchema();

      // This test ensures we're looking in the right place after Container became root
      expect(projectSchema.properties.sea_names).toBeDefined();
      // Schema now allows null values, so type is ['array', 'null']
      expect(projectSchema.properties.sea_names.type).toEqual(['array', 'null']);

      // Should have decorated enum values from sea_names_labeled.json
      expect(projectSchema.properties.sea_names.items).toBeDefined();
      expect(projectSchema.properties.sea_names.items.oneOf).toBeDefined();

      // Should have multiple sea name options
      const options = projectSchema.properties.sea_names.items.oneOf;
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);

      // Each option should have const (URI) and title (label)
      if (options.length > 0) {
        expect(options[0]).toHaveProperty('const');
        expect(options[0]).toHaveProperty('title');
        expect(options[0].const).toContain('vocab.nerc.ac.uk');
      }
    });
  });
});
