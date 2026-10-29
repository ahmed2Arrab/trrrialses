import React, { useMemo } from "react";
import { motion } from "framer-motion";

export const LoginParticles: React.FC = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        size: 4 + Math.random() * 8,
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: 8 + Math.random() * 12,
        delay: Math.random() * 5,
      })),
    [],
  );

  const shapes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        size: 30 + Math.random() * 50,
        x: Math.random() * 100,
        y: Math.random() * 100,
        rotate: Math.random() * 360,
        duration: 15 + Math.random() * 10,
      })),
    [],
  );

  return (
    <div className="login-particles pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-brand-gold/20"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {shapes.map((s) => (
        <motion.div
          key={`shape-${s.id}`}
          className="absolute border border-brand-gold/10 rounded-lg"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.x}%`,
            top: `${s.y}%`,
          }}
          animate={{
            rotate: [s.rotate, s.rotate + 180],
            y: [0, -20, 0],
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};
