/** Minimal client-side tRPC types (avoids importing API router). */
export type AuthUser = {
  userId: string;
  orgId: string;
  role: string;
  isSuperUser: boolean;
  email: string;
  fullName: string;
};

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
    getDownloadUrl: {
      query: (input: { fileObjectId: string }) => Promise<{
        downloadUrl: string;
        expiresAt: Date;
      }>;
    };
    getSourceDocuments: {
      query: (input: { snapshotId: string }) => Promise<{
        documents: Array<{
          id: string;
          fileObjectId: string;
          filename: string;
          fileExtension: string | null;
          documentType: string;
          fileSizeBytes: number;
        }>;
      }>;
    };
    getDocumentById: {
      query: (input: { documentId: string }) => Promise<{
        id: string;
        fileObjectId: string;
        filename: string;
        fileExtension: string | null;
        fileSizeBytes: number;
      } | null>;
    };
    deleteFile: {
      mutate: (input: { fileObjectId: string }) => Promise<{
        fileObjectId: string;
        status: string;
      }>;
    };
  };
  operations: {
    getRunsBySnapshot: {
      query: (input: { snapshotId: string; limit?: number }) => Promise<{
        runs: Array<{
          id: string;
          name: string;
          status: "running" | "completed" | "failed";
          createdByName: string;
          createdAt: Date;
          updatedAt: Date;
        }>;
      }>;
    };
    getRunOperations: {
      query: (input: { runId: string }) => Promise<{
        operations: Array<{
          id: string;
          operationIndex: number;
          operationType: string;
          parametersJson: unknown;
          parentOperationId: string | null;
          supersedesOperationId: string | null;
          documentId: string | null;
          createdAt: Date;
        }>;
      }>;
    };
    getOperationCaptures: {
      query: (input: { runId: string; operationId: string }) => Promise<{
        captures: Array<{
          id: string;
          captureType: string;
          payloadJson: unknown;
          summaryText: string | null;
          createdAt: Date;
        }>;
      }>;
    };
    generateOperationLabel: {
      mutate: (input: { runId: string; operationId: string }) => Promise<{ label: string }>;
    };
    analyzeComparison: {
      mutate: (input: { runId: string; operationIds: string[] }) => Promise<{ narrative: string }>;
    };
    setOperationNote: {
      mutate: (input: { runId: string; operationId: string; noteText: string }) => Promise<{
        deleted: boolean;
        noteText: string | null;
      }>;
    };
    getOperationNote: {
      query: (input: { runId: string; operationId: string }) => Promise<{
        noteText: string | null;
        updatedAt: Date | null;
      }>;
    };
  };
  chat: {
    sendMessage: {
      mutate: (input: {
        snapshotId: string;
        runId: string | null;
        operationId?: string | null;
        messages: Array<{ role: "user" | "assistant"; text: string }>;
        selectedRange?: string | null;
      }) => Promise<{
        reply: string;
        excelAction?: {
          type: "write_range";
          startCell: string;
          values: unknown[][];
          sheetName?: string;
          description: string;
        } | null;
      }>;
    };
  };
  invitations: {
    createOrgInvite: {
      mutate: (input: {
        organizationName: string;
        inviteEmail: string;
      }) => Promise<{
        organizationId: string;
        organizationName: string;
        inviteEmail: string;
        expiresAt: Date;
      }>;
    };
    getInfo: {
      query: (input: { token: string }) => Promise<
        | {
            valid: true;
            organizationName: string;
            inviteEmail: string;
            expiresAt: Date;
            organizationStatus: "pending" | "active" | "inactive" | "archived";
          }
        | {
            valid: false;
            reason: "not_found" | "expired" | "used";
          }
      >;
    };
    accept: {
      mutate: (input: {
        token: string;
        fullName: string;
        password: string;
      }) => Promise<{
        ok: true;
        organizationName: string;
        inviteEmail: string;
      }>;
    };
    joinWithToken: {
      mutate: (input: { token: string }) => Promise<{
        ok: true;
        organizationName: string;
        inviteEmail: string;
      }>;
    };
  };
  settings: {
    members: {
      list: {
        query: () => Promise<{
          members: Array<{
            membershipId: string;
            userId: string;
            email: string;
            fullName: string;
            role: "admin" | "manager" | "analyst";
            status: "active" | "invited" | "suspended";
            joinedAt: Date | null;
          }>;
          pendingInvites: Array<{
            id: string;
            email: string;
            role: "admin" | "manager" | "analyst";
            expiresAt: Date;
            invitedAt: Date;
          }>;
        }>;
      };
      invite: {
        mutate: (input: {
          inviteEmail: string;
          role?: "admin" | "manager" | "analyst";
        }) => Promise<{ inviteEmail: string; expiresAt: Date }>;
      };
      cancelInvite: {
        mutate: (input: { invitationId: string }) => Promise<void>;
      };
      remove: {
        mutate: (input: { targetUserId: string }) => Promise<void>;
      };
      updateRole: {
        mutate: (input: {
          targetUserId: string;
          role: "admin" | "manager" | "analyst";
        }) => Promise<void>;
      };
    };
  };
};

