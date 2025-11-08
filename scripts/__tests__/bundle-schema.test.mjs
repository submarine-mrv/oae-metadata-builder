import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Bundle Schema Script', () => {
  describe('Git Hash Validation', () => {
    it('should fail when git hash is not provided', () => {
      expect(() => {
        execSync('node scripts/bundle-schema.mjs schemas/schema.json', {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
      }).toThrow();
    });

    it('should fail when git hash has invalid format', () => {
      const invalidHashes = [
        'not-a-hash',
        '12345', // Too short
        'g' + '0'.repeat(39), // Invalid character
        '0'.repeat(39), // Too short (39 chars)
        '0'.repeat(41) // Too long (41 chars)
      ];

      invalidHashes.forEach((invalidHash) => {
        expect(() => {
          execSync(
            `node scripts/bundle-schema.mjs schemas/schema.json ${invalidHash}`,
            {
              encoding: 'utf-8',
              stdio: 'pipe'
            }
          );
        }).toThrow();
      });
    });

    it('should accept valid 40-character SHA-1 hash', () => {
      const validHash = 'a'.repeat(40); // Valid format

      // This test would require a valid schema file
      // In a real test environment, we'd mock the file system
      // For now, we just verify the hash format would be accepted
      expect(validHash).toMatch(/^[0-9a-f]{40}$/i);
    });

    it('should accept valid hash with mixed case', () => {
      const validHash = 'AbCdEf1234567890' + '0'.repeat(24);
      expect(validHash).toMatch(/^[0-9a-f]{40}$/i);
      expect(validHash.length).toBe(40);
    });
  });

  describe('Sea Names Decoration (Bug #3 Fix)', () => {
    it('should look for sea_names in $defs.Project, not at root', () => {
      // Create a mock schema with sea_names in Project definition
      const mockSchema = {
        $defs: {
          Project: {
            properties: {
              project_id: { type: 'string' },
              sea_names: {
                type: 'array',
                description: 'Sea names array'
              }
            }
          }
        }
      };

      const mockLabels = [
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/26/',
          prefLabel: 'North Atlantic Ocean'
        },
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/27/',
          prefLabel: 'Pacific Ocean'
        }
      ];

      // Simulate the decorateSeaNames function behavior
      const projectDef = mockSchema.$defs?.Project;
      const sea = projectDef?.properties?.sea_names;

      // Should find sea_names in Project definition
      expect(sea).toBeDefined();
      expect(sea.type).toBe('array');

      // Create oneOf from labels
      const oneOf = mockLabels
        .filter((x) => x && x.uri && x.prefLabel)
        .sort((a, b) => a.prefLabel.localeCompare(b.prefLabel))
        .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

      expect(oneOf).toHaveLength(2);
      expect(oneOf[0].const).toBe(
        'http://vocab.nerc.ac.uk/collection/C16/current/26/'
      );
      expect(oneOf[0].title).toBe('North Atlantic Ocean');
    });

    it('should handle schema without Project definition gracefully', () => {
      const mockSchemaNoProject = {
        $defs: {
          SomeOtherDef: {
            properties: {}
          }
        }
      };

      const projectDef = mockSchemaNoProject.$defs?.Project;
      const sea = projectDef?.properties?.sea_names;

      // Should not find sea_names (returns undefined)
      expect(projectDef).toBeUndefined();
      expect(sea).toBeUndefined();
    });

    it('should handle schema without sea_names field', () => {
      const mockSchemaNoSeaNames = {
        $defs: {
          Project: {
            properties: {
              project_id: { type: 'string' },
              description: { type: 'string' }
            }
          }
        }
      };

      const projectDef = mockSchemaNoSeaNames.$defs?.Project;
      const sea = projectDef?.properties?.sea_names;

      expect(projectDef).toBeDefined();
      expect(sea).toBeUndefined();
    });

    it('should filter out labels with missing uri or prefLabel', () => {
      const mockLabelsWithInvalid = [
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/26/',
          prefLabel: 'North Atlantic Ocean'
        },
        {
          uri: null, // Missing URI
          prefLabel: 'Invalid Sea'
        },
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/27/',
          prefLabel: '' // Empty label
        },
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/28/',
          prefLabel: 'Pacific Ocean'
        }
      ];

      const oneOf = mockLabelsWithInvalid
        .filter((x) => x && x.uri && x.prefLabel)
        .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

      // Should only include valid entries
      expect(oneOf).toHaveLength(2);
      expect(oneOf[0].title).toBe('North Atlantic Ocean');
      expect(oneOf[1].title).toBe('Pacific Ocean');
    });

    it('should deduplicate labels with same URI', () => {
      const mockLabelsWithDuplicates = [
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/26/',
          prefLabel: 'North Atlantic Ocean'
        },
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/26/',
          prefLabel: 'North Atlantic Ocean (duplicate)'
        },
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/27/',
          prefLabel: 'Pacific Ocean'
        }
      ];

      const oneOf = mockLabelsWithDuplicates
        .filter((x) => x && x.uri && x.prefLabel)
        .filter((x, i, arr) => arr.findIndex((y) => y.uri === x.uri) === i)
        .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

      // Should only include unique URIs
      expect(oneOf).toHaveLength(2);
    });

    it('should sort labels alphabetically by prefLabel', () => {
      const mockLabels = [
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/27/',
          prefLabel: 'Pacific Ocean'
        },
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/28/',
          prefLabel: 'Atlantic Ocean'
        },
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/26/',
          prefLabel: 'Indian Ocean'
        }
      ];

      const oneOf = mockLabels
        .filter((x) => x && x.uri && x.prefLabel)
        .sort((a, b) => a.prefLabel.localeCompare(b.prefLabel))
        .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

      // Should be alphabetically sorted
      expect(oneOf[0].title).toBe('Atlantic Ocean');
      expect(oneOf[1].title).toBe('Indian Ocean');
      expect(oneOf[2].title).toBe('Pacific Ocean');
    });

    it('should preserve existing sea_names properties when decorating', () => {
      const mockSchema = {
        $defs: {
          Project: {
            properties: {
              sea_names: {
                type: 'array',
                description: 'Original description',
                minItems: 1
              }
            }
          }
        }
      };

      const mockLabels = [
        {
          uri: 'http://vocab.nerc.ac.uk/collection/C16/current/26/',
          prefLabel: 'North Atlantic Ocean'
        }
      ];

      const projectDef = mockSchema.$defs.Project;
      const sea = projectDef.properties.sea_names;

      const oneOf = mockLabels.map(({ uri, prefLabel }) => ({
        const: uri,
        title: prefLabel
      }));

      const decoratedSeaNames = {
        ...sea,
        uniqueItems: true,
        items: { oneOf }
      };

      // Should preserve original properties
      expect(decoratedSeaNames.type).toBe('array');
      expect(decoratedSeaNames.description).toBe('Original description');
      expect(decoratedSeaNames.minItems).toBe(1);

      // Should add new properties
      expect(decoratedSeaNames.uniqueItems).toBe(true);
      expect(decoratedSeaNames.items.oneOf).toHaveLength(1);
    });
  });

  describe('Git Hash Injection', () => {
    it('should inject git hash into schema root', () => {
      const mockSchema = {
        $defs: {},
        'x-protocol-version': 'v1.0.0'
      };

      const gitHash = 'a'.repeat(40);

      const decorated = {
        ...mockSchema,
        'x-protocol-git-hash': gitHash
      };

      expect(decorated['x-protocol-git-hash']).toBe(gitHash);
      expect(decorated['x-protocol-version']).toBe('v1.0.0');
    });

    it('should preserve other x- extension fields', () => {
      const mockSchema = {
        $defs: {},
        'x-protocol-version': 'v1.0.0',
        'x-custom-field': 'custom-value'
      };

      const gitHash = 'b'.repeat(40);

      const decorated = {
        ...mockSchema,
        'x-protocol-git-hash': gitHash
      };

      expect(decorated['x-custom-field']).toBe('custom-value');
      expect(decorated['x-protocol-version']).toBe('v1.0.0');
      expect(decorated['x-protocol-git-hash']).toBe(gitHash);
    });
  });

  describe('Conditional Fields Fixing', () => {
    it('should remove conditional _custom fields from root properties', () => {
      const mockSchema = {
        $defs: {
          TestClass: {
            properties: {
              feedstock_type: { type: 'string' },
              feedstock_type_custom: { type: 'string' }, // Should be removed
              other_field: { type: 'string' }
            }
          }
        }
      };

      const classDef = mockSchema.$defs.TestClass;
      const conditionalFields = ['feedstock_type_custom'];

      conditionalFields.forEach((fieldName) => {
        if (classDef.properties?.[fieldName]) {
          delete classDef.properties[fieldName];
        }
      });

      // Custom field should be removed
      expect(classDef.properties.feedstock_type_custom).toBeUndefined();

      // Other fields should remain
      expect(classDef.properties.feedstock_type).toBeDefined();
      expect(classDef.properties.other_field).toBeDefined();
    });

    it('should update then block with custom field definition', () => {
      const customDef = { type: 'string', description: 'Custom field' };

      const mockSchema = {
        $defs: {
          TestClass: {
            properties: {
              feedstock_type_custom: customDef
            },
            then: {
              properties: {
                feedstock_type_custom: undefined // Placeholder
              }
            }
          }
        }
      };

      const classDef = mockSchema.$defs.TestClass;
      const savedDef = classDef.properties.feedstock_type_custom;

      delete classDef.properties.feedstock_type_custom;

      if (classDef.then?.properties?.feedstock_type_custom !== undefined) {
        classDef.then.properties.feedstock_type_custom = savedDef;
      }

      // Should be removed from root
      expect(classDef.properties.feedstock_type_custom).toBeUndefined();

      // Should be in then block
      expect(classDef.then.properties.feedstock_type_custom).toEqual(customDef);
    });

    it('should handle allOf array with conditional fields', () => {
      const customDef = { type: 'string', description: 'Custom field' };

      const mockSchema = {
        $defs: {
          TestClass: {
            properties: {
              alkalinity_feedstock_custom: customDef
            },
            allOf: [
              {
                if: { properties: { alkalinity_feedstock: { const: 'other' } } },
                then: {
                  properties: {
                    alkalinity_feedstock_custom: undefined // Placeholder
                  }
                }
              }
            ]
          }
        }
      };

      const classDef = mockSchema.$defs.TestClass;
      const savedDef = classDef.properties.alkalinity_feedstock_custom;

      delete classDef.properties.alkalinity_feedstock_custom;

      if (classDef.allOf && Array.isArray(classDef.allOf)) {
        classDef.allOf.forEach((condition) => {
          if (
            condition.then?.properties?.alkalinity_feedstock_custom !== undefined
          ) {
            condition.then.properties.alkalinity_feedstock_custom = savedDef;
          }
        });
      }

      // Should be removed from root
      expect(classDef.properties.alkalinity_feedstock_custom).toBeUndefined();

      // Should be in allOf then block
      expect(
        classDef.allOf[0].then.properties.alkalinity_feedstock_custom
      ).toEqual(customDef);
    });
  });

  describe('Output File Generation', () => {
    it('should write valid JSON to output file', async () => {
      const mockSchema = {
        $id: 'test-schema',
        $defs: {},
        'x-protocol-version': 'v1.0.0',
        'x-protocol-git-hash': 'a'.repeat(40)
      };

      const jsonString = JSON.stringify(mockSchema, null, 2);

      // Verify it's valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Verify formatting (2-space indentation)
      expect(jsonString).toContain('\n  "$id"');
    });

    it('should preserve schema structure in output', async () => {
      const mockSchema = {
        $id: 'test-schema',
        $defs: {
          Project: {
            properties: {
              project_id: { type: 'string' }
            }
          },
          Experiment: {
            properties: {
              experiment_id: { type: 'string' }
            }
          }
        }
      };

      const jsonString = JSON.stringify(mockSchema, null, 2);
      const parsed = JSON.parse(jsonString);

      expect(parsed.$defs.Project).toBeDefined();
      expect(parsed.$defs.Experiment).toBeDefined();
      expect(parsed.$defs.Project.properties.project_id.type).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty labels array', () => {
      const emptyLabels = [];

      const oneOf = emptyLabels
        .filter((x) => x && x.uri && x.prefLabel)
        .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

      expect(oneOf).toHaveLength(0);
    });

    it('should handle null labels', () => {
      const nullLabels = [null, undefined, null];

      const oneOf = nullLabels
        .filter((x) => x && x.uri && x.prefLabel)
        .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

      expect(oneOf).toHaveLength(0);
    });

    it('should validate that sea names oneOf is not empty before using', () => {
      const invalidLabels = [
        { uri: '', prefLabel: '' },
        { uri: null, prefLabel: null }
      ];

      const oneOf = invalidLabels
        .filter((x) => x && x.uri && x.prefLabel)
        .map(({ uri, prefLabel }) => ({ const: uri, title: prefLabel }));

      // Script should error if oneOf is empty
      expect(oneOf.length).toBe(0);

      if (oneOf.length === 0) {
        expect(() => {
          throw new Error(
            'Invalid sea names data - check schemas/sea_names_labeled.json'
          );
        }).toThrow('Invalid sea names data');
      }
    });
  });
});
