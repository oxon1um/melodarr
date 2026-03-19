import { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={`panel relative overflow-hidden p-5 transition-all hover:border-white/[0.2] ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
