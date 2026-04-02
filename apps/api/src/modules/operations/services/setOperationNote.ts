import { eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperationNotes } from "@db/schema";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type SetOperationNoteInput = {
  orgId: string;
  userId: string;
  runId: string;
  operationId: string;
  noteText: string; // empty string → delete the note
};

export type SetOperationNoteResult = {
  deleted: boolean;
  noteText: string | null;
};

export async function setOperationNote(
  input: SetOperationNoteInput,
): Promise<SetOperationNoteResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  if (!input.noteText.trim()) {
    await db
      .delete(runOperationNotes)
      .where(eq(runOperationNotes.runOperationId, input.operationId));
    return { deleted: true, noteText: null };
  }

  await db
    .insert(runOperationNotes)
    .values({
      runOperationId: input.operationId,
      orgId: input.orgId,
      authorUserId: input.userId,
      noteText: input.noteText.trim(),
    })
    .onConflictDoUpdate({
      target: runOperationNotes.runOperationId,
      set: {
        noteText: input.noteText.trim(),
        authorUserId: input.userId,
        updatedAt: new Date(),
      },
    });

  return { deleted: false, noteText: input.noteText.trim() };
}
