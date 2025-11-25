import { renderHook } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { useTabNavigation } from "../useTabNavigation";
import { useRouter } from "next/navigation";
import { useAppState } from "@/contexts/AppStateContext";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn()
}));

vi.mock("@/contexts/AppStateContext", () => ({
  useAppState: vi.fn()
}));

describe("useTabNavigation", () => {
  const mockPush = vi.fn();
  const mockSetActiveTab = vi.fn();
  const mockSetActiveExperiment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as Mock).mockReturnValue({ push: mockPush });
    (useAppState as Mock).mockReturnValue({
      setActiveTab: mockSetActiveTab,
      setActiveExperiment: mockSetActiveExperiment
    });
  });

  it("should navigate to overview", () => {
    const { result } = renderHook(() => useTabNavigation());

    result.current.navigateToOverview();

    expect(mockSetActiveTab).toHaveBeenCalledWith("overview");
    expect(mockPush).toHaveBeenCalledWith("/overview");
  });

  it("should navigate to project", () => {
    const { result } = renderHook(() => useTabNavigation());

    result.current.navigateToProject();

    expect(mockSetActiveTab).toHaveBeenCalledWith("project");
    expect(mockPush).toHaveBeenCalledWith("/project");
  });

  it("should navigate to experiment without ID", () => {
    const { result } = renderHook(() => useTabNavigation());

    result.current.navigateToExperiment();

    expect(mockSetActiveTab).toHaveBeenCalledWith("experiment");
    expect(mockPush).toHaveBeenCalledWith("/experiment");
    expect(mockSetActiveExperiment).not.toHaveBeenCalled();
  });

  it("should navigate to experiment with ID", () => {
    const { result } = renderHook(() => useTabNavigation());

    result.current.navigateToExperiment(123);

    expect(mockSetActiveTab).toHaveBeenCalledWith("experiment");
    expect(mockSetActiveExperiment).toHaveBeenCalledWith(123);
    expect(mockPush).toHaveBeenCalledWith("/experiment");
  });

  it("should navigate to any tab using navigateToTab", () => {
    const { result } = renderHook(() => useTabNavigation());

    result.current.navigateToTab("project", 456);

    expect(mockSetActiveTab).toHaveBeenCalledWith("project");
    expect(mockSetActiveExperiment).toHaveBeenCalledWith(456);
    expect(mockPush).toHaveBeenCalledWith("/project");
  });
});
