type CountryFlagProps = {
  countryCode: string;
  className?: string;
  title?: string;
};

/** Inline SVG flags — no external files; emoji flags show as "PL"/"GB" on Windows. */
const FLAG_SVGS: Record<string, string> = {
  pl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="200" fill="#fff"/><rect y="200" width="640" height="200" fill="#dc143c"/></svg>`,
  gb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"><rect width="60" height="30" fill="#012169"/><path d="M0,0 60,30 M60,0 0,30" stroke="#fff" stroke-width="6"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M0,0 60,30 M60,0 0,30" stroke="#C8102E" stroke-width="3"/><path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg>`,
  de: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3"><rect width="5" height="1" y="0" fill="#000"/><rect width="5" height="1" y="1" fill="#DD0000"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg>`,
  es: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500"><rect width="750" height="500" fill="#c60b1e"/><rect y="125" width="750" height="250" fill="#ffc400"/></svg>`,
  jp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="900" height="600" fill="#fff"/><circle cx="450" cy="300" r="180" fill="#bc002d"/></svg>`,
  in: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="900" height="200" fill="#FF9933"/><rect y="200" width="900" height="200" fill="#fff"/><rect y="400" width="900" height="200" fill="#138808"/><circle cx="450" cy="300" r="60" fill="none" stroke="#000080" stroke-width="8"/></svg>`,
  kr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="900" height="600" fill="#fff"/><g transform="translate(450,300)"><path fill="#cd2e3a" d="M0,-90 A90,90 0 1,1 0,90 A45,45 0 1,0 0,-90"/><path fill="#0047a0" d="M0,-90 A90,90 0 1,0 0,90 A45,45 0 1,1 0,-90"/></g></svg>`,
  tw: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="900" height="600" fill="#fe0000"/><rect width="450" height="300" fill="#000095"/><circle cx="225" cy="150" r="60" fill="#fff"/><circle cx="225" cy="150" r="45" fill="#000095"/></svg>`,
  fr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="300" height="600" fill="#002395"/><rect x="300" width="300" height="600" fill="#fff"/><rect x="600" width="300" height="600" fill="#ED2939"/></svg>`,
};

export function CountryFlag({
  countryCode,
  className = "h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm",
  title,
}: CountryFlagProps) {
  const iso = countryCode.trim().toLowerCase();
  const svg = FLAG_SVGS[iso];

  if (!svg) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-white/20 text-[10px] font-bold uppercase text-white ${className}`}
        title={title}
      >
        {iso.toUpperCase()}
      </span>
    );
  }

  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  return (
    <img
      src={dataUrl}
      width={24}
      height={16}
      alt=""
      title={title}
      aria-hidden={title ? undefined : true}
      className={className}
      decoding="async"
    />
  );
}
