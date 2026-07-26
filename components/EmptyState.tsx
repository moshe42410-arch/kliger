import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Tone = "gold" | "blue" | "green" | "amber" | "purple" | "rose";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: Tone;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

const toneStyles: Record<Tone, { iconBg: string; blob: string }> = {
  gold: {
    iconBg: "kpi-icon gold",
    blob: "bg-gold-400/20",
  },
  blue: {
    iconBg: "kpi-icon blue",
    blob: "bg-navy-400/25",
  },
  green: {
    iconBg: "kpi-icon green",
    blob: "bg-emerald-400/25",
  },
  amber: {
    iconBg: "kpi-icon amber",
    blob: "bg-amber-400/25",
  },
  purple: {
    iconBg: "kpi-icon purple",
    blob: "bg-purple-400/25",
  },
  rose: {
    iconBg: "kpi-icon rose",
    blob: "bg-red-400/25",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "gold",
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const styles = toneStyles[tone];
  const ActionIcon = action?.icon;

  return (
    <div
      className={`card text-center py-14 px-6 relative overflow-hidden animate-fade-in-up ${className}`}
    >
      {/* Decorative blob */}
      <div
        className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-50 animate-blob-drift ${styles.blob}`}
        aria-hidden
      />
      <div
        className={`absolute -bottom-32 -left-16 w-64 h-64 rounded-full blur-3xl opacity-30 ${styles.blob}`}
        aria-hidden
      />

      <div className="relative">
        <div
          className={`inline-flex p-5 rounded-2xl mb-5 ${styles.iconBg}`}
          aria-hidden
        >
          <Icon size={30} />
        </div>
        <h3 className="text-fluid-xl font-heading font-bold text-navy-950 mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-navy-700 max-w-md mx-auto mb-6">{description}</p>
        )}
        {(action || secondaryAction) && (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {action && renderAction(action, "primary", ActionIcon)}
            {secondaryAction && renderAction(secondaryAction, "ghost")}
          </div>
        )}
      </div>
    </div>
  );
}

function renderAction(
  action: NonNullable<EmptyStateProps["action" | "secondaryAction"]>,
  variant: "primary" | "ghost",
  Icon?: LucideIcon
) {
  const cls = variant === "primary" ? "btn-primary" : "btn-ghost";
  const content = (
    <>
      {Icon && <Icon size={18} />}
      {action.label}
    </>
  );
  if (action.href) {
    return (
      <Link href={action.href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {content}
    </button>
  );
}
