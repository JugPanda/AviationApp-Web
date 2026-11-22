"use client";

import Image from "next/image";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import "./product-showcase.css";

export type ShowcaseItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  src: string;
  mobileSrc?: string;
  mobileWidth?: number;
  mobileHeight?: number;
  width: number;
  height: number;
  alt: string;
  href: string;
  cta: string;
  note: string;
};

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ProductShowcase({ items }: { items: ShowcaseItem[] }) {
  const instanceId = useId();
  const hydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId),
  );

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % items.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelectedId(items[nextIndex].id);
    tabs.current[nextIndex]?.focus();
  }

  if (!items.length) return null;

  return (
    <div className="product-showcase">
      {/* SSR and the first hydration render expose content, not inert controls. */}
      {hydrated && (
        <div
          className="product-showcase-tabs"
          role="tablist"
          aria-label="Explore AV Weather"
          aria-orientation="horizontal"
        >
          {items.map((item, index) => (
            <button
              className="product-showcase-tab"
              key={item.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${instanceId}-tab-${item.id}`}
              aria-controls={`${instanceId}-panel-${item.id}`}
              aria-selected={index === selectedIndex}
              tabIndex={index === selectedIndex ? 0 : -1}
              onClick={() => setSelectedId(item.id)}
              onFocus={() => setSelectedId(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="product-showcase-panels">
        {items.map((item, index) => (
          <div
            className="product-showcase-panel"
            key={item.id}
            id={`${instanceId}-panel-${item.id}`}
            role={hydrated ? "tabpanel" : undefined}
            aria-labelledby={
              hydrated ? `${instanceId}-tab-${item.id}` : undefined
            }
            tabIndex={hydrated ? 0 : undefined}
            hidden={hydrated && index !== selectedIndex}
          >
            {(!hydrated || index === selectedIndex) && (
              <figure className="product-showcase-figure">
                <div className="product-showcase-frame">
                  <div className="product-showcase-chrome" aria-hidden="true">
                    <span className="product-showcase-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="product-showcase-frame-label">
                      AV Weather / {item.label}
                    </span>
                  </div>
                  <a
                    className="product-showcase-image-link"
                    href={item.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Opens the full capture in a new tab"
                  >
                    <picture>
                      {item.mobileSrc && (
                        <source
                          media="(max-width: 640px)"
                          srcSet={item.mobileSrc}
                          width={item.mobileWidth}
                          height={item.mobileHeight}
                        />
                      )}
                      <Image
                        className="product-showcase-image"
                        src={item.src}
                        width={item.width}
                        height={item.height}
                        alt={item.alt}
                        sizes="(max-width: 1440px) 90vw, 1296px"
                      />
                    </picture>
                    <span>
                      Enlarge capture: {item.label.toLowerCase()}{" "}
                      <span aria-hidden="true">↗</span>
                    </span>
                  </a>
                </div>
                <figcaption className="product-showcase-caption">
                  <div className="product-showcase-copy">
                    <h3 className="product-showcase-title">{item.title}</h3>
                    <p className="product-showcase-description">
                      {item.description}
                    </p>
                  </div>
                  <div className="product-showcase-action">
                    <a className="product-showcase-link" href={item.href}>
                      {item.cta}
                      <span aria-hidden="true">↗</span>
                    </a>
                    <p className="product-showcase-note">{item.note}</p>
                  </div>
                </figcaption>
              </figure>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
