export type SourceAccount = {
  payerName: string;
  accountHolder: string;
  bank: string;
  branch: string;
  amount: string;
};

export function sourceAccountOf(input: {
  sourcePayerName?: string | null;
  sourceAccountHolder?: string | null;
  sourceBank?: string | null;
  sourceBranch?: string | null;
  sourceAmount?: string | null;
}): SourceAccount {
  return {
    payerName: (input.sourcePayerName || "").trim(),
    accountHolder: (input.sourceAccountHolder || "").trim(),
    bank: (input.sourceBank || "").trim(),
    branch: (input.sourceBranch || "").trim(),
    amount: (input.sourceAmount || "").trim(),
  };
}

export function sourceAccountComplete(account: SourceAccount): boolean {
  return Boolean(
    account.accountHolder && account.bank && account.branch && account.amount
  );
}

export function sourceAccountLines(account: SourceAccount): string {
  const lines = [
    account.payerName ? `שם המעביר: ${account.payerName}` : "",
    account.accountHolder ? `שם בעל החשבון: ${account.accountHolder}` : "",
    account.bank ? `בנק: ${account.bank}` : "",
    account.branch ? `סניף: ${account.branch}` : "",
    account.amount ? `סכום: ${account.amount}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export const SOURCE_PROMPT =
  "בקישור נא למלא את שם המעביר להעברה הזו. את פרטי החשבון להעברת המילגה — שם בעל החשבון, בנק, סניף וסכום — ממלאים פעם אחת, והם נשמרים בכרטיס.";

export const PAYER_EACH_TIME_PROMPT =
  "נא למלא בקישור את שם המעביר להעברה הזו.";
