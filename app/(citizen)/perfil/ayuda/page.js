"use client";

import { useState } from "react";
import CitizenTopBar from "../../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../../components/civic/CitizenPageContainer";
import MaterialIcon from "../../../components/civic/MaterialIcon";

const FAQ_ITEMS = [
  {
    question: "¿Qué hace el botón de pánico?",
    answer:
      "Es para cuando estás en una situación de riesgo inmediato y necesitás ayuda urgente. Al tocarlo, tu ubicación se envía enseguida para que puedan asistirte lo antes posible. Usalo solo para emergencias reales, no como prueba.",
  },
  {
    question: "¿Cuándo conviene reportar un incidente en vez de usar el botón de pánico?",
    answer:
      "El botón de pánico es para algo que te está pasando a vos ahora mismo. Si viste algo que ocurrió o está ocurriendo pero no corrés peligro inmediato (un poste caído, un choque, un disturbio), es mejor hacer un reporte desde \"Reportar\". Así el equipo puede priorizar mejor los casos más urgentes.",
  },
  {
    question: "¿Qué significan los estados de una alerta?",
    answer:
      "PENDIENTE: se recibió tu alerta y está esperando revisión. VALIDADA: ya confirmaron que es una emergencia real. DESPACHADA: se asignó un equipo para atenderla. EN CAMINO: el equipo ya salió hacia tu ubicación. EN LUGAR: el equipo llegó a donde estás. RESUELTA: la situación ya se solucionó. CERRADA: el caso quedó cerrado definitivamente. CANCELADA: la alerta se canceló (por vos o por alguien autorizado). DESCARTADA: se determinó que no era una emergencia real.",
  },
  {
    question: "¿Cómo cancelo una alerta?",
    answer:
      "Entrá a \"Mis alertas\", abrí la que está activa y tocá cancelar. Podés hacerlo mientras siga en curso. Si ya hay un equipo en camino, igual te van a contactar para confirmar que estás bien.",
  },
  {
    question: "¿Qué pasa con mi ubicación?",
    answer:
      "Tu ubicación viaja cifrada y solo la ven quienes gestionan la emergencia. A las 72 horas se anonimiza automáticamente, así que no queda asociada a vos para siempre.",
  },
  {
    question: "¿Necesito estar registrado para usar el botón de pánico?",
    answer:
      "No, podés entrar de forma anónima y usarlo igual. Registrarte te sirve para guardar tus datos, tu contacto de emergencia y tus ubicaciones, así todo es más rápido la próxima vez.",
  },
  {
    question: "¿Qué pasa si activo el botón de pánico por error?",
    answer:
      "Tranquilo, cancelala al toque desde \"Mis alertas\". Si ya salió un equipo, de todas formas te van a contactar para confirmar que está todo bien.",
  },
  {
    question: "¿A quién puedo contactar si tengo un problema con la app?",
    answer:
      "Ante cualquier duda o problema con la app, podés escribir a soporte de CityPass+. Y para una emergencia real, siempre usá el botón de pánico o llamá al 911.",
  },
];

export default function AyudaPage() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <>
      <CitizenTopBar showBack backHref="/perfil" title="Ayuda" />

      <CitizenPageContainer>
        <p className="text-sm text-on-surface-variant">
          Estas son las dudas más comunes sobre CityPass+ Emergencias. Tocá
          una pregunta para ver la respuesta.
        </p>

        <section className="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-ambient-lvl2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const buttonId = `faq-button-${i}`;
            const panelId = `faq-panel-${i}`;
            return (
              <div
                key={item.question}
                className={i > 0 ? "border-t border-outline-variant/50" : ""}
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(i)}
                    className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-surface-container-low cursor-pointer transition-colors"
                  >
                    <span className="flex-1 text-sm font-semibold text-on-surface">
                      {item.question}
                    </span>
                    <MaterialIcon
                      name={isOpen ? "expand_less" : "expand_more"}
                      className="text-on-surface-variant shrink-0"
                      size={20}
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="px-4 pb-4"
                >
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      </CitizenPageContainer>
    </>
  );
}
