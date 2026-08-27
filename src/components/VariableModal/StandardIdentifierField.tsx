import {
  Anchor,
  Badge,
  Button,
  CloseButton,
  Combobox,
  Divider,
  Group,
  Input,
  InputBase,
  Loader,
  Text,
  useCombobox,
} from "@mantine/core";
import { IconArrowLeft, IconExternalLink, IconSearch } from "@tabler/icons-react";
import React from "react";
import { type CfEntry, type CfIndex, loadCfIndex } from "@/data/cf/cfStandardNames";
import { getNestedValue, type JSONSchema } from "../schemaUtils";
import FieldLabel from "./FieldLabel";

interface StandardIdentifierFieldProps {
  /** Dot-separated path to the standard_identifier object */
  fieldPath: string;
  /** The variable schema */
  variableSchema: JSONSchema;
  /** The root schema containing $defs */
  rootSchema: JSONSchema;
  /** Current form data */
  formData: Record<string, unknown>;
  /**
   * Reports the chosen CF entry, or null when cleared. The modal owns the writes —
   * selecting also prefills long_name and concentration_basis, and it needs to
   * remember what it prefilled.
   */
  onSelect: (entry: CfEntry | null) => void;
  /**
   * Reports the entry the stored term resolves to, whenever that changes. Distinct
   * from onSelect: this fires for a term the modal reopened with, and prefills
   * nothing. It is how a name stored from the full table still gets unit
   * suggestions, since only this component loads the index.
   */
  onResolve?: (entry: CfEntry | null) => void;
  /** Curated entries for this variable type, or null to search the full CF list */
  shortlist: CfEntry[] | null;
  /** Variable type label used in the shortlist heading, e.g. "pH" */
  typeLabel?: string;
}

/** Rendered options are capped so a full-list search never mounts thousands of nodes. */
const MAX_OPTIONS = 100;

/** Sentinel option value. Not a CF name, so it cannot collide with one. */
const NO_STANDARD_NAME = "$none";

/** The browsable table is the useful reference while filling this in. */
const CF_TABLE_URL =
  "https://cfconventions.org/Data/cf-standard-names/current/build/cf-standard-name-table.html";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .trim();

/**
 * Scores a name against a query, or -1 for no match. Every query word must appear,
 * which is what lets "partial pressure carbon dioxide" find
 * partial_pressure_of_carbon_dioxide_in_sea_water — CF names are full of connecting
 * words nobody types.
 *
 * Ranks exact > prefix > word-boundary > substring > all-words-present.
 */
function score(haystack: string, query: string, words: string[]): number {
  if (haystack === query) return 0;
  if (haystack.startsWith(query)) return 1;
  if (haystack.includes(` ${query}`)) return 2;
  if (haystack.includes(query)) return 3;
  return words.every((w) => haystack.includes(w)) ? 4 : -1;
}

interface Match {
  entry: CfEntry;
  /** Set when the entry was found through a CF alias rather than its own name */
  viaAlias?: string;
  rank: number;
}

