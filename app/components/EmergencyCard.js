import { Badge, Card, Group, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { SEVERITY_CONFIG } from "../lib/api";

export default function EmergencyCard({ emergency }) {
  const sev = SEVERITY_CONFIG[emergency.severity] || SEVERITY_CONFIG.medium;

  return (
    <Card withBorder padding="lg" radius="md" style={{ flexShrink: 0, width: "100%" }}>
      <Group justify="space-between">
        <IconAlertTriangle
          size={32}
          color={`var(--mantine-color-${sev.color}-6)`}
        />
        <Badge color={sev.color}>{sev.label}</Badge>
      </Group>

      <Text fz="lg" fw={500} mt="md">
        {emergency.description}
      </Text>
      <Text fz="sm" c="dimmed" mt={5}>
        {emergency.id.toUpperCase()} — Reportado por {emergency.userId}
      </Text>
    </Card>
  );
}
