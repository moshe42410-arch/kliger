"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

/**
 * Counts up from 0 to `value` when the component becomes visible.
 * Respects prefers-reduced-motion — skips the animation entirely in that case.
 */
export function AnimatedCounter({
  value,
  duration = 900,
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);
  const nodeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplay(value);
      return;
    }

    if (!nodeRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            animate();
          }
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(nodeRef.current);

    function animate() {
      const start = performance.now();
      const from = 0;
      const to = value;

      function tick(now: number) {
        const t = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(from + (to - from) * eased);
        setDisplay(current);
        if (t < 1) requestAnimationFrame(tick);
        else setDisplay(to);
      }

      requestAnimationFrame(tick);
    }

    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={nodeRef} className={className}>
      {display.toLocaleString("he-IL")}
    </span>
  );
}
