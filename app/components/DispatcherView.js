"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ActionIcon, Badge, Group, ScrollArea, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconChevronLeft,
  IconChevronRight,
  IconArrowsHorizontal,
} from "@tabler/icons-react";
import {
  fetchEmergencies,
  assignOfficer,
  POLLING_INTERVAL_MS,
  STATUS_CONFIG,
} from "../lib/api";
import EmergencyCard from "./EmergencyCard";
import AssignOfficerModal from "./AssignOfficerModal";
import classes from "../styles.module.css";

/** Mapea estados del backend (CREATED, VALIDATED, …) a columnas del tablero por estado. */
const STATUS_TO_COLUMN = {
  CREATED: "pendiente",
  PENDING: "pendiente",
  VALIDATED: "validada",
  DISPATCHED: "despachada",
  EN_ROUTE: "en_camino",
  ON_SITE: "en_lugar",
  RESOLVED: "resuelta",
  CLOSED: "cerrada",
  CANCELLED: "cerrada",
  DISCARDED: "cerrada",
};

function columnKey(emergency) {
  const raw = emergency?.status;
  return STATUS_TO_COLUMN[raw] || raw;
}

export default function DispatcherView() {
  const [emergencies, setEmergencies] = useState([]);
  const [newEmergencyIds, setNewEmergencyIds] = useState(new Set());
  const isInitialLoadRef = useRef(true);

  // Estado para el modal de asignación de oficial (RF-05, RF-06)
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [modalOpened, setModalOpened] = useState(false);

  // ── Modo celular: Índice del estado activo (tipo Tinder swipe) ──
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const isSwipingRef = useRef(false);

  // ── RF-01 & RF-02: Polling y comparación en memoria ──
  const loadEmergencies = useCallback(async () => {
    try {
      const incomingData = await fetchEmergencies();
      if (!incomingData || !Array.isArray(incomingData)) return;

      setEmergencies((currentList) => {
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          return incomingData;
        }

        const existingIdSet = new Set(currentList.map((e) => String(e.id)));
        const newItems = incomingData.filter(
          (item) => !existingIdSet.has(String(item.id))
        );

        if (newItems.length > 0) {
          const newlyAddedIds = new Set(newItems.map((item) => String(item.id)));
          setNewEmergencyIds((prevNew) => {
            const updated = new Set(prevNew);
            newlyAddedIds.forEach((id) => updated.add(id));
            return updated;
          });

          setTimeout(() => {
            setNewEmergencyIds((prevNew) => {
              const updated = new Set(prevNew);
              newlyAddedIds.forEach((id) => updated.delete(id));
              return updated;
            });
          }, 6000);

          return [...newItems, ...currentList];
        }

        return currentList;
      });
    } catch (error) {
      console.error("Error fetching emergencies:", error);
    }
  }, []);

  useEffect(() => {
    loadEmergencies();
    const interval = setInterval(loadEmergencies, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadEmergencies]);

  // ── Swipe handlers (estilo Tinder: izquierda siguiente, derecha anterior) ──
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const diffX = touchStartXRef.current - e.touches[0].clientX;
    const diffY = touchStartYRef.current - e.touches[0].clientY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 12) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStartXRef.current || !isSwipingRef.current) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartXRef.current - touchEndX;
    const minDistance = 40;

    if (diffX > minDistance && currentStatusIndex < STATUS_CONFIG.length - 1) {
      // Swipe izquierda -> Siguiente estado
      setCurrentStatusIndex((prev) => prev + 1);
    } else if (diffX < -minDistance && currentStatusIndex > 0) {
      // Swipe derecha -> Estado anterior
      setCurrentStatusIndex((prev) => prev - 1);
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isSwipingRef.current = false;
  };

  // ── RF-05 & RF-06: Abrir modal de asignación ──
  const handleOpenAssignModal = (emergency) => {
    setSelectedEmergency(emergency);
    setModalOpened(true);
  };

  // ── RF-07 & RF-08: Confirmar asignación vía PATCH y mover a DESPACHADA ──
  const handleAssignOfficer = async (emergencyId, officerId) => {
    try {
      const result = await assignOfficer(emergencyId, officerId);

      setEmergencies((prevList) =>
        prevList.map((em) =>
          String(em.id) === String(emergencyId)
            ? {
                ...em,
                status: "despachada",
                assignedOfficer: result.assignedOfficer,
                assignedOfficerId: officerId,
              }
            : em
        )
      );

      notifications.show({
        title: "Oficial Asignado",
        message: `La emergencia ${String(emergencyId).toUpperCase()} fue asignada a ${result.assignedOfficer} y pasó a estado DESPACHADA.`,
        color: "teal",
        autoClose: 4000,
      });
    } catch (error) {
      notifications.show({
        title: "Error al asignar oficial",
        message: error.message || "No se pudo completar la asignación.",
        color: "red",
        autoClose: 4000,
      });
      throw error;
    }
  };

  return (
    <div style={{ width: "100%", padding: "16px", overflow: "hidden" }}>
      {/* ── Header ── */}
      <Group justify="space-between" mb="sm" wrap="wrap" gap="sm">
        <Group gap="sm">
          <Title order={3} c="dark" fz={{ base: "1.15rem", sm: "1.35rem" }}>
            Emergencias por Estado
          </Title>
          <Badge size="md" variant="light" color="red">
            {emergencies.length} activas
          </Badge>
        </Group>
      </Group>

      {/* ── VISTA ESCRITORIO: Tablero Kanban Clásico Multi-Columna ── */}
      <div className={classes.desktopBoard}>
        <ScrollArea type="auto" offsetScrollbars className={classes.boardScrollArea}>
          <div className={classes.boardStatus}>
            {STATUS_CONFIG.map((col) => {
              const items = emergencies.filter(
                (em) => columnKey(em) === col.key
              );
              return (
                <div key={col.key} className={classes.boardColumnStatus}>
                  <div className={classes.boardColumnHeader}>
                    <Group justify="space-between" align="center">
                      <Group gap="xs">
                        <div
                          className={classes.boardColumnDot}
                          style={{
                            backgroundColor: `var(--mantine-color-${col.color}-6)`,
                          }}
                        />
                        <Text fw={600} size="sm" c="dark">
                          {col.label}
                        </Text>
                      </Group>
                      <Badge
                        size="sm"
                        variant="light"
                        color={col.color}
                        circle
                      >
                        {items.length}
                      </Badge>
                    </Group>
                  </div>

                  <div className={classes.boardColumnCards}>
                    {items.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="md">
                        Sin emergencias
                      </Text>
                    ) : (
                      items.map((em) => (
                        <EmergencyCard
                          key={em.id}
                          emergency={em}
                          isNew={newEmergencyIds.has(String(em.id))}
                          onAssignOfficer={handleOpenAssignModal}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── VISTA CELULAR: Swipe Horizontal estilo Tinder (Toda la pantalla para un estado) ── */}
      <div className={classes.mobileBoard}>
        {/* Barra superior de pestañas/chips y navegación entre estados */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <ActionIcon
              variant="light"
              color="gray"
              size="md"
              radius="xl"
              disabled={currentStatusIndex === 0}
              onClick={() => setCurrentStatusIndex((i) => Math.max(0, i - 1))}
              aria-label="Estado anterior"
            >
              <IconChevronLeft size={18} />
            </ActionIcon>

            {/* Píldora del estado actual */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "20px",
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                border: `2px solid var(--mantine-color-${STATUS_CONFIG[currentStatusIndex].color}-5)`,
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: `var(--mantine-color-${STATUS_CONFIG[currentStatusIndex].color}-6)`,
                }}
              />
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                {STATUS_CONFIG[currentStatusIndex].label}
              </span>
              <Badge
                size="sm"
                variant="filled"
                color={STATUS_CONFIG[currentStatusIndex].color}
                circle
              >
                {
                  emergencies.filter(
                    (em) => columnKey(em) === STATUS_CONFIG[currentStatusIndex].key
                  ).length
                }
              </Badge>
            </div>

            <ActionIcon
              variant="light"
              color="gray"
              size="md"
              radius="xl"
              disabled={currentStatusIndex === STATUS_CONFIG.length - 1}
              onClick={() =>
                setCurrentStatusIndex((i) => Math.min(STATUS_CONFIG.length - 1, i + 1))
              }
              aria-label="Siguiente estado"
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </div>

          {/* Indicador de progreso de puntos (dots pagination) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            {STATUS_CONFIG.map((col, idx) => (
              <button
                key={col.key}
                type="button"
                onClick={() => setCurrentStatusIndex(idx)}
                aria-label={`Ir a ${col.label}`}
                style={{
                  width: idx === currentStatusIndex ? "18px" : "6px",
                  height: "6px",
                  borderRadius: "3px",
                  border: "none",
                  padding: 0,
                  backgroundColor:
                    idx === currentStatusIndex
                      ? `var(--mantine-color-${col.color}-6)`
                      : "#cbd5e1",
                  transition: "all 200ms ease",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", color: "#94a3b8", fontSize: "11px" }}>
            <IconArrowsHorizontal size={13} />
            <span>Desliza a los lados para cambiar de estado</span>
          </div>
        </div>

        {/* Contenedor Tinder-Swipe con pantalla completa para el estado activo */}
        <div
          className={classes.mobileEstadosContainer}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={classes.mobileSwipeTrack}
            style={{
              transform: `translateX(-${currentStatusIndex * 100}%)`,
            }}
          >
            {STATUS_CONFIG.map((col) => {
              const items = emergencies.filter(
                (em) => columnKey(em) === col.key
              );

              return (
                <div key={col.key} className={classes.mobileSwipeSlide}>
                  <div className={classes.mobileStatusCard}>
                    <div className={classes.boardColumnHeader}>
                      <Group justify="space-between" align="center">
                        <Group gap="xs">
                          <div
                            className={classes.boardColumnDot}
                            style={{
                              backgroundColor: `var(--mantine-color-${col.color}-6)`,
                            }}
                          />
                          <Text fw={700} size="md" c="dark">
                            {col.label}
                          </Text>
                        </Group>
                        <Badge
                          size="md"
                          variant="light"
                          color={col.color}
                        >
                          {items.length} {items.length === 1 ? "emergencia" : "emergencias"}
                        </Badge>
                      </Group>
                    </div>

                    <div className={classes.mobileCardsList}>
                      {items.length === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 16px", color: "#94a3b8", gap: "8px" }}>
                          <IconArrowsHorizontal size={28} opacity={0.6} />
                          <Text size="sm" c="dimmed" ta="center">
                            No hay emergencias en estado <strong>{col.label}</strong>
                          </Text>
                          <Text size="xs" c="dimmed" ta="center">
                            Desliza para ver los otros estados
                          </Text>
                        </div>
                      ) : (
                        items.map((em) => (
                          <EmergencyCard
                            key={em.id}
                            emergency={em}
                            isNew={newEmergencyIds.has(String(em.id))}
                            onAssignOfficer={handleOpenAssignModal}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modal de asignación de oficial (RF-06, RF-07, RF-08) ── */}
      <AssignOfficerModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        emergency={selectedEmergency}
        onAssign={handleAssignOfficer}
      />
    </div>
  );
}
