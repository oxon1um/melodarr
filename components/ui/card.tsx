import { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={`panel relative overflow-hidden p-5 transition-all hover:border-white/[0.2] ${className ?? ""}`}
      {...props}
    >
      {/* Subtle shine effect on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
