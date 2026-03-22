'use client';

interface LogoProps {
  size?: number;       // icon size in px
  variant?: 'full' | 'icon';  // full = icon + wordmark, icon = icon only
  dark?: boolean;      // true = white wordmark (for dark/coloured backgrounds)
  tagline?: boolean;   // show "GST · ROC · PF-ESI" subtitle
}

export function Logo({ size = 36, variant = 'full', dark = false, tagline = false }: LogoProps) {
  const fontSize = Math.round(size * 0.58);
  const taglineSize = Math.round(size * 0.28);

  const icon = (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="56" height="56" rx="14" fill="#4f46e5"/>
      <path d="M16 12h16l8 8v24a2 2 0 01-2 2H16a2 2 0 01-2-2V14a2 2 0 012-2z" fill="white" fillOpacity="0.15"/>
      <path d="M16 12h16l8 8v24a2 2 0 01-2 2H16a2 2 0 01-2-2V14a2 2 0 012-2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M32 12v8h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 31l4 4 9-9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  if (variant === 'icon') return icon;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.25) }}>
      {icon}
      <div>
        <div style={{ fontSize, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>
          <span style={{ color: dark ? 'white' : '#1e293b' }}>compli</span>
          <span style={{ color: dark ? '#a5b4fc' : '#4f46e5' }}>file</span>
        </div>
        {tagline && (
          <div style={{
            fontSize: taglineSize,
            color: dark ? '#64748b' : '#94a3b8',
            letterSpacing: '0.05em',
            marginTop: 2,
          }}>
            GST · ROC · PF-ESI
          </div>
        )}
      </div>
    </div>
  );
}
