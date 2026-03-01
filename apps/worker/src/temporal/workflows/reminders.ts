export async function reviewReminderWorkflow(compGroupId: string) {
  return {
    compGroupId,
    status: "scheduled",
  };
}
