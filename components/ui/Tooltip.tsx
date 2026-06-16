type Props = {
  content: string;
  children: React.ReactNode;
};

export function Tooltip({ content, children }: Props) {
  return (
    <span className="relative group/tooltip min-w-0">
      {children}
      <span
        role="tooltip"
        className="
          pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
          px-2.5 py-1.5 rounded-md bg-[#111] text-white text-xs leading-snug whitespace-nowrap
          opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150
          max-w-xs break-words whitespace-normal text-center
        "
      >
        {content}
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111]" />
      </span>
    </span>
  );
}
