"use client";
import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function AnimatedContainer({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
      );
    }
  }, []);

  return (
    <div ref={containerRef} className="bg-white/80 dark:bg-zinc-900/80 shadow-xl rounded-xl p-6">
      {children}
    </div>
  );
}
