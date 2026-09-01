"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge, Group, ScrollArea, Text, Title } from "@mantine/core";
import {
  fetchEmergencies,
  POLLING_INTERVAL_MS,
  STATUS_CONFIG,
  SEVERITY_CONFIG,
} from "../lib/api";
import EmergencyCard from "./EmergencyCard";
import ViewToggle from "./ViewToggle";
import classes from "../styles.module.css";

export default function DispatcherView() {
  const [emergencies, setEmergencies] = useState([]);
  const [newEmergencyIds, setNewEmergencyIds] = useState(new Set());
  const [viewMode, setViewMode] = useState("status"); // "status" | "criticality"
  const isInitialLoadRef = useRef(true);

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

  const toggleView = () =>
    setViewMode((prev) => (prev === "status" ? "criticality" : "status"));

  // ── Pick columns based on view mode (RF-10) ──
  const columns =
    viewMode === "status" ? STATUS_CONFIG : Object.values(SEVERITY_CONFIG);

  // ── Filter emergencies into columns (RF-10 & RF-03) ──
  const filterKey = viewMode === "status" ? "status" : "severity";

  return (
    <div style={{ width: "100%", padding: "24px", overflow: "hidden" }}>
      {/* ── Header ── */}
      <Group justify="space-between" mb="lg">
        <Group gap="md">
          <Title order={3} c="dark">
            {viewMode === "status"
              ? "Emergencias por Estado"
              : "Emergencias por Criticidad"}
          </Title>
          <Badge size="lg" variant="light" color="red">
            {emergencies.length} activas
          </Badge>
        </Group>
        <ViewToggle viewMode={viewMode} onToggle={toggleView} />
      </Group>

      {/* ── Kanban board (RF-03: se re-renderiza automáticamente al actualizarse el array) ── */}
      <ScrollArea type="auto" offsetScrollbars className={classes.boardScrollArea}>
        <div
          className={
            viewMode === "status"
              ? classes.boardStatus
              : classes.boardCriticality
          }
        >
          {columns.map((col) => {
            const items = emergencies.filter((em) => em[filterKey] === col.key);
            return (
              <div
                key={col.key}
                className={
                  viewMode === "status"
                    ? classes.boardColumnStatus
                    : classes.boardColumnCriticality
                }
              >
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
  );
}
