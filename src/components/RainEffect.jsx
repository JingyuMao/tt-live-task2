import { forwardRef, useImperativeHandle, useMemo } from "react";
import { StarRain } from "../engines/rain.js";

// Keep particle state outside React rendering; the shared Canvas draws both effects.
const RainEffect = forwardRef(function RainEffect(_props, ref) {
  const engine = useMemo(() => new StarRain(), []);
  useImperativeHandle(ref, () => engine, [engine]);
  return null;
});
export default RainEffect;
