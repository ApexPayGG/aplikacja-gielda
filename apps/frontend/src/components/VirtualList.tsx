import { type Key, type ReactNode, useMemo, useState } from "react";

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey?: (item: T, index: number) => Key;
  overscan?: number;
  maxHeight?: number;
  className?: string;
};

const DEFAULT_MAX_HEIGHT = 720;

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  getItemKey,
  overscan = 4,
  maxHeight = DEFAULT_MAX_HEIGHT,
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const safeItemHeight = Math.max(1, itemHeight);
  const totalHeight = items.length * safeItemHeight;
  const viewportHeight = Math.min(maxHeight, Math.max(safeItemHeight, totalHeight));

  const startIndex = Math.max(0, Math.floor(scrollTop / safeItemHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / safeItemHeight) + overscan * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);

  return (
    <div
      className={className}
      style={{ height: viewportHeight, overflowY: "auto", contain: "strict" }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map((item, offset) => {
          const index = startIndex + offset;
          const key = getItemKey?.(item, index) ?? index;
          return (
            <div
              key={key}
              style={{ position: "absolute", top: index * safeItemHeight, left: 0, right: 0, height: safeItemHeight }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
