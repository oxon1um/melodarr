import { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={`panel relative overflow-hidden p-5 transition-all hover:border-[var(--edge-bright)] ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
