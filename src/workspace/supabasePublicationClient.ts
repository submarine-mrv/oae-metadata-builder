import { supabase } from "@/auth/providers/supabase/client";
import { buildProjectPublicationPayload } from "./publicationPayload";
import type { ProjectRecord } from "./types";

export type ProjectPublicationStatus = {
  published: boolean;
  publishedAt: string | null;
};

export async function loadProjectPublicationStatus(
  projectId: string,
): Promise<ProjectPublicationStatus> {
  const { data, error } = await supabase
    .from("oae_projects")
    .select("published, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load publication status: ${error.message}`);
  }
  return { published: data?.published ?? false, publishedAt: data?.updated_at ?? null };
}

export async function publishProject(project: ProjectRecord): Promise<ProjectPublicationStatus> {
  const payload = buildProjectPublicationPayload(project);
  const { data, error } = await supabase.rpc("publish_oae_project", {
    p_project: payload.project,
    p_experiments: payload.experiments,
    p_datasets: payload.datasets,
  });
  if (error) throw new Error(`Could not publish the project: ${error.message}`);

  const result = Array.isArray(data) ? data[0] : data;
  if (
    typeof result !== "object" ||
    result === null ||
    !("result_project_id" in result) ||
    result.result_project_id !== project.state.projectData.project_id
  ) {
    throw new Error("Supabase returned an invalid project publication response.");
  }
  return {
    published: true,
    publishedAt:
      "result_published_at" in result && typeof result.result_published_at === "string"
        ? result.result_published_at
        : null,
  };
}

export async function unpublishProject(projectId: string): Promise<void> {
  const { data, error } = await supabase.rpc("unpublish_oae_project", {
    p_project_id: projectId,
  });
  if (error) throw new Error(`Could not unpublish the project: ${error.message}`);
  if (data !== true) {
    throw new Error("This project is not published under the current account.");
  }
}
