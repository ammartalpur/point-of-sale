type OtaqBrandProps = {
  compact?: boolean;
  subtitle?: string;
  className?: string;
  inverted?: boolean;
};

export default function OtaqBrand({
  compact = false,
  subtitle = "Restaurant POS",
  className = "",
  inverted = false,
}: OtaqBrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="Otaq Restaurant">
      <svg
        viewBox="0 0 48 48"
        role="img"
        aria-hidden="true"
        className="h-11 w-11 shrink-0 drop-shadow-[0_7px_16px_rgba(217,121,43,0.2)]"
      >
        <defs>
          <linearGradient id="otaq-copper" x1="7" y1="4" x2="41" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F2B44C" />
            <stop offset="1" stopColor="#C85E24" />
          </linearGradient>
        </defs>
        <path d="M24 3.5 42 13.9v20.2L24 44.5 6 34.1V13.9L24 3.5Z" fill="url(#otaq-copper)" />
        <path d="M24 9.3 36.9 16.7v14.6L24 38.7l-12.9-7.4V16.7L24 9.3Z" fill="#211912" />
        <path d="M16.4 29.9V22a7.6 7.6 0 0 1 15.2 0v7.9h-4.1V22a3.5 3.5 0 1 0-7 0v7.9h-4.1Z" fill="#F8E9D2" />
        <path d="M14.7 31.1h18.6v3.1H14.7z" fill="#D9792B" />
        <path d="m24 11.7 2 2.1-2 2.1-2-2.1 2-2.1Zm-10 5.8 1.6 1.7-1.6 1.7-1.6-1.7 1.6-1.7Zm20 0 1.6 1.7-1.6 1.7-1.6-1.7 1.6-1.7Z" fill="#F2B44C" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className={`text-[1.05rem] font-black tracking-[0.2em] ${inverted ? "text-[#211912]" : "text-white"}`}>OTAQ</div>
          <div className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${inverted ? "text-[#6f4d32]" : "text-[#c9a77a]"}`}>{subtitle}</div>
        </div>
      )}
    </div>
  );
}
