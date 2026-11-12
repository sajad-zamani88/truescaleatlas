interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className={`logo ${compact ? 'logo--compact' : ''}`}>
      <svg
        className="logo__mark"
        viewBox="0 0 48 48"
        aria-hidden="true"
        role="img"
      >
        <rect x="1" y="1" width="46" height="46" rx="2" fill="none" />
        <path d="M8 34c5-8 9-3 13-10s7-4 9-11" fill="none" />
        <path d="M11 39c7-8 12 0 20-8 4-4 6-3 8-8" fill="none" />
        <circle cx="24" cy="24" r="13.5" fill="none" strokeDasharray="2 3" />
        <path d="M24 8v5M24 35v5M8 24h5M35 24h5" />
        <path
          d="M26.8 15.2c4.6 0 7.5 3.4 7.5 7.7 0 5.2-3.4 9.9-8.4 9.9-4.5 0-7.4-3.2-7.4-7.4 0-5.4 3.4-10.2 8.3-10.2Z"
          fill="var(--rust)"
          stroke="none"
        />
        <circle cx="24" cy="24" r="1.8" fill="var(--ink)" stroke="none" />
      </svg>
      {!compact && (
        <div className="logo__type">
          <span className="logo__word">TRUESCALE</span>
          <span className="logo__sub">Field Atlas</span>
        </div>
      )}
    </div>
  );
}
