import React, { useRef } from "react";

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  className = "",
  onClick,
  ...props
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ripple.className = "ripple-effect";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    }
    onClick?.(e);
  };

  return (
    <button
      ref={btnRef}
      className={`ripple-btn ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};
