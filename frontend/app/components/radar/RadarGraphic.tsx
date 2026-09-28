import React from "react";
import styles from "./RadarGraphic.module.css";

export interface RadarGraphicProps {
  size?: "hero" | "lg" | "compact";
  className?: string;
}

export default function RadarGraphic({
  size = "lg",
  className = "",
}: RadarGraphicProps) {
  const sizeClass =
    size === "hero"
      ? styles.sizeHero
      : size === "compact"
      ? styles.sizeCompact
      : styles.sizeLg;

  return (
    <div
      className={`${styles.radarContainer} ${sizeClass} ${className}`}
      aria-hidden="true"
    >
      <div className={`${styles.radarRing} ${styles.ring1}`} />
      <div className={`${styles.radarRing} ${styles.ring2}`} />
      <div className={`${styles.radarRing} ${styles.ring3}`} />
      <div className={`${styles.radarRing} ${styles.ring4}`} />
      <div className={styles.radarCross} />
      <div className={`${styles.radarCross} ${styles.crossVert}`} />
      <div className={styles.radarSweep} />
      <div className={`${styles.blip} ${styles.blip1}`} />
      <div className={`${styles.blip} ${styles.blip2}`} />
      <div className={`${styles.blip} ${styles.blip3}`} />
      <div className={`${styles.blip} ${styles.blip4}`} />
      <div className={`${styles.blip} ${styles.blip5}`} />
    </div>
  );
}
