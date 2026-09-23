import {
  ActionIcon,
  Box,
  Button,
  Group,
  Image,
  Menu,
  SegmentedControl,
  Switch,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconDotsVertical,
  IconDownload,
  IconFileImport,
  IconHelp,
  IconInfoCircle,
  IconLogout,
  IconUser,
} from "@tabler/icons-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useAuth } from "@/auth/useAuth";
import DownloadModal from "@/components/DownloadModal";
import ImportFlow from "@/components/ImportFlow";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import { useDownloadModal } from "@/hooks/useDownloadModal";
import { useImportFlow } from "@/hooks/useImportFlow";
import { toggleJsonPreviewAtom } from "@/state/actions";
import { projectCountAtom, projectStateAtom, showJsonPreviewAtom } from "@/state/atoms";
import { trackEvent } from "@/utils/analytics";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "project", label: "Project" },
  { value: "experiment", label: "Experiments" },
  { value: "dataset", label: "Datasets" },
];

export default function Navigation() {
  const { client, user } = useAuth();
  const showJsonPreview = useAtomValue(showJsonPreviewAtom);
  const toggleJsonPreview = useSetAtom(toggleJsonPreviewAtom);
  const hasProjects = useAtomValue(projectCountAtom) > 0;
  const store = useStore();
  const navigate = useNavigate();
  const importFlow = useImportFlow();

  const { showModal, sections, openModal, closeModal, handleDownload, handleSectionToggle } =
    useDownloadModal({
      // Read on open and download, so the header doesn't re-render on every edit.
      getData: () => store.get(projectStateAtom),
      defaultSelection: "all",
    });

  const handleNavigation = (value: string) => {
    const paths = {
      overview: "/overview",
      project: "/project",
      experiment: "/experiment",
      dataset: "/dataset",
      "how-to": "/how-to",
    } as const;
    navigate({ to: paths[value as keyof typeof paths] });
  };

  const pathname = useLocation({ select: (s) => s.pathname });
  const pathToTab: Record<string, string> = {
    "/overview": "overview",
    "/project": "project",
    "/experiment": "experiment",
    "/dataset": "dataset",
    "/how-to": "how-to",
  };
  const currentTab = pathToTab[pathname] ?? "";

  const isMobile = useMediaQuery("(max-width: 768px)", undefined, {
    getInitialValueInEffect: false,
  });
  // Narrower than this, centred tabs squeeze the crumb to a few letters.
  const isCompact = useMediaQuery("(max-width: 1279px)", undefined, {
    getInitialValueInEffect: false,
  });

  const handleSignOut = async () => {
    await client.signOut();
    trackEvent("auth_logout");
    await navigate({ to: "/overview" });
  };

  return (
    <>
      <Box px="lg" py="sm">
        {/* Top row: brand + crumb, tabs (wide screens only), actions */}
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: isCompact
              ? "minmax(0, 1fr) auto"
              : "minmax(0, 1fr) auto minmax(0, 1fr)",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Brand, then the active project as a breadcrumb */}
          <Group gap="sm" wrap="nowrap" pr="lg" style={{ minWidth: 0 }}>
            <Link
              to="/overview"
              aria-label="OAE Metadata Builder"
              style={{ textDecoration: "none", flexShrink: 0 }}
            >
              <Group gap="sm" wrap="nowrap">
                <Image src="/cts-logo.png" alt="Carbon to Sea" h={32} w={36} decoding="sync" />
                {!isMobile && (
                  <Text
                    fw={500}
                    size="md"
                    c="hadal.9"
                    ff="var(--font-display)"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    OAE Metadata Builder
                  </Text>
                )}
              </Group>
            </Link>
            {hasProjects && <ProjectSwitcher />}
          </Group>

          {/* Navigation tabs, centred */}
          {!isCompact && hasProjects && (
            <SegmentedControl
              style={{
                backgroundColor: "var(--brand-sunlight)",
              }}
              value={currentTab}
              onChange={handleNavigation}
              data={TABS}
              size="md"
              radius="md"
            />
          )}

          {/* Actions - right aligned. Pinned to the last column so an absent tab row can't pull them in. */}
          <Group gap="xs" justify="flex-end" style={{ gridColumn: isCompact ? 2 : 3 }}>
            {/* Import/Export buttons visible on desktop only */}
            {!isMobile && (
              <>
                <Button
                  variant="light"
                  leftSection={<IconFileImport size={16} />}
                  onClick={importFlow.openFilePicker}
                >
                  Import
                </Button>
                {hasProjects && (
                  <Button
                    variant="outline"
                    leftSection={<IconDownload size={16} />}
                    onClick={openModal}
                  >
                    Export
                  </Button>
                )}
              </>
            )}

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" aria-label="Menu">
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                {user ? (
                  <>
                    <Menu.Label>{user.email}</Menu.Label>
                    <Menu.Item
                      leftSection={<IconUser size={16} />}
                      onClick={() => navigate({ to: "/profile", search: { error: undefined } })}
                    >
                      Profile
                    </Menu.Item>
                    <Menu.Item leftSection={<IconLogout size={16} />} onClick={handleSignOut}>
                      Sign out
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                ) : (
                  <>
                    <Menu.Item
                      onClick={() =>
                        navigate({
                          to: "/auth/login",
                          search: { error: undefined, returnTo: undefined },
                        })
                      }
                    >
                      Log in
                    </Menu.Item>
                    <Menu.Item onClick={() => navigate({ to: "/auth/sign-up" })}>Sign up</Menu.Item>
                    <Menu.Divider />
                  </>
                )}
                {/* Import/Export in menu on mobile */}
                {isMobile && (
                  <>
                    <Menu.Item
                      leftSection={<IconFileImport size={16} />}
                      onClick={importFlow.openFilePicker}
                    >
                      Import
                    </Menu.Item>
                    {hasProjects && (
                      <Menu.Item leftSection={<IconDownload size={16} />} onClick={openModal}>
                        Export
                      </Menu.Item>
                    )}
                    <Menu.Divider />
                  </>
                )}
                <Menu.Item
                  leftSection={<IconHelp size={16} />}
                  onClick={() => navigate({ to: "/how-to" })}
                >
                  How-to Guide
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconInfoCircle size={16} />}
                  onClick={() => navigate({ to: "/about" })}
                >
                  About
                </Menu.Item>
                {/* JSON Preview toggle — desktop only (sidebar is hidden on mobile) */}
                {!isMobile && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      closeMenuOnClick={false}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleJsonPreview();
                      }}
                    >
                      <Switch
                        label="JSON Preview"
                        checked={showJsonPreview}
                        onChange={toggleJsonPreview}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Box>

        {/* Tabs on their own full-width row when the top row is too narrow */}
        {isCompact && hasProjects && (
          <SegmentedControl
            style={{
              backgroundColor: "var(--brand-sunlight)",
              marginTop: "0.5rem",
            }}
            value={currentTab}
            onChange={handleNavigation}
            data={TABS}
            size={isMobile ? "xs" : "sm"}
            radius="md"
            fullWidth
          />
        )}
      </Box>

      <DownloadModal
        opened={showModal}
        onClose={closeModal}
        onDownload={handleDownload}
        title="Export All Metadata"
        sections={sections}
        onSectionToggle={handleSectionToggle}
      />

      <ImportFlow flow={importFlow} />
    </>
  );
}
