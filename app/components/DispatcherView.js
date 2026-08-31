"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [viewMode, setViewMode] = useState("status"); // "status" | "criticality"

  const loadEmergencies = useCallback(async () => {
    try {
      const data = await fetchEmergencies();
      setEmergencies(data);
    } catch (error) {
      console.error("Error fetching emergencies:", error);
    }
  }, []);

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

  // ── Filter emergencies into columns (RF-10) ──
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

      {/* ── Kanban board ── */}
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

                {/* Column cards with vertical scrolling */}
                <div className={classes.boardColumnCards}>
                  {items.length === 0 ? (
                    <Text size="xs" c="dimmed" ta="center" py="md">
                      Sin emergencias
                    </Text>
                  ) : (
                    items.map((em) => (
                      <EmergencyCard key={em.id} emergency={em} />
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
