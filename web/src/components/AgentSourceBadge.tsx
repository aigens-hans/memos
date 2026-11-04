import { Hash, Mail, MessageCircle, MessagesSquare, Phone } from "lucide-react";

const sources = {
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, color: "text-emerald-700 dark:text-emerald-400" },
  slack: { label: "Slack", Icon: Hash, color: "text-purple-700 dark:text-purple-400" },
  zoho_cliq: { label: "Zoho Cliq", Icon: MessagesSquare, color: "text-amber-700 dark:text-amber-400" },
  gmail_work: { label: "Email · Work", Icon: Mail, color: "text-blue-700 dark:text-blue-400" },
  gmail_personal: { label: "Email · Personal", Icon: Mail, color: "text-blue-700 dark:text-blue-400" },
  gmail: { label: "Email", Icon: Mail, color: "text-blue-700 dark:text-blue-400" },
  email: { label: "Email", Icon: Mail, color: "text-blue-700 dark:text-blue-400" },
} as const;

export default function AgentSourceBadge({ source }: { source?: string }) {
  const normalized = source?.trim().toLowerCase();
  const known = normalized && Object.hasOwn(sources, normalized) ? sources[normalized as keyof typeof sources] : null;
  const label = known?.label ?? (source?.trim().replaceAll("_", " ") || "Unknown source");
  const Icon = known?.Icon ?? MessagesSquare;
  return (
    <span
      role="img"
      aria-label={`Source: ${label}`}
      title={label}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-medium text-foreground/80"
    >
      <span aria-hidden="true" className={`relative inline-flex ${known?.color ?? "text-muted-foreground"}`}>
        <Icon size={14} strokeWidth={1.8} />
        {normalized === "whatsapp" && <Phone size={7} className="absolute left-[3.5px] top-[3px]" strokeWidth={2} />}
      </span>
      <span>{label}</span>
    </span>
  );
}
