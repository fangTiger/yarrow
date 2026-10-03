// web/components/HexagramFigure.tsx
export function HexagramFigure(props: {
  lines: readonly boolean[];
  moving?: readonly number[];
  label: string;
  compact?: boolean;
}) {
  const moving = new Set(props.moving ?? []);
  return (
    <span
      aria-label={props.label}
      className={`hexagram-figure${props.compact ? " compact" : ""}`}
      role="img"
    >
      {[...props.lines].reverse().map((yang, index) => {
        const position = props.lines.length - index;
        const classes = [yang ? "yang" : "yin", moving.has(position) ? "moving" : ""];
        return <i className={classes.filter(Boolean).join(" ")} key={position} />;
      })}
    </span>
  );
}
