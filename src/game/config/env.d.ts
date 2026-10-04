/** Build-time variables this game reads (Vite inlines them). */
interface ImportMetaEnv {
  /** "1" only in a restaurant test build; see restaurantMode.ts. */
  readonly VITE_RESTAURANT_MODE?: string;
}
