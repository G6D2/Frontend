"use client";

import { Badge, Button, Card, Group, Spoiler, Stack, Text } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconUserCheck,
  IconShield,
} from "@tabler/icons-react";
import { SEVERITY_CONFIG } from "../lib/api";
import { getEffectivePriority, getZoneContext } from "../lib/emergencies";
import { shortEmergencyId } from "../lib/boardLayout";
import GeoLabel from "./civic/GeoLabel";
import { NO_PRIORITY_LABEL } from "./ops/OpsBadges";
import classes from "../styles.module.css";

// Mismo fallback que las pills de lista/mapa/asignar (ver OpsBadges).
const NO_PRIORITY = { color: "gray", label: NO_PRIORITY_LABEL };

// Alto de 3 líneas del título (font-size md de Mantine, 16 px × 1,55).
const DESCRIPTION_CLAMP_PX = 75;

export default function EmergencyCard({
  emergency,
  isNew = false,
  // En el tablero de escritorio (columnas angostas) el título se corta a 3
  // líneas con un "Ver más". En celular la tarjeta ocupa todo el ancho y el
  // texto va completo.
  clampDescription = false,
  onAssignOfficer,
  onValidate,
  onDiscard,
  onCloseEmergency,
}) {
  const sev = SEVERITY_CONFIG[getEffectivePriority(emergency)] || NO_PRIORITY;
  // Contexto de zona vigente (p. ej. evento en el barrio) que eleva la prioridad.
  const zoneContext = getZoneContext(emergency);
  const isValidated =
    emergency.status === "validada" || emergency.status === "VALIDATED";
  const isPending =
    emergency.status === "pendiente" ||
    emergency.status === "PENDING" ||
    emergency.status === "CREATED";
  const isResolved = ["RESOLVED", "RESUELTA"].includes(
    String(emergency.status || "").toUpperCase()
  );

  return (
    <Card
      withBorder
      padding="md"
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
          {zoneContext && (
            <Badge color="yellow" variant="light" size="sm" title={zoneContext.reason}>
              {zoneContext.label}
            </Badge>
          )}
          <Badge color={sev.color}>{sev.label}</Badge>
        </Group>
      </Group>

      {/* Las descripciones de emergencias externas son largas y una sola
          tarjeta ocupaba más que la columna. El dispatcher necesita poder
          leerla entera para validar o descartar: "Ver más" la despliega
          (con mouse, teclado o toque) y solo aparece si el texto no entra. */}
      {clampDescription ? (
        <Spoiler
          mt="sm"
          maxHeight={DESCRIPTION_CLAMP_PX}
          showLabel="Ver más"
          hideLabel="Ver menos"
          styles={{ control: { fontSize: "var(--mantine-font-size-xs)" } }}
        >
          <Text fz="md" fw={600}>
            {emergency.description}
          </Text>
        </Spoiler>
      ) : (
        <Text fz="md" fw={600} mt="sm">
          {emergency.description}
        </Text>
      )}

      {/* Id corto (el completo, al pasar el mouse) y quién reportó, si hay:
          las emergencias que llegan de otros módulos no tienen usuario. */}
      <Text fz="xs" c="dimmed" mt={4} title={String(emergency.id)}>
        #{shortEmergencyId(emergency.id)}
        {emergency.userId ? ` · Reportado por ${emergency.userId}` : ""}
      </Text>

      <Text fz="xs" c="dimmed" mt={2} lineClamp={2}>
        <GeoLabel emergency={emergency} fallback="Obteniendo dirección…" />
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

      {/* Uno debajo del otro y a todo el ancho: lado a lado, en una tarjeta
          angosta, "Descartar" se cortaba. */}
      {isPending && (
        <Stack gap={6} mt="sm">
          <Button
            variant="light"
            color="teal"
            size="xs"
            fullWidth
            onClick={() => onValidate?.(emergency)}
          >
            Validar
          </Button>
          <Button
            variant="light"
            color="gray"
            size="xs"
            fullWidth
            onClick={() => onDiscard?.(emergency)}
          >
            Descartar
          </Button>
        </Stack>
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

      {isResolved && (
        <Button
          variant="light"
          color="teal"
          size="xs"
          fullWidth
          mt="sm"
          leftSection={<IconCircleCheck size={16} />}
          onClick={() => onCloseEmergency?.(emergency)}
        >
          Cerrar Emergencia
        </Button>
      )}
    </Card>
  );
}
