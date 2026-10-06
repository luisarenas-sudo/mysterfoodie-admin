/**
 * Esqueleto que se ve al instante mientras una pantalla carga sus datos
 * (app/loading.tsx). Sin esto, al tocar una pestaña la app se quedaba
 * quieta hasta que el servidor respondía y parecía que el toque no había
 * hecho nada.
 */
function Bar({ w, h = 14, className = "" }: { w: string | number; h?: number; className?: string }) {
  return (
    <div
      className={`mf-skeleton rounded-lg ${className}`}
      style={{ width: w, height: h, background: "rgba(60,60,67,0.1)" }}
    />
  );
}

export default function PageSkeleton() {
  return (
    <>
      <div className="md:hidden min-h-[70vh]" style={{ background: "#F2F2F7" }} aria-busy="true" aria-label="Cargando">
        <div className="px-5 pb-3 pt-5">
          <Bar w={92} h={10} />
          <Bar w={170} h={30} className="mt-2.5" />
        </div>
        <div className="mx-5 mt-2 flex gap-3">
          <div className="card flex-1 p-4">
            <Bar w={44} h={26} />
            <Bar w={86} h={11} className="mt-2.5" />
          </div>
          <div className="card flex-1 p-4">
            <Bar w={44} h={26} />
            <Bar w={86} h={11} className="mt-2.5" />
          </div>
        </div>
        <div className="card mx-5 mt-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-[13px]">
              <div className="mf-skeleton h-10 w-10 flex-shrink-0 rounded-full" style={{ background: "rgba(60,60,67,0.1)" }} />
              <div className="flex-1">
                <Bar w="60%" h={13} />
                <Bar w="35%" h={10} className="mt-2" />
              </div>
              <Bar w={44} h={22} />
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto hidden max-w-5xl px-6 py-10 md:block" aria-busy="true" aria-label="Cargando">
        <Bar w={220} h={28} />
        <div className="card mt-6 p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} w="100%" h={14} className="my-3" />
          ))}
        </div>
      </main>
    </>
  );
}
