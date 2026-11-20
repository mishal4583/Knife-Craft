import type { CSSProperties } from "react";

/** Each picture's own width / height, so a wide window shows all of it (styles.css `.kc-banner`). */
const BANNER_RATIO = {
  "staff-banner.webp": 2.5,
  "suppliers-banner.webp": 2.5,
  "menu-banner.webp": 1440 / 540,
  "operations-banner.webp": 1440 / 540,
} as const;

/** Compact, matching image header shared by the Business detail tabs. */
export function BusinessSectionBanner({
  image,
  title,
}: {
  image: "staff-banner.webp" | "suppliers-banner.webp" | "menu-banner.webp" | "operations-banner.webp";
  title: string;
}) {
  return (
    <section
      className="kc-banner relative isolate h-[88px] overflow-hidden rounded-[20px] border border-walnut/20 bg-walnut-dark shadow-soft sm:h-[96px]"
      aria-label={title}
      style={{ "--kc-ratio": BANNER_RATIO[image], "--kc-short-h": "56px" } as CSSProperties}
    >
      <img
        src={`${import.meta.env.BASE_URL}business/${image}`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full select-none object-cover object-[center_52%]"
        draggable={false}
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-walnut-dark/65 via-walnut-dark/20 to-transparent"
        aria-hidden="true"
      />
      <div className="relative flex h-full items-center px-3.5 sm:px-4">
        <h2 className="rounded-[14px] border border-ivory/25 bg-walnut-dark/35 px-3 py-2 font-display text-[16px] font-black text-ivory shadow-soft backdrop-blur-sm sm:text-[18px]">
          {title}
        </h2>
      </div>
    </section>
  );
}
