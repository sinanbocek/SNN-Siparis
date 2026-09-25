import { math } from "@snn/abacus-core";
import { useLayoutEffect, useRef, useState, type Ref } from "react";
import type { Order } from "../../domain/order/order.ts";
import { OrderSheet } from "./OrderSheet.tsx";
import styles from "./sales.module.css";

const SHEET_WIDTH = 1080;

/** 1080 px belgeyi kutuya sığacak ölçekte gösterir; PNG yine tam boy düğümden üretilir. */
export function ScaledSheet({ order, sheetRef }: { order: Order; sheetRef: Ref<HTMLDivElement> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.4, height: 600 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return undefined;
    const measure = () => {
      const scaled = math.div(box.clientWidth, SHEET_WIDTH);
      const scale = scaled === null ? 0.4 : scaled;
      setSize({ scale, height: math.mul(inner.scrollHeight, scale) });
    };
    measure();
    // Eski Safari ve test ortamında yoksa ilk ölçüm yeterli.
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className={styles.previewBox} style={{ height: size.height }}>
      <div
        ref={innerRef}
        className={styles.previewInner}
        style={{ transform: `scale(${size.scale})` }}
      >
        <OrderSheet ref={sheetRef} order={order} />
      </div>
    </div>
  );
}
