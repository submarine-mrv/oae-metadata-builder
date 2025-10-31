# Local repository path for OAE schema source
# Can be overridden via environment variable or command line:
#  SCHEMA_REPO_PATH=/path/to/oae-data-protocol make schema
SCHEMA_REPO_PATH ?= ../oae-data-protocol

# Schema file paths
SCHEMA_SOURCE = $(SCHEMA_REPO_PATH)/project/jsonschema/oae_data_protocol.schema.json
SCHEMA_DEST = schemas/schema.json

# Sea names vocabulary URL
SEA_NAMES_URL = https://vocab.nerc.ac.uk/collection/C16/current/
SEA_NAMES_DEST = schemas/sea_names_labeled.json

$(SEA_NAMES_DEST):
	@echo "Fetching SeaDataNet Sea Areas from NERC Vocabulary Server (NVS)..."
	curl -s -H "Accept: application/ld+json" \
		"$(SEA_NAMES_URL)?_profile=dd" \
		-o $(SEA_NAMES_DEST)

.PHONY: schema
schema: $(SEA_NAMES_DEST)
	cp $(SCHEMA_SOURCE) $(SCHEMA_DEST)
	node scripts/bundle-schema.mjs $(SCHEMA_DEST)
