"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Loader,
  Box,
  ThemeIcon,
  Divider,
} from "@mantine/core";
import {
  IconShieldCheck,
  IconMapPin,
  IconClock,
  IconUser,
  IconRefresh,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  fetchAssignedEmergency,
  requestBackup,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
} from "../lib/api";

export default function OfficerView() {
  const [emergency, setEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestingBackup, setRequestingBackup] = useState(false);

  // ── RF-01: Carga de datos de la emergencia asignada ──
  const loadAssignedEmergency = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAssignedEmergency();
      setEmergency(data);
    } catch (error) {
      console.error("Error al cargar la emergencia asignada:", error);
      notifications.show({
        title: "Error de conexión",
        message: "No se pudo consultar la emergencia asignada.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignedEmergency();
  }, [loadAssignedEmergency]);

  // Solicitar refuerzos (eleva la criticidad a High)
  const handleRequestBackup = async () => {
    if (!emergency) return;
    setRequestingBackup(true);
    try {
      await requestBackup(emergency.id);
      setEmergency((prev) => (prev ? { ...prev, severity: "high" } : null));
      notifications.show({
        title: "¡Refuerzos Solicitados!",
        message: "Se ha emitido la alerta y la criticidad de la emergencia se elevó a ALTA.",
        color: "red",
        autoClose: 4000,
      });
    } catch (err) {
      console.error("Error al pedir refuerzos:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo solicitar refuerzos.",
        color: "red",
      });
    } finally {
      setRequestingBackup(false);
    }
  };

  const getSeverityInfo = (sevKey) =>
    SEVERITY_CONFIG[sevKey] || SEVERITY_CONFIG.medium;

  const getStatusInfo = (statusKey) =>
    STATUS_CONFIG.find((s) => s.key === statusKey) || {
      label: statusKey,
      color: "gray",
    };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* ── Header de la vista del Oficial ── */}
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} c="dark">
            Consola de Oficial en Terreno
          </Title>
          <Text size="sm" c="dimmed">
            Unidad Móvil CP-4021 • Oficial Carlos Gómez
          </Text>
        </div>

        <Group gap="xs">
          <Badge color="teal" variant="light" size="lg">
            GPS Activo
          </Badge>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={loadAssignedEmergency}
            loading={loading}
          >
            Actualizar
          </Button>
        </Group>
      </Group>

      {/* ── Contenido Principal: Carga / Emergencia / Estado Vacío ── */}
      {loading ? (
        <Card withBorder padding="xl" radius="md" style={{ textAlign: "center" }}>
          <Loader size="md" mx="auto" my="md" />
          <Text size="sm" c="dimmed">
            Consultando emergencias asignadas a su unidad...
          </Text>
        </Card>
      ) : emergency ? (
        <>
          {/* ── RF-02: Renderizado de Mapa ── */}
          {/* TODO: Integrar Leaflet.js o Google Maps API con marcador interactivo en coords: lat, lng */}
          <Card
            withBorder
            padding={0}
            radius="md"
            style={{
              height: "360px",
              backgroundColor: "#ffffff",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            }}
          />

          {/* ── RF-03: Información Vital del Incidente ── */}
          <Card withBorder padding="xl" radius="md" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <Stack gap="md">
              {/* Encabezado del incidente */}
              <Group justify="space-between" align="flex-start">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Badge color={getSeverityInfo(emergency.severity).color} size="md">
                      Prioridad {getSeverityInfo(emergency.severity).label}
                    </Badge>
                    <Badge color={getStatusInfo(emergency.status).color} variant="light" size="md">
                      {getStatusInfo(emergency.status).label.toUpperCase()}
                    </Badge>
                    <Text size="xs" c="dimmed" fw={600}>
                      ID: {String(emergency.id).toUpperCase()}
                    </Text>
                  </Group>

                  <Title order={3} mt={4}>
                    {emergency.description}
                  </Title>
                </Stack>
              </Group>

              <Divider />

              {/* Datos clave de ubicación y reporte */}
              <Group grow align="flex-start">
                <Group gap="sm" align="flex-start">
                  <ThemeIcon color="red" variant="light" size="lg" radius="md">
                    <IconMapPin size={20} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>
                      DIRECCIÓN / UBICACIÓN
                    </Text>
                    <Text size="sm" fw={600}>
                      {emergency.description.includes(" en ")
                        ? emergency.description.split(" en ")[1]
                        : `Sector CABA (Lat ${emergency.location?.lat || "-34.6042"}, Lng ${emergency.location?.lng || "-58.3922"})`}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {emergency.location
                        ? `Coordenadas: ${emergency.location.lat}, ${emergency.location.lng}`
                        : "Coordenadas por defecto"}
                    </Text>
                  </div>
                </Group>

                <Group gap="sm" align="flex-start">
                  <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                    <IconUser size={20} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed" fw={600}>
                      REPORTANTE
                    </Text>
                    <Text size="sm" fw={600}>
                      {emergency.userId || "Usuario del Sistema"}
                    </Text>
                    <Group gap={4} mt={2}>
                      <IconClock size={12} color="gray" />
                      <Text size="xs" c="dimmed">
                        {emergency.timestamp
                          ? new Date(emergency.timestamp).toLocaleTimeString()
                          : "Reciente"}
                      </Text>
                    </Group>
                  </div>
                </Group>
              </Group>

              <Divider />

              {/* Botón para pedir refuerzos */}
              <Group justify="center" pt="xs">
                <Button
                  color="red"
                  size="lg"
                  radius="md"
                  leftSection={<IconAlertTriangle size={22} />}
                  onClick={handleRequestBackup}
                  loading={requestingBackup}
                  styles={{
                    root: {
                      paddingLeft: 36,
                      paddingRight: 36,
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      boxShadow: "0 4px 14px rgba(224, 49, 49, 0.3)",
                      transition: "transform 150ms ease, box-shadow 150ms ease",
                    },
                  }}
                >
                  Pedir Refuerzos
                </Button>
              </Group>
            </Stack>
          </Card>
        </>
      ) : (
        /* ── RF-04: Estado Vacío / Fallback ── */
        <Card
          withBorder
          padding={48}
          radius="md"
          style={{
            textAlign: "center",
            backgroundColor: "#fcfdfe",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
          }}
        >
          <Stack align="center" gap="md">
            <Box
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                backgroundColor: "var(--mantine-color-teal-0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid var(--mantine-color-teal-2)",
              }}
            >
              <IconShieldCheck size={56} color="var(--mantine-color-teal-6)" />
            </Box>

            <div>
              <Title order={3} c="dark">
                Patrullaje normal - Sin emergencias asignadas
              </Title>
              <Text size="sm" c="dimmed" mt="xs" style={{ maxWidth: 460 }}>
                Actualmente no tienes incidentes despachados a tu unidad. Mantén
                el patrullaje preventivo y la comunicación abierta con el
                centro de despacho.
              </Text>
            </div>

            <Badge color="teal" variant="light" size="lg" mt="xs">
              Estado: Guardia activa en cuadrante
            </Badge>
          </Stack>
        </Card>
      )}
    </div>
  );
}
