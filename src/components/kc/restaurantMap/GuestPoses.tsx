/**
 * The small walking / sitting people drawn on the restaurant maps. Shared by
 * the first floor's guests (RestaurantMapView) and the Second Floor's cast
 * (FloorLife). Pure SVG; the poses are shown or hidden by the caller's CSS.
 */
export function GuestPoses({ outfit, hair }: { outfit: string; hair: string }) {
  return (
    <>
      <svg className="guest-pose guest-walking-pose" viewBox="0 0 24 32" focusable="false">
        <ellipse cx="12" cy="28.5" rx="5" ry="1.4" fill="#1c140e" opacity=".35" />
        <g
          className="guest-leg-swing guest-limb--left"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M10 19 9.4 23.3 9.1 24.7 10.1 25.2 11.1 24.5 10.7 23.5 11.5 19.4Z"
            fill="#765337"
            stroke="#3d2a1d"
            strokeWidth=".55"
          />
          <path
            d="M9.3 24.5q-1 .4-1.1 1.3 0 .7.8.8h2.2q.7-.1.3-.8l-.7-1Z"
            fill="#3c2b21"
            stroke="#2a1d15"
            strokeWidth=".45"
          />
        </g>
        <g
          className="guest-leg-swing guest-limb--right"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M14 19 14.6 23.3 14.9 24.7 13.9 25.2 12.9 24.5 13.3 23.5 12.5 19.4Z"
            fill="#765337"
            stroke="#3d2a1d"
            strokeWidth=".55"
          />
          <path
            d="M14.7 24.5q1 .4 1.1 1.3 0 .7-.8.8h-2.2q-.7-.1-.3-.8l.7-1Z"
            fill="#3c2b21"
            stroke="#2a1d15"
            strokeWidth=".45"
          />
        </g>
        <path
          d="M8.1 10.8q3.9-2.5 7.8 0l.5 8.5q-4.4 2-8.8 0z"
          fill={outfit}
          stroke="#382319"
          strokeWidth=".8"
        />
        <g
          className="guest-arm-swing guest-limb--left"
          fill="none"
          stroke="#d8aa87"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m8.3 12-.6 2 1.3 1.4" />
        </g>
        <g
          className="guest-arm-swing guest-limb--right"
          fill="none"
          stroke="#d8aa87"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15.7 12 .6 2-1.3 1.4" />
        </g>
        <circle cx="12" cy="5.7" r="3.6" fill="#d9aa89" stroke="#5b3d2b" strokeWidth=".8" />
        <path d="M8.4 5.7a3.6 3.6 0 0 1 7.2 0v.8q-2.2-1.3-4.1-.5-1.4.5-3.1.3z" fill={hair} />
      </svg>
      <svg className="guest-pose guest-sitting-pose" viewBox="0 0 24 32" focusable="false">
        <ellipse cx="12" cy="27.5" rx="4.4" ry="1.3" fill="#1c140e" opacity=".3" />
        <path
          d="M10 18.8v2.4q0 1.3 1.2 1.3h.5m2.3-3.7v2.4q0 1.3-1.2 1.3h-.5"
          fill="none"
          stroke="#42352b"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.1 10.8q3.9-2.5 7.8 0l.5 8.2q-4.4 2-8.8 0z"
          fill={outfit}
          stroke="#382319"
          strokeWidth=".8"
        />
        <path
          d="m8.3 12-1.2 2.1 2.3 3.5m5.2-5.6 1.2 2.1-2.3 3.5"
          fill="none"
          stroke="#d8aa87"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="5.7" r="3.6" fill="#d9aa89" stroke="#5b3d2b" strokeWidth=".8" />
        <path d="M8.4 5.7a3.6 3.6 0 0 1 7.2 0v.8q-2.2-1.3-4.1-.5-1.4.5-3.1.3z" fill={hair} />
      </svg>
    </>
  );
}
