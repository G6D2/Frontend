"use client";

import { Badge, Card, Group, Text } from "@mantine/core";
import { PRIORITY_CONFIG } from "../lib/emergencies";

export default function EmergencyCard({ emergency }) {
  const sev =
    PRIORITY_CONFIG[emergency.severity] || PRIORITY_CONFIG.medium;

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>{emergency.description}</Text>
        <Badge color={sev.color === "priority-high" ? "red" : "blue"}>
          {sev.label}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">
        {emergency.status} · {emergency.userId}
      </Text>
    </Card>
  );
}
