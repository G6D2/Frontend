export default function MaterialIcon({
  name,
  filled = false,
  className = "",
  size = 24,
}) {
  return (
    <span
      className={`material-symbols-outlined material-icon ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
      }}
    >
      {name}
    </span>
  );
}
