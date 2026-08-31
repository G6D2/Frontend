"use client";

import { useState } from "react";
import { Button, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconSend } from "@tabler/icons-react";
import { submitEmergency } from "../lib/api";

export default function PanicButton() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setSent(true);

    const lat = Number((Math.random() * (-34.53 - -34.7) + -34.7).toFixed(4));
    const lng = Number((Math.random() * (-58.35 - -58.53) + -58.53).toFixed(4));

    const payload = {
      userId: "user-123",
      location: { lat, lng },
      description: "Botón de pánico activado",
      severity: "high",
    };

    try {
      const result = await submitEmergency(payload);
      notifications.show({
        title: "Emergencia creada",
        message: `ID ${result.emergencyId} — lat ${lat}, lng ${lng}`,
        color: "teal",
        autoClose: 4000,
      });
      // Por ahora el botón se rehabilita solo, para poder disparar varias emergencias seguidas
      setTimeout(() => setSent(false), 2000);
    } catch (error) {
      setSent(false);
      notifications.show({
        title: "Error",
        message: error.message || "Something went wrong.",
        color: "red",
        autoClose: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip
      label="Request sent!"
      offset={5}
      position="bottom"
      radius="xl"
      transitionProps={{ duration: 100, transition: "slide-down" }}
      opened={sent && !loading}
    >
      <Button
        id="submit-button"
        variant="light"
        rightSection={
          sent && !loading ? (
            <IconCheck size={20} stroke={1.5} />
          ) : (
            <IconSend size={20} stroke={1.5} />
          )
        }
        radius="xl"
        size="md"
        pr={14}
        h={48}
        styles={{ section: { marginLeft: 22 } }}
        loading={loading}
        disabled={sent}
        onClick={handleSubmit}
      >
        Panic Button
      </Button>
    </Tooltip>
  );
}
