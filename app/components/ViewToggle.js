"use client";

import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconColumns, IconAlertTriangle } from "@tabler/icons-react";
import classes from "../styles.module.css";

export default function ViewToggle({ viewMode, onToggle }) {
  return (
    <Group justify="center">
      <Tooltip
        label={
          viewMode === "status"
            ? "Cambiar a vista por Criticidad"
            : "Cambiar a vista por Estado"
        }
        position="bottom"
        radius="md"
      >
        <ActionIcon
          onClick={onToggle}
          variant="default"
          size="xl"
          radius="md"
          aria-label="Toggle view mode"
        >
          {viewMode === "status" ? (
            <IconAlertTriangle
              className={classes.toggleIcon}
              stroke={1.5}
              size={22}
            />
          ) : (
            <IconColumns
              className={classes.toggleIcon}
              stroke={1.5}
              size={22}
            />
          )}
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
