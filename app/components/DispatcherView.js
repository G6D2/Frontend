"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge, Group, Stack, Text, Title } from "@mantine/core";
import { fetchEmergencies, POLLING_INTERVAL_MS } from "../lib/api";
import EmergencyCard from "./EmergencyCard";

/** @deprecated Preferir /ops con diseño Civic Guardian Ops */
export default function DispatcherView() {
  const [emergencies, setEmergencies] = useState([]);

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

  return (
    <div style={{ width: "100%", maxWidth: 700, padding: "32px 24px" }}>
      <Group justify="space-between" mb="lg">
        <Title order={3} c="dark">
          Emergencias Activas
        </Title>
        <Badge size="lg" variant="light" color="red">
          {emergencies.length} activas
        </Badge>
      </Group>

      <Stack gap="md">
        {emergencies.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No hay emergencias activas.
          </Text>
        ) : (
          emergencies.map((em) => (
            <EmergencyCard key={em.id} emergency={em} />
          ))
        )}
      </Stack>
    </div>
  );
}
