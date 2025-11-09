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
