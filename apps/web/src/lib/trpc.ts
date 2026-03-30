import { createTRPCClient, httpBatchLink } from "@trpc/client";

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Minimal type for auth procedures (avoids importing API router). */
export type AuthUser = { userId: string; orgId: string; role: string };

export type AuthTRPC = {
  auth: {
    login: {
      mutate: (input: {
        email: string;
        password: string;
      }) => Promise<{ ok: true; user: AuthUser }>;
    };
    me: { query: () => Promise<AuthUser | null> };
    logout: { mutate: () => Promise<{ ok: true }> };
  };
  organizations: {
    myOrg: {
      query: () => Promise<{ id: string; name: string; status: string } | null>;
    };
    myClients: {
      query: () => Promise<
        Array<{
          id: string;
          name: string;
          status: "active" | "archived";
        }>
      >;
    };
    mySnapshots: {
      query: () => Promise<
        Array<{
          id: string;
          clientId: string;
          label: string;
          accountingPeriod: string | null;
          status: "draft" | "ingesting" | "ready" | "failed";
          createdAt: Date;
        }>
      >;
    };
  };
  ingestion: {
    createSnapshot: {
      mutate: (input: {
        clientId?: string;
        label: string;
        accountingPeriod?: string;
      }) => Promise<{
        snapshotId: string;
        status: "draft" | "ingesting" | "ready" | "failed";
      }>;
    };
    startDocumentIngestion: {
      mutate: (input: {
        snapshotId: string;
        documentId: string;
      }) => Promise<{
        documentId: string;
        profileStatus: "pending" | "completed" | "failed";
        aiStatus: "pending" | "completed" | "failed";
        documentType: "claims" | "policies" | "loss_triangles" | "workbook_tool" | "other";
        aiClassification:
          | "claims"
          | "policies"
          | "loss_triangles"
          | "workbook_tool"
          | "other"
          | "unknown";
        sheetCount: number;
        triangleCount: number;
        insightCount: number;
        errorText: string | null;
      }>;
    };
    getDocumentIngestionStatus: {
      query: (input: {
        snapshotId: string;
        documentId: string;
      }) => Promise<{
        documentId: string;
        profileStatus: "pending" | "completed" | "failed";
        aiStatus: "pending" | "completed" | "failed";
        documentType: "claims" | "policies" | "loss_triangles" | "workbook_tool" | "other";
        aiClassification:
          | "claims"
          | "policies"
          | "loss_triangles"
          | "workbook_tool"
          | "other"
          | "unknown";
        sheetCount: number;
        triangleCount: number;
        insightCount: number;
        errorText: string | null;
      }>;
    };
  };
  storage: {
    getUploadUrl: {
      mutate: (input: {
        snapshotId: string;
        fileName: string;
        contentType: string;
        sizeBytes: number;
      }) => Promise<{
        bucket: string;
        objectKey: string;
        uploadUrl: string;
        expiresAt: Date;
      }>;
    };
    completeUpload: {
      mutate: (input: {
        snapshotId: string;
        bucket: string;
        objectKey: string;
        fileName: string;
        contentType: string;
        sizeBytes: number;
        sha256?: string;
      }) => Promise<{ fileObjectId: string; documentId: string; status: string }>;
    };
    listBySnapshot: {
      query: (input: { snapshotId: string }) => Promise<
        Array<{
          id: string;
          fileName: string;
          contentType: string;
          sizeBytes: number;
          createdAt: Date;
        }>
      >;
    };
    deleteFile: {
      mutate: (input: { fileObjectId: string }) => Promise<{
        fileObjectId: string;
        status: string;
      }>;
    };
  };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = createTRPCClient<any>({
  links: [
    httpBatchLink({
      url: `${getApiUrl()}/trpc`,
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

export const trpc = client as unknown as AuthTRPC;

