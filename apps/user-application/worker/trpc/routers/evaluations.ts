import { t } from "@/worker/trpc/trpc-instance";

import { z } from "zod";

import {
  getEvaluations,
  getNotAvailableEvaluations,
} from "@repo/data-ops/queries/evaluations";

export const evaluationsTrpcRoutes = t.router({
  problematicDestinations: t.procedure.query(async ({ ctx }) => {
    return getNotAvailableEvaluations(ctx.userInfo.userId);
  }),
  recentEvaluations: t.procedure
    .input(
      z
        .object({
          createdBefore: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const evaluations = await getEvaluations(
        ctx.userInfo.userId,
        input?.createdBefore,
      );

      const oldestCreatedAt =
        evaluations.length > 0
          ? evaluations[evaluations.length - 1].createdAt
          : null;

      return {
        data: evaluations,
        oldestCreatedAt,
      };
    }),
});
