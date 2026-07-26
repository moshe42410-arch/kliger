export interface DashboardCardDef {
  id: string;
  label: string;
  description: string;
  category: "pending" | "activity" | "info";
}

export const DASHBOARD_CARDS: DashboardCardDef[] = [
  {
    id: "waiting_client",
    label: "ממתין ללקוח",
    description: "תזכורות פעילות שעדיין ממתינות לתגובה של הלקוח",
    category: "pending",
  },
  {
    id: "waiting_advisor",
    label: "ממתין לטיפול יועץ",
    description: "לקוחות ששלחו אסמכתא או הגיבו וממתינים לטיפול שלך",
    category: "pending",
  },
  {
    id: "waiting_association",
    label: "ממתין לטיפול עמותה",
    description: "תזכורות שהועברו לעמותה הקשורה",
    category: "pending",
  },
  {
    id: "snoozed",
    label: "בהמתנה",
    description: "תזכורות שנדחו למועד מאוחר יותר",
    category: "pending",
  },
  {
    id: "carried_over",
    label: "מחודש קודם",
    description: "תזכורות פתוחות מחודשים קודמים",
    category: "pending",
  },
  {
    id: "resolved",
    label: "טופל החודש",
    description: "כל מה שסומן כטופל בחודש הנוכחי",
    category: "activity",
  },
  {
    id: "clients",
    label: "לקוחות פעילים",
    description: "מספר כלל הלקוחות במערכת",
    category: "info",
  },
  {
    id: "deposits",
    label: "הפקדות פעילות",
    description: "מספר ההפקדות הפעילות",
    category: "info",
  },
];

export const DEFAULT_DASHBOARD_CARDS = [
  "waiting_client",
  "waiting_advisor",
  "waiting_association",
  "snoozed",
  "carried_over",
];

export function getActiveDashboardCards(
  saved: string[] | null | undefined
): string[] {
  if (!saved || saved.length === 0) return DEFAULT_DASHBOARD_CARDS;
  const allowed = new Set(DASHBOARD_CARDS.map((c) => c.id));
  const filtered = saved.filter((s) => allowed.has(s));
  return filtered.length > 0 ? filtered : DEFAULT_DASHBOARD_CARDS;
}
