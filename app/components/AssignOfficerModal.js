"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Group,
  Text,
  Stack,
  Radio,
  Badge,
  Card,
  Loader,
  Alert,
} from "@mantine/core";
import {
  IconMapPin,
  IconShieldCheck,
  IconUserCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import { fetchOfficers } from "../lib/api";

export default function AssignOfficerModal({
  opened,
  onClose,
  emergency,
  onAssign,
}) {
  const [officers, setOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (opened && emergency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingOfficers(true);
      setError("");
      fetchOfficers({ status: "disponible" })
        .then((data) => {
          setOfficers(data || []);
          setSelectedOfficerId(data && data.length > 0 ? data[0].id : "");
        })
        .catch((err) => {
          console.error("Error fetching officers:", err);
          setError(err.message || "No se pudieron cargar los oficiales disponibles.");
        })
        .finally(() => setLoadingOfficers(false));
    }
  }, [opened, emergency]);

  const handleConfirm = async () => {
    if (!selectedOfficerId || !emergency) return;
    setSubmitting(true);
    setError("");
    try {
      await onAssign(emergency.id, selectedOfficerId);
      onClose();
    } catch (err) {
      console.error("Error assigning officer:", err);
      setError(err.message || "No se pudo asignar el oficial. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!emergency) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconUserCheck size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={600} size="md">
            Asignar Oficial a Emergencia
          </Text>
        </Group>
      }
      radius="md"
      centered
      size="md"
    >
      <Stack gap="md">
        {/* Resumen de la emergencia */}
        <Card withBorder padding="sm" radius="md" bg="gray.0">
          <Text size="xs" c="dimmed" fw={600}>
            EMERGENCIA {String(emergency.id).toUpperCase()}
          </Text>
          <Text size="sm" fw={500} mt={2}>
            {emergency.description}
          </Text>
        </Card>

        <Text size="sm" fw={600}>
          Seleccione un oficial disponible:
        </Text>

        {loadingOfficers ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Cargando oficiales disponibles...
            </Text>
          </Group>
        ) : (
          <Radio.Group
            value={selectedOfficerId}
            onChange={setSelectedOfficerId}
          >
            <Stack gap="sm">
              {officers.map((officer) => (
                <Card
                  key={officer.id}
                  withBorder
                  padding="sm"
                  radius="md"
                  style={{
                    cursor: "pointer",
                    borderColor:
                      selectedOfficerId === officer.id
                        ? "var(--mantine-color-blue-6)"
                        : undefined,
                    backgroundColor:
                      selectedOfficerId === officer.id
                        ? "var(--mantine-color-blue-0)"
                        : undefined,
                  }}
                  onClick={() => setSelectedOfficerId(officer.id)}
                >
                  <Group justify="space-between" align="center">
                    <Radio value={officer.id} label="" />
                    <Stack gap={2} style={{ flex: 1, marginLeft: 8 }}>
                      <Group gap="xs">
                        <Text fw={600} size="sm">
                          {officer.name}
                        </Text>
                        <Badge size="xs" variant="light" color="blue">
                          {officer.badgeNumber}
                        </Badge>
                      </Group>
                      <Group gap={4}>
                        <IconMapPin size={14} color="gray" />
                        <Text size="xs" c="dimmed">
                          {officer.location} • {officer.distance}
                        </Text>
                      </Group>
                    </Stack>

                    <Badge size="sm" variant="dot" color="teal">
                      {officer.status || "Disponible"}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Radio.Group>
        )}

        {error && (
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertCircle size={16} />}
            title="No se pudo completar"
          >
            {error}
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            color="blue"
            onClick={handleConfirm}
            loading={submitting}
            disabled={!selectedOfficerId || loadingOfficers}
            leftSection={<IconShieldCheck size={18} />}
          >
            Confirmar Asignación
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
