"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./RouteMap.module.css";

const DOTS = Array.from({ length: 48 }, (_, i) => ({
  x: 20 + (i % 8) * 74,
  y: 20 + Math.floor(i / 8) * 58,
}));

export default function RouteMap() {
  const ref = useRef<SVGSVGElement | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const active = animate ? styles.pathAnimate : "";

  return (
    <svg
      ref={ref}
      className={styles.wrap}
      viewBox="0 0 560 400"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ruta de envío desde Miami hacia Panamá y Ecuador"
    >
      {DOTS.map((d, i) => (
        <circle key={i} className={styles.dot} cx={d.x} cy={d.y} r="1.4" />
      ))}

      <path
        className={`${styles.path} ${active}`}
        d="M 70 70 C 200 90, 260 180, 400 230"
        pathLength={400}
      />
      <path
        className={`${styles.path} ${active}`}
        style={{ transitionDelay: animate ? "250ms" : "0ms" }}
        d="M 70 70 C 160 160, 220 260, 330 330"
        pathLength={400}
      />

      <circle className={`${styles.node} ${styles.nodeOrigin}`} cx="70" cy="70" r="7" />
      <text x="86" y="66" className={styles.label}>
        MIA
      </text>
      <text x="86" y="84" className={styles.labelMuted}>
        Casillero en Miami
      </text>

      <circle className={styles.node} cx="400" cy="230" r="6" />
      <text x="414" y="226" className={styles.label}>
        PTY
      </text>
      <text x="414" y="244" className={styles.labelMuted}>
        Panamá
      </text>

      <circle className={styles.node} cx="330" cy="330" r="6" />
      <text x="344" y="326" className={styles.label}>
        UIO / GYE
      </text>
      <text x="344" y="344" className={styles.labelMuted}>
        Ecuador
      </text>
    </svg>
  );
}