export default function StandardIdentifierField({
  fieldPath,
  formData,
  onSelect,
  onResolve,
  shortlist,
  typeLabel,
}: StandardIdentifierFieldProps) {
  const [search, setSearch] = React.useState("");
  const [index, setIndex] = React.useState<CfIndex | null>(null);
  /** Set when the user chose "Other" — UI only, nothing is written to the variable. */
  const [noStandardName, setNoStandardName] = React.useState(false);
  /** Escape hatch out of a shortlist into the full CF table, and back again. */
  const [searchAll, setSearchAll] = React.useState(false);

  const hasShortlist = shortlist !== null;
  const isFullList = !hasShortlist || searchAll;

  const stored = getNestedValue(formData, fieldPath) as { term?: string; uri?: string } | undefined;
  const selectedTerm = typeof stored?.term === "string" ? stored.term : null;

  const shortlistEntry = React.useMemo(
    () => (selectedTerm ? (shortlist?.find((e) => e.name === selectedTerm) ?? null) : null),
    [shortlist, selectedTerm],
  );

  /**
   * A stored term the shortlist does not cover needs the index too, or there is no
   * way to tell a real CF name that simply is not suggested for this variable type
   * from one that has been retired.
   */
  const needsIndex = isFullList || (!!selectedTerm && !shortlistEntry);

  // The full index is a lazy chunk; pull it only when the picker actually needs it.
  React.useEffect(() => {
    if (!needsIndex) return;
    let active = true;
    loadCfIndex().then((loaded) => {
      if (active) setIndex(loaded);
    });
    return () => {
      active = false;
    };
  }, [needsIndex]);

  // Derived, never stored. Held as state it could stick on forever: setIndex
  // re-renders, the effect cleanup fires, and the separate `.finally` microtask that
  // meant to clear it finds the effect already torn down and skips the write.
  const loading = needsIndex && !index;

  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
      // Search-all is a per-visit detour, not a mode. Reopening starts at the
      // suggestions again, which is what someone coming back to the field expects.
      setSearchAll(false);
    },
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active"),
  });

  const selectedEntry = React.useMemo(
    () => shortlistEntry ?? (selectedTerm ? (index?.byName.get(selectedTerm) ?? null) : null),
    [shortlistEntry, index, selectedTerm],
  );

  // The suggested list is exactly the shortlist. A selection made from the full
  // table is not added to it — the trigger already shows it, and "Search all
  // standard names" brings back the list it came from.
  const pool = React.useMemo<CfEntry[]>(
    () => (isFullList ? (index?.entries ?? []) : (shortlist ?? [])),
    [isFullList, index, shortlist],
  );

  React.useEffect(() => {
    onResolve?.(selectedEntry);
  }, [selectedEntry, onResolve]);

  /**
   * A stored term nothing recognises: an imported document, or a name deprecated
   * since this vocabulary snapshot. Show it rather than blanking it.
   */
  const offList = selectedTerm && !selectedEntry && !loading ? selectedTerm : null;

  const matches = React.useMemo<Match[]>(() => {
    const q = norm(search);
    // Keep the full list, not a truncated one — the footer below reports how many
    // matched, and slicing here would always report exactly the cap.
    if (!q) return pool.map((entry) => ({ entry, rank: 0 }));

    const words = q.split(" ").filter(Boolean);
    const found: Match[] = [];
    for (const entry of pool) {
      const rank = score(norm(entry.name), q, words);
      if (rank >= 0) found.push({ entry, rank });
    }

    // Aliases are retired CF names that still resolve; searching them saves anyone
    // working from older data from a dead end. They rank below direct matches.
    if (index && isFullList) {
      const seen = new Set(found.map((m) => m.entry.name));
      for (const { alias, target } of index.aliases) {
        if (seen.has(target)) continue;
        const rank = score(norm(alias), q, words);
        if (rank < 0) continue;
        const entry = index.byName.get(target);
        if (entry) {
          found.push({ entry, viaAlias: alias, rank: rank + 5 });
          seen.add(target);
        }
      }
    }

    return found.sort((a, b) => a.rank - b.rank || (a.entry.name < b.entry.name ? -1 : 1));
  }, [pool, search, index, isFullList]);

  const shown = matches.slice(0, MAX_OPTIONS);

  const handleSubmit = (name: string) => {
    combobox.closeDropdown();
    if (name === NO_STANDARD_NAME) {
      setNoStandardName(true);
      onSelect(null);
      return;
    }
    const entry = pool.find((e) => e.name === name);
    if (entry) {
      setNoStandardName(false);
      onSelect(entry);
    }
  };

  // The footer buttons live inside the dropdown, so the default mousedown would blur
  // the target and close it before the click lands.
  const keepOpen = (e: React.MouseEvent) => e.preventDefault();

  const clearSelection = () => {
    setNoStandardName(false);
    onSelect(null);
  };

  const showAll = () => {
    setSearchAll(true);
    setSearch("");
    combobox.openDropdown();
  };

  const backToSuggested = () => {
    setSearchAll(false);
    setSearch("");
    combobox.openDropdown();
  };

  const showingOther = noStandardName && !selectedTerm;
  const isClearable = !loading && (!!selectedTerm || showingOther);
  // The stored term shows immediately, whether or not the index has resolved it —
  // a saved value must never blink out to the placeholder while a chunk loads.
  const triggerLabel = selectedTerm;

  return (
    <Input.Wrapper
      label={
        <FieldLabel
          title="CF Standard Name (if available)"
          description="Identifies the quantity a variable measures, drawn from the CF Conventions standard name table. Optional."
          required={false}
        />
      }
      // Input.Wrapper puts the description between the label and the input, which is
      // where this reads best — it tells you what to do before you open the picker.
      description={
        <>
          Read more about CF Standard Names on the{" "}
          <Anchor href={CF_TABLE_URL} target="_blank" rel="noreferrer" size="xs" inherit>
            CF Conventions website
          </Anchor>
          .
        </>
      }
      style={{ width: "100%" }}
    >
      <Combobox store={combobox} onOptionSubmit={handleSubmit} withinPortal>
        <Combobox.Target>
          <InputBase
            component="button"
            type="button"
            aria-label="CF standard name"
            pointer
            rightSection={
              loading ? (
                <Loader size={14} />
              ) : isClearable ? (
                // Combobox has no `clearable`, so this is the same CloseButton that
                // Mantine's Select renders for it — the app's other selects are all
                // clearable, and this one should not be the exception.
                <CloseButton
                  size="sm"
                  aria-label="Clear standard name"
                  onMouseDown={keepOpen}
                  onClick={clearSelection}
                />
              ) : (
                <Combobox.Chevron />
              )
            }
            // The section swallows clicks only when it holds the clear button;
            // otherwise they fall through to the trigger and open the dropdown.
            rightSectionPointerEvents={isClearable ? "all" : "none"}
            onClick={() => combobox.toggleDropdown()}
          >
            {showingOther ? (
              <Text size="sm" c="dimmed" lineClamp={1}>
                Other (no standard name listed)
              </Text>
            ) : triggerLabel ? (
              <Text size="sm" ff="monospace" lineClamp={1}>
                {triggerLabel}
              </Text>
            ) : (
              <Input.Placeholder>
                {isFullList ? "Search CF standard names…" : "Select a CF standard name…"}
              </Input.Placeholder>
            )}
          </InputBase>
        </Combobox.Target>

        <Combobox.Dropdown>
          {isFullList && (
            <Combobox.Search
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search CF standard names…"
              disabled={loading}
            />
          )}

          <Combobox.Options mah={280} style={{ overflowY: "auto" }}>
            {loading ? (
              <Combobox.Empty>Loading CF standard names…</Combobox.Empty>
            ) : shown.length === 0 ? (
              <Combobox.Empty>No matching standard name.</Combobox.Empty>
            ) : (
              <OptionList
                matches={shown}
                groupLabel={!isFullList && typeLabel ? `Suggested for ${typeLabel}` : undefined}
                selectedTerm={selectedTerm}
              />
            )}

            {!loading && (
              <>
                <Divider my={4} />
                {/* A value, not an action: it answers the question with "none". The
                    sans face already sets it apart from the monospace CF names, so it
                    needs no dimming — which read as disabled. */}
                <Combobox.Option value={NO_STANDARD_NAME} active={showingOther}>
                  <Text size="sm">Other (no standard name listed)</Text>
                </Combobox.Option>
              </>
            )}
          </Combobox.Options>

          {(hasShortlist || matches.length > MAX_OPTIONS) && (
            <Combobox.Footer>
              {matches.length > MAX_OPTIONS && (
                <Text size="xs" c="dimmed" mb={hasShortlist ? 4 : 0}>
                  Showing {MAX_OPTIONS} of {matches.length} matches — keep typing to narrow.
                </Text>
              )}
              {/* Full width and left-aligned so it reads as another row of the list
                  rather than a pill floating under it. It stays in the footer, which
                  does not scroll, so it is still reachable at option 101. */}
              {hasShortlist &&
                (searchAll ? (
                  <Button
                    fullWidth
                    justify="flex-start"
                    size="xs"
                    variant="subtle"
                    leftSection={<IconArrowLeft size={14} />}
                    onMouseDown={keepOpen}
                    onClick={backToSuggested}
                  >
                    Back to suggested names
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    justify="flex-start"
                    size="xs"
                    variant="subtle"
                    leftSection={<IconSearch size={14} />}
                    onMouseDown={keepOpen}
                    onClick={showAll}
                  >
                    Search all standard names
                  </Button>
                ))}
            </Combobox.Footer>
          )}
        </Combobox.Dropdown>
      </Combobox>

      {offList && (
        <Text size="xs" c="orange" mt={4}>
          This name is not in the current CF standard name table. It was kept as stored.
        </Text>
      )}

      {selectedEntry && (
        <Anchor
          href={selectedEntry.uri}
          target="_blank"
          rel="noreferrer"
          size="xs"
          display="inline-block"
          mt={4}
        >
          <Group gap={2} wrap="nowrap">
            <Text size="xs">View on NERC NVS</Text>
            <IconExternalLink size={11} />
          </Group>
        </Anchor>
      )}
    </Input.Wrapper>
  );
}

/** Options, optionally under a group heading. */
function OptionList({
  matches,
  groupLabel,
  selectedTerm,
}: {
  matches: Match[];
  groupLabel?: string;
  selectedTerm: string | null;
}): React.ReactNode {
  const options = matches.map(({ entry, viaAlias }) => (
    <Combobox.Option value={entry.name} key={entry.name} active={entry.name === selectedTerm}>
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Text size="sm" ff="monospace" lineClamp={2}>
          {viaAlias ? `${viaAlias} → ${entry.name}` : entry.name}
        </Text>
        <Badge size="xs" variant="light" style={{ flexShrink: 0 }}>
          {entry.units === "1" ? "dimensionless" : entry.units}
        </Badge>
      </Group>
    </Combobox.Option>
  ));

  return groupLabel ? <Combobox.Group label={groupLabel}>{options}</Combobox.Group> : options;
}
