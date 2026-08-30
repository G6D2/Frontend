"use client";

import { Button, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import {
  triggerPanicButton,
  getCurrentLocation,
} from "../lib/api";

/** @deprecated Preferir la pantalla /inicio con diseño Civic Guardian */
export default function PanicButton() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setSent(true);
    try {
      const loc = await getCurrentLocation();
      await triggerPanicButton({
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      notifications.show({
        title: "Success",
        message: "Alerta enviada al backend.",
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
