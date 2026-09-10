import { z } from "zod";
import type { ToolDefinition } from "./schema.js";
import type { StateReader } from "../state.js";

const entitySlugPattern = /^[a-z][a-z0-9-]*$/;

const projectStatusInput = z.object({
  entitySlug: z.string().regex(entitySlugPattern, "entitySlug must be a lowercase-hyphen slug"),
});

const projectStatusOutput = z.object({
  entitySlug: z.string(),
  projects: z.array(
    z.object({
      clientName: z.string(),
      projectName: z.string(),
      stage: z.string(),
      status: z.string(),
      updatedAt: z.string(),
    }),
  ),
});

/**
 * Wraps a StateReader as an allowlisted, schema-validated tool. Read-only — there is no
 * corresponding write tool in this package; state mutation stays outside Hermes's reach per
 * CLAUDE.md §6 ("Hermes... never executes code, edits files, calls production APIs directly").
 */
export function createProjectStatusTool(
  reader: StateReader,
): ToolDefinition<typeof projectStatusInput, typeof projectStatusOutput> {
  return {
    name: "state.projectStatus",
    description:
      "Read-only: current stage/status of every project under one entity, from the Supabase " +
      "state layer (packages/db). Never writes.",
    inputSchema: projectStatusInput,
    outputSchema: projectStatusOutput,
    handler: async ({ entitySlug }) => {
      const rows = await reader.getProjectStatuses(entitySlug);
      return {
        entitySlug,
        projects: rows.map((r) => ({
          clientName: r.clientName,
          projectName: r.projectName,
          stage: r.stage,
          status: r.status,
          updatedAt: r.updatedAt,
        })),
      };
    },
  };
}
