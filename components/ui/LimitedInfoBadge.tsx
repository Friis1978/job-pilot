import { Tooltip } from "@/components/ui/Tooltip";
import { LOW_INFO_SCORE_CAP, isLowInformation } from "@/lib/utils";

/**
 * Marks a job whose posting text is only an aggregator snippet, so its match
 * score is capped and cannot be trusted the way a fully-scored job's can.
 *
 * Renders nothing when the job has enough text — callers can drop it in
 * unconditionally.
 */
export function LimitedInfoBadge({
  wordCount,
  className = "",
}: {
  wordCount: number | null | undefined;
  className?: string;
}) {
  if (!isLowInformation(wordCount ?? 0)) return null;

  return (
    <Tooltip
      content={`Only ${wordCount ?? 0} words of this posting were available — job boards return a truncated snippet and the full page blocks automated access. Requirements may be missing, so the match score is capped at ${LOW_INFO_SCORE_CAP}. Open the original posting to check.`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-secondary text-warning border border-warning/30 w-fit cursor-help ${className}`}
      >
        Limited info
      </span>
    </Tooltip>
  );
}
