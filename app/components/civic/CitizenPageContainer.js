/**
 * Único contenedor de contenido para todas las páginas del ciudadano.
 * Antes cada página definía su propio ancho (max-w-3xl, max-w-[1280px], sin
 * tope en /reportar, dos contenedores anidados en /perfil/datos); ahora lo
 * usan todas para que el ancho sea consistente.
 */
export default function CitizenPageContainer({ children, className = "" }) {
  return (
    <main className={`mx-auto w-full max-w-3xl p-4 md:p-8 flex-1 flex flex-col gap-6 ${className}`.trim()}>
      {children}
    </main>
  );
}
