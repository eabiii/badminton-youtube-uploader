import { type ReactNode, useEffect, useRef } from 'react';

export function ScreenHeading({ children }: { children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <h1 ref={heading} tabIndex={-1}>
      {children}
    </h1>
  );
}
