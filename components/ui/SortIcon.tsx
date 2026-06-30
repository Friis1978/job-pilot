type Props = { active: boolean; dir: "asc" | "desc" };

export function SortIcon({ active, dir }: Props) {
  return (
    <span className={`inline-flex flex-col gap-[3px] ${active ? "text-accent" : "text-text-muted"}`}>
      <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className={active && dir === "asc" ? "opacity-100" : "opacity-30"}>
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className={active && dir === "desc" ? "opacity-100" : "opacity-30"}>
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  );
}
