import { forwardRef, useImperativeHandle, useMemo } from "react";
import { Fireworks } from "../engines/fireworks.js";

// Keep particle state outside React rendering; the shared Canvas draws both effects.
const FireworkEffect = forwardRef(function FireworkEffect(_props, ref) {
  const engine = useMemo(() => new Fireworks(), []);
  useImperativeHandle(ref, () => engine, [engine]);
  return null;
});
export default FireworkEffect;
