import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  completeUploadInputSchema,
  completeUploadOutputSchema,
  deleteFileInputSchema,
  deleteFileOutputSchema,
  getDownloadUrlInputSchema,
  getDownloadUrlOutputSchema,
  getUploadUrlInputSchema,
  getUploadUrlOutputSchema,
  listBySnapshotInputSchema,
  listBySnapshotOutputSchema,
} from "./schemas";
import { completeUpload, type CompleteUploadResult } from "./services/completeUpload";
import { getDownloadUrl, type GetDownloadUrlResult } from "./services/getDownloadUrl";
import { getUploadUrl, type GetUploadUrlResult } from "./services/getUploadUrl";
import { listBySnapshot, type ListBySnapshotResult } from "./services/listBySnapshot";
import { deleteFileObject, type DeleteFileObjectResult } from "./services/deleteFileObject";
import { assertSnapshotAccess } from "@api/modules/guards/services/assertSnapshotAccess";

export const storageRouter = router({
  getUploadUrl: authenticatedProcedure
    .input(getUploadUrlInputSchema)
    .output(getUploadUrlOutputSchema)
    .mutation(async ({ ctx, input }): Promise<GetUploadUrlResult> => {
      await assertSnapshotAccess({
        snapshotId: input.snapshotId,
        orgId: ctx.orgId,
      });
      return getUploadUrl({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      });
    }),

  completeUpload: authenticatedProcedure
    .input(completeUploadInputSchema)
    .output(completeUploadOutputSchema)
    .mutation(async ({ ctx, input }): Promise<CompleteUploadResult> =>
      completeUpload({
        orgId: ctx.orgId,
        userId: ctx.userId,
        snapshotId: input.snapshotId,
        bucket: input.bucket,
        objectKey: input.objectKey,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
      }),
    ),

  getDownloadUrl: authenticatedProcedure
    .input(getDownloadUrlInputSchema)
    .output(getDownloadUrlOutputSchema)
    .query(async ({ ctx, input }): Promise<GetDownloadUrlResult> =>
      getDownloadUrl({
        orgId: ctx.orgId,
        fileObjectId: input.fileObjectId,
      }),
    ),

  listBySnapshot: authenticatedProcedure
    .input(listBySnapshotInputSchema)
    .output(listBySnapshotOutputSchema)
    .query(async ({ ctx, input }): Promise<ListBySnapshotResult> => {
      await assertSnapshotAccess({
        snapshotId: input.snapshotId,
        orgId: ctx.orgId,
      });
      return listBySnapshot({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
      });
    }),

  deleteFile: authenticatedProcedure
    .input(deleteFileInputSchema)
    .output(deleteFileOutputSchema)
    .mutation(async ({ ctx, input }): Promise<DeleteFileObjectResult> =>
      deleteFileObject({
        orgId: ctx.orgId,
        fileObjectId: input.fileObjectId,
      }),
    ),
});

export type StorageRouter = typeof storageRouter;
