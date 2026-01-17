# Local repository path for OAE schema source
# Can be overridden via environment variable or command line:
#  SCHEMA_REPO_PATH=/path/to/oae-data-protocol make schema
SCHEMA_REPO_PATH ?= ../oae-data-protocol

# Schema file paths
SCHEMA_SOURCE = $(SCHEMA_REPO_PATH)/project/jsonschema/oae_data_protocol.schema.json
SCHEMA_DEST = schemas/schema.json

# NERC Vocabulary Server (NVS) collections
NVS_BASE_URL = https://vocab.nerc.ac.uk/collection
NVS_DIR = schemas/nvs
SEA_NAMES_FILE = $(NVS_DIR)/sea_names.json
PLATFORM_TYPES_FILE = $(NVS_DIR)/platform_types.json

$(NVS_DIR):
	mkdir -p $(NVS_DIR)

$(SEA_NAMES_FILE): $(NVS_DIR)
	@echo "Fetching SeaDataNet Sea Areas (C16) from NVS..."
	curl -s -H "Accept: application/ld+json" \
		"$(NVS_BASE_URL)/C16/current/?_profile=dd" \
		-o $(SEA_NAMES_FILE)

$(PLATFORM_TYPES_FILE): $(NVS_DIR)
	@echo "Fetching Platform Types (L06) from NVS..."
	curl -s -H "Accept: application/ld+json" \
		"$(NVS_BASE_URL)/L06/current/?_profile=dd" \
		-o $(PLATFORM_TYPES_FILE)

.PHONY: nvs-vocabs
nvs-vocabs: $(SEA_NAMES_FILE) $(PLATFORM_TYPES_FILE)
	@echo "✓ NVS vocabularies fetched"

.PHONY: schema
schema: nvs-vocabs
	@echo "Checking oae-data-protocol repository status..."
	@if [ ! -d "$(SCHEMA_REPO_PATH)/.git" ]; then \
		echo "Error: $(SCHEMA_REPO_PATH) is not a git repository"; \
		exit 1; \
	fi
	@cd $(SCHEMA_REPO_PATH) && \
		if ! git diff-index --quiet HEAD --; then \
			echo "Error: $(SCHEMA_REPO_PATH) has uncommitted changes."; \
			echo "Please commit or stash changes before running 'make schema'."; \
			exit 1; \
		fi
	@echo "Repository is clean. Getting git hash..."
	$(eval PROTOCOL_GIT_HASH := $(shell cd $(SCHEMA_REPO_PATH) && git rev-parse HEAD))
	@if [ -z "$(PROTOCOL_GIT_HASH)" ]; then \
		echo "Error: Failed to get git hash from $(SCHEMA_REPO_PATH)"; \
		exit 1; \
	fi
	@echo "Protocol git hash: $(PROTOCOL_GIT_HASH)"
	cp $(SCHEMA_SOURCE) $(SCHEMA_DEST)
	node scripts/bundle-schema.mjs $(SCHEMA_DEST) $(PROTOCOL_GIT_HASH)
