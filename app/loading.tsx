import BrandLoader from "@/components/BrandLoader";

/**
 * Se ve al instante mientras una pantalla carga sus datos (antes, al tocar una
 * pestaña la app se quedaba quieta hasta que el servidor respondía).
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-[70vh] items-center justify-center bg-[#F2F2F7] pb-[83px] md:min-h-[60vh] md:bg-transparent md:pb-0"
      aria-busy="true"
    >
      <BrandLoader />
    </div>
  );
}
