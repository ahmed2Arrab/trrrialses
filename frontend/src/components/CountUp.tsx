import React, { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
  startOnView?: boolean;
}

export const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 1.2,
  decimals = 0,
  className = "",
  suffix = "",
  startOnView = true,
}) => {
  const [value, setValue] = useState(startOnView ? 0 : end);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(!startOnView);

  useEffect(() => {
    if (!startOnView) {
      setValue(end);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - startTime) / (duration * 1000), 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(end * eased);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration, startOnView]);

  const formatted =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString("ar-EG");

  return (
    <span ref={ref} className={className}>
      {formatted}
      {suffix}
    </span>
  );
};
