type CountryFlagProps = {
  countryCode: string;
  className?: string;
  title?: string;
};

/** Renders a small flag image (works on Windows; emoji flags often show as "PL", "GB" letters). */
export function CountryFlag({ countryCode, className = "h-3.5 w-5 shrink-0 rounded-sm object-cover", title }: CountryFlagProps) {
  const iso = countryCode.trim().toLowerCase();
  if (!iso) return null;

  return (
    <img
      src={`https://flagcdn.com/24x18/${iso}.png`}
      srcSet={`https://flagcdn.com/48x36/${iso}.png 2x`}
      width={20}
      height={15}
      alt=""
      title={title}
      aria-hidden={title ? undefined : true}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
