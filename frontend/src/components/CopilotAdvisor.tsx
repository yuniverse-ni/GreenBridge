import React from 'react';

interface CopilotAdvisorProps {
  variant?: 'presenter' | 'avatar';
}

/** Local flat-vector advisor, shared by recommendation and conversation views. */
export const CopilotAdvisor: React.FC<CopilotAdvisorProps> = ({ variant = 'presenter' }) => {
  const avatar = variant === 'avatar';
  return (
    <svg
      className={`gb-advisor gb-advisor-${variant}`}
      viewBox={avatar ? '20 2 80 72' : '0 0 120 132'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={avatar ? undefined : 'img'}
      aria-label={avatar ? undefined : 'GreenBridge advisor holding a finance and sustainability report'}
      aria-hidden={avatar ? true : undefined}
      focusable="false"
    >
      <ellipse cx="60" cy="125" rx="40" ry="4" fill="#E4EDE6" />
      {/* Tailored jacket and a relaxed presenting hand. */}
      <path d="M30 89C30 72 42 66 60 66C78 66 90 75 90 92L94 122H26L30 89Z" fill="#2D6956" />
      <path d="M51 67H69L65 99H55L51 67Z" fill="#F5F3E8" />
      <path d="M48 68L42 83L53 88L50 94L57 111M72 68L78 83L67 88" stroke="#184B3D" strokeWidth="2" strokeLinejoin="round" />
      <path d="M35 85L24 99L12 91" stroke="#2D6956" strokeWidth="12" strokeLinecap="round" />
      <path d="M13 92L9 85M13 92L18 85" stroke="#D89D78" strokeWidth="6" strokeLinecap="round" />
      <path d="M54 58H66V71C63 76 57 76 54 71V58Z" fill="#CA8867" />
      {/* Softly rounded face, swept hair and understated smile. */}
      <path d="M35 35C33 15 44 7 60 7C79 7 88 19 85 39L79 53H40L35 35Z" fill="#273D35" />
      <circle cx="37" cy="42" r="5" fill="#D89D78" />
      <circle cx="83" cy="42" r="5" fill="#D89D78" />
      <path d="M39 29C49 31 62 24 67 19C71 26 76 29 81 30V45C81 59 71 68 60 68C48 68 39 58 39 45V29Z" fill="#E3AE89" />
      <path d="M46 37L52 36M68 36L74 37" stroke="#314239" strokeWidth="2" strokeLinecap="round" />
      <circle cx="49" cy="43" r="1.8" fill="#273D35" />
      <circle cx="71" cy="43" r="1.8" fill="#273D35" />
      <path d="M60 43L58 49H61" stroke="#BF8060" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M53 55C57 59 63 59 67 55" stroke="#784B3E" strokeWidth="2" strokeLinecap="round" />
      {/* A small report with a chart and leaf keeps the identity product-specific. */}
      <rect x="63" y="83" width="37" height="39" rx="3" fill="#F8FAF5" stroke="#BED2C4" strokeWidth="1.5" />
      <path d="M70 113V107M77 113V102M84 113V98" stroke="#4C8968" strokeWidth="4" />
      <path d="M88 97C85 90 90 87 96 88C96 94 93 98 88 97Z" fill="#92B56F" />
      <path d="M87 100L93 91" stroke="#527E50" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M92 110L98 108" stroke="#D89D78" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
};
