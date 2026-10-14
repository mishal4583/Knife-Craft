/** Compact green cash-stack mark for the game's single USD wallet. */
export function CashStackIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 48 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Offset bill edges make the icon read as a small stack at wallet size. */}
      <path d="m7 16 28-7 7 18-28 8-7-19Z" fill="#126D1E" />
      <path d="m6 12 29-7 7 18-29 8-7-19Z" fill="#249326" />
      <path d="m4 8 29-6 9 18-29 8L4 8Z" fill="#42C72C" stroke="#A8F56A" strokeWidth="1.8" />
      <path d="m8 10 23-5 6 12-23 6-6-13Z" fill="#39B92B" stroke="#C4FF7A" strokeWidth="1" />
      <path d="M7.5 10.5c2.5-.7 4-2.4 4-4.2M31.7 5.2c.7 2.4 2.4 3.8 4.4 4.1M13.7 22.8c-.4-2.2-2-3.5-4.3-3.8" stroke="#168425" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="23.5" cy="13.1" r="6.3" fill="#259B24" stroke="#A2F65C" strokeWidth="1.2" />
      <text x="23.5" y="17.2" textAnchor="middle" fill="#C5FF73" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="800">$</text>
      <path d="m7 29 28-7 2 4-28 8-2-5Z" fill="#0F741B" opacity=".9" />
      <path d="m12 33 28-8 2 4-28 8-2-4Z" fill="#32A925" />
    </svg>
  );
}
