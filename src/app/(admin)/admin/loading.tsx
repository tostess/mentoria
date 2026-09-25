/**
 * O que aparece enquanto uma tela do admin carrega: a forma da página, não um
 * spinner. Blocos parados de propósito — o sistema de design reserva
 * movimento para presente e extensão, e um esqueleto pulsando seria o terceiro.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="mb-7 flex flex-col gap-2.5">
        <div className="h-2.5 w-24 rounded-full bg-[#F3E4EC]" />
        <div className="h-9 w-64 max-w-full rounded-[10px] bg-[#FCEDF4]" />
        <div className="h-3 w-96 max-w-full rounded-full bg-[#F3E4EC]" />
      </div>
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <div className="h-72 rounded-[14px] border border-[#F3E4EC] bg-white" />
        <div className="h-48 rounded-[14px] border border-[#F3E4EC] bg-white" />
      </div>
    </div>
  );
}
