"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge, Group, ScrollArea, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
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

  // ── RF-01 & RF-02: Polling y comparación en memoria ──
  const loadEmergencies = useCallback(async () => {
    try {
      const incomingData = await fetchEmergencies();
      if (!incomingData || !Array.isArray(incomingData)) return;

      setEmergencies((currentList) => {
        // Carga inicial: inicializar el array
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          return incomingData;
        }

        // RF-02: Comparar con el array en memoria para identificar únicamente casos nuevos
        const existingIdSet = new Set(currentList.map((e) => String(e.id)));
        const newItems = incomingData.filter(
          (item) => !existingIdSet.has(String(item.id))
        );

        if (newItems.length > 0) {
          console.log(`🚨 RF-02: ${newItems.length} nueva(s) emergencia(s) detectada(s):`, newItems);

          // RF-04: Registrar IDs de nuevas emergencias para la animación temporal
          const newlyAddedIds = new Set(newItems.map((item) => String(item.id)));
          setNewEmergencyIds((prevNew) => {
            const updated = new Set(prevNew);
            newlyAddedIds.forEach((id) => updated.add(id));
            return updated;
          });

          // RF-04: Quitar la animación después de 6 segundos
          setTimeout(() => {
            setNewEmergencyIds((prevNew) => {
              const updated = new Set(prevNew);
              newlyAddedIds.forEach((id) => updated.delete(id));
              return updated;
            });
          }, 6000);

          // RF-02: Agregar solo los casos nuevos sin reiniciar ni sobrescribir los existentes
          return [...newItems, ...currentList];
        }

        return currentList;
      });
    } catch (error) {
      console.error("Error fetching emergencies:", error);
    }
  }, []);

  // RF-01: setInterval (polling) cada POLLING_INTERVAL_MS segundos
  useEffect(() => {
    loadEmergencies();
    const interval = setInterval(loadEmergencies, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadEmergencies]);

  // ── RF-05 & RF-06: Abrir modal de asignación ──
  const handleOpenAssignModal = (emergency) => {
    setSelectedEmergency(emergency);
    setModalOpened(true);
  };

  // ── RF-07 & RF-08: Confirmar asignación vía PATCH y mover a DESPACHADA ──
  const handleAssignOfficer = async (emergencyId, officerId) => {
    try {
      const result = await assignOfficer(emergencyId, officerId);

      // RF-08: Actualizar estado local a DESPACHADA y asociar oficial asignado
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
    <div style={{ width: "100%", padding: "24px", overflow: "hidden" }}>
      {/* ── Header ── */}
      <Group justify="space-between" mb="lg">
        <Group gap="md">
          <Title order={3} c="dark">
            Emergencias por Estado
          </Title>
          <Badge size="lg" variant="light" color="red">
            {emergencies.length} activas
          </Badge>
        </Group>
      </Group>

      {/* ── Tablero por Estado (RF-03: se re-renderiza automáticamente al actualizarse el array) ── */}
      <ScrollArea type="auto" offsetScrollbars className={classes.boardScrollArea}>
        <div className={classes.boardStatus}>
          {STATUS_CONFIG.map((col) => {
            const items = emergencies.filter(
              (em) => columnKey(em) === col.key
            );
            return (
              <div key={col.key} className={classes.boardColumnStatus}>
                {/* Column header */}
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

                {/* Column cards with vertical scrolling and RF-04 highlight animation */}
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
