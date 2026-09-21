/**
 * Máquina de estados del Botón Antipánico "sin modal": cuenta regresiva de
 * unos segundos con opción de cancelar, resolución en paralelo de la
 * ubicación (obligatoria) y la dirección legible (opcional, con timeout), y
 * el envío final al backend cuando la cuenta llega a cero.
 *
 * Es una función pura sin React ni DOM: recibe los timers y las funciones de
 * red por parámetro, así se puede testear con timers falsos (vi.useFakeTimers)
 * sin necesidad de renderizar componentes. `InicioClient` (app/(citizen)/inicio)
 * la envuelve con un `useState`/`useEffect` fino para pintar la UI.
 *
 * Fases del estado (`phase`):
 *   idle      → estado inicial / en reposo, listo para iniciar.
 *   counting  → cuenta regresiva en curso, cancelable.
 *   sending   → cuenta terminada, esperando la respuesta del backend.
 *   success   → el backend confirmó la alerta (`result` con el payload).
 *   error     → falló la ubicación o el envío (`error` con el motivo);
 *               vuelve a "idle" automáticamente para reintentar.
 */

export const SOS_COUNTDOWN_SECONDS = 3;
export const SOS_ADDRESS_TIMEOUT_MS = 2500;

const INITIAL_STATE = Object.freeze({
  phase: "idle",
  secondsLeft: SOS_COUNTDOWN_SECONDS,
  error: null,
  result: null,
});

/**
 * @param {object} deps
 * @param {() => Promise<{latitude:number, longitude:number}>} deps.getCurrentLocation
 *   Debe resolver con la ubicación o rechazar si no se pudo obtener.
 * @param {(lat:number, lng:number) => Promise<string|null>} deps.reverseGeocode
 *   Dirección legible; puede tardar o devolver null, nunca bloquea el envío.
 * @param {(location:{latitude:number, longitude:number}, address:string|null) => Promise<any>} deps.onSubmit
 *   Dispara el alta de la emergencia (ej. triggerPanicButton) con la
 *   ubicación resuelta y la dirección (o null si no llegó a tiempo).
 * @param {(state:object) => void} [deps.onStateChange] Notificado en cada transición.
 * @param {number} [deps.countdownSeconds] Default 3.
 * @param {number} [deps.addressTimeoutMs] Default 2500.
 * @param {typeof setTimeout} [deps.setTimeoutFn]
 * @param {typeof clearTimeout} [deps.clearTimeoutFn]
 * @param {typeof setInterval} [deps.setIntervalFn]
 * @param {typeof clearInterval} [deps.clearIntervalFn]
 */
export function createSosController({
  getCurrentLocation,
  reverseGeocode,
  onSubmit,
  onStateChange,
  countdownSeconds = SOS_COUNTDOWN_SECONDS,
  addressTimeoutMs = SOS_ADDRESS_TIMEOUT_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  let state = { ...INITIAL_STATE, secondsLeft: countdownSeconds };
  let intervalId = null;
  let finishTimeoutId = null;
  let addressTimeoutId = null;
  let locationTask = null;
  let addressResolved = false;
  let addressValue = null;

  function setState(patch) {
    state = { ...state, ...patch };
    onStateChange?.(state);
  }

  function getState() {
    return state;
  }

  function clearTimers() {
    if (intervalId !== null) clearIntervalFn(intervalId);
    if (finishTimeoutId !== null) clearTimeoutFn(finishTimeoutId);
    if (addressTimeoutId !== null) clearTimeoutFn(addressTimeoutId);
    intervalId = null;
    finishTimeoutId = null;
    addressTimeoutId = null;
  }

  function abortWithError(error) {
    clearTimers();
    setState({ ...INITIAL_STATE, secondsLeft: countdownSeconds, error });
  }

  /** Inicia la cuenta regresiva. No-op si ya está en curso o enviando. */
  function start() {
    if (state.phase === "counting" || state.phase === "sending") return;

    addressResolved = false;
    addressValue = null;
    setState({
      phase: "counting",
      secondsLeft: countdownSeconds,
      error: null,
      result: null,
    });

    locationTask = Promise.resolve()
      .then(() => getCurrentLocation())
      .catch((err) => {
        if (state.phase === "counting") abortWithError(err);
        // Re-lanzamos para que `finish()` (si ya estaba en vuelo) no use un
        // valor inválido; el catch de abajo en finish() lo ignora porque el
        // estado ya no es "counting".
        throw err;
      });
    // Evita "unhandled rejection" cuando abortWithError ya manejó el error.
    locationTask.catch(() => {});

    locationTask
      .then((location) => reverseGeocode(location.latitude, location.longitude))
      .then((label) => {
        if (!addressResolved) {
          addressResolved = true;
          addressValue = label ?? null;
        }
      })
      .catch(() => {
        if (!addressResolved) {
          addressResolved = true;
          addressValue = null;
        }
      });

    addressTimeoutId = setTimeoutFn(() => {
      addressTimeoutId = null;
      addressResolved = true;
    }, addressTimeoutMs);

    intervalId = setIntervalFn(() => {
      if (state.phase !== "counting") return;
      setState({ secondsLeft: Math.max(0, state.secondsLeft - 1) });
    }, 1000);

    finishTimeoutId = setTimeoutFn(() => {
      finishTimeoutId = null;
      finish();
    }, countdownSeconds * 1000);
  }

  async function finish() {
    if (state.phase !== "counting") return;
    if (intervalId !== null) {
      clearIntervalFn(intervalId);
      intervalId = null;
    }
    setState({ phase: "sending", secondsLeft: 0 });
    try {
      const location = await locationTask;
      const address = addressResolved ? addressValue : null;
      const result = await onSubmit(location, address);
      setState({ phase: "success", result });
    } catch (err) {
      setState({ ...INITIAL_STATE, secondsLeft: countdownSeconds, error: err });
    }
  }

  /** Cancela la cuenta regresiva: no se llama al backend. */
  function cancel() {
    if (state.phase !== "counting") return;
    clearTimers();
    setState({ ...INITIAL_STATE, secondsLeft: countdownSeconds });
  }

  /** Vuelve al estado inicial (ej. después de mostrar un error o éxito). */
  function reset() {
    clearTimers();
    setState({ ...INITIAL_STATE, secondsLeft: countdownSeconds });
  }

  return { start, cancel, reset, getState };
}
