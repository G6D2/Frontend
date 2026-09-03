"use client";

import { Badge, Button, Card, Group, Text } from "@mantine/core";
import { IconAlertTriangle, IconUserCheck, IconShield } from "@tabler/icons-react";
import { SEVERITY_CONFIG } from "../lib/api";
import classes from "../styles.module.css";

export default function EmergencyCard({
  emergency,
  isNew = false,
  onAssignOfficer,
}) {
  const sev = SEVERITY_CONFIG[emergency.severity] || SEVERITY_CONFIG.medium;
  const isValidated =
    emergency.status === "validada" || emergency.status === "VALIDATED";

  return (
    <Card
      withBorder
      padding="lg"
      radius="md"
      className={isNew ? classes.newCardHighlight : undefined}
      style={{ flexShrink: 0, width: "100%" }}
    >
      <Group justify="space-between">
        <IconAlertTriangle
          size={32}
          color={`var(--mantine-color-${sev.color}-6)`}
        />
        <Group gap="xs">
          {isNew && (
            <Badge color="red" variant="filled" size="sm">
              NUEVO
            </Badge>
          )}
          <Badge color={sev.color}>{sev.label}</Badge>
        </Group>
      </Group>

      <Text fz="lg" fw={500} mt="md">
        {emergency.description}
      </Text>

      <Text fz="sm" c="dimmed" mt={5}>
        {String(emergency.id).toUpperCase()} — Reportado por {emergency.userId}
      </Text>

      {/* Oficial asignado (RF-08) */}
      {emergency.assignedOfficer && (
        <Group gap={6} mt="xs" align="center">
          <Badge
            size="sm"
            variant="light"
            color="blue"
            leftSection={<IconShield size={12} />}
          >
            {emergency.assignedOfficer}
          </Badge>
        </Group>
      )}

      {/* Botón Asignar Oficial exclusivo para estado VALIDADA (RF-05) */}
      {isValidated && (
        <Button
          variant="light"
          color="orange"
          size="xs"
          fullWidth
          mt="sm"
          leftSection={<IconUserCheck size={16} />}
          onClick={() => onAssignOfficer?.(emergency)}
        >
          Asignar Oficial
        </Button>
      )}
    </Card>
  );
}
