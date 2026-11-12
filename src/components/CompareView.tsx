import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowRight, Move, Ruler, X } from 'lucide-react';
import { COUNTRY_BY_ID } from '../data/countries';
import {
  colorForShape,
  formatArea,
  formatAreaCompact,
  formatRatio,
} from '../lib/atlas';
import type { ActiveShape, Units } from '../types';
import { Modal } from './Modal';

interface CompareViewProps {
  open: boolean;
  shapes: ActiveShape[];
  units: Units;
  onUnitsChange: (units: Units) => void;
  onClose: () => void;
  onArrange: () => void;
}

interface CompareItem {
  shape: ActiveShape;
  countryId: string;
  name: string;
  area: number;
  width: number;
  height: number;
  centerX: number;
  maxY: number;
  path: string;
  color: string;
}

const NICE_BAR_LENGTHS = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

export function CompareView({
  open,
  shapes,
  units,
  onUnitsChange,
  onClose,
  onArrange,
}: CompareViewProps) {
  const titleId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState({ width: 0, height: 0 });
  const [revealed, setRevealed] = useState(false);

  const items = useMemo<CompareItem[]>(
    () =>
      shapes
        .filter((shape) => !shape.hidden)
        .map((shape) => {
          const country = COUNTRY_BY_ID.get(shape.countryId);
          if (!country) return null;
          return {
            shape,
            countryId: country.id,
            name: country.name,
            area: country.area,
            width: Math.max(1, country.bounds[2] - country.bounds[0]),
            height: Math.max(1, country.bounds[3] - country.bounds[1]),
            centerX: (country.bounds[0] + country.bounds[2]) / 2,
            maxY: country.bounds[3],
            path: country.path,
            color: colorForShape(shape).hex,
          };
        })
        .filter((item): item is CompareItem => Boolean(item)),
    [shapes],
  );

  useEffect(() => {
    if (!open) {
      setRevealed(false);
      return;
    }
    const timer = window.setTimeout(() => setRevealed(true), 70);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !plotRef.current) return;
    const element = plotRef.current;
    const measure = () => {
      setPlotSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const layout = useMemo(() => {
    if (items.length === 0 || plotSize.width <= 0) {
      return {
        scale: 1,
        contentWidth: 0,
        svgHeight: 0,
        baselineY: 0,
        positions: [] as Array<{
          item: CompareItem;
          x: number;
          columnWidth: number;
        }>,
        barLength: 1000,
      };
    }

    const padding = plotSize.width < 640 ? 26 : 48;
    const gap = items.length > 4 ? 26 : 44;
    const sumWidths = items.reduce((total, item) => total + item.width, 0);
    const maxHeight = Math.max(...items.map((item) => item.height));
    const availableWidth = Math.max(260, plotSize.width - padding * 2);
    const availableHeight = Math.max(190, plotSize.height - 142);
    const fitScale = Math.min(
      (availableWidth - gap * (items.length - 1)) /
        Math.max(1, sumWidths),
      availableHeight / Math.max(1, maxHeight),
    );
    const scale = Math.max(0.00035, fitScale);
    const baselineY = 40 + maxHeight * scale;

    const positions: Array<{
      item: CompareItem;
      x: number;
      columnWidth: number;
    }> = [];
    let cursor = padding;
    for (const item of items) {
      const columnWidth = Math.max(item.width * scale, 96);
      positions.push({
        item,
        x: cursor + columnWidth / 2,
        columnWidth,
      });
      cursor += columnWidth + gap;
    }
    const naturalWidth = cursor - gap + padding;
    const contentWidth = Math.max(plotSize.width, naturalWidth);
    const svgHeight = Math.max(plotSize.height, baselineY + 112);
    const targetBar = Math.min(210, Math.max(90, plotSize.width * 0.2));
    const barLength =
      NICE_BAR_LENGTHS.find(
        (length) => length * scale >= targetBar * 0.62,
      ) ?? NICE_BAR_LENGTHS[NICE_BAR_LENGTHS.length - 1];

    return {
      scale,
      contentWidth,
      svgHeight,
      baselineY,
      positions,
      barLength,
    };
  }, [items, plotSize]);

  const largest = items.length
    ? items.reduce((current, item) =>
        item.area > current.area ? item : current,
      )
    : null;
  const smallest = items.length
    ? items.reduce((current, item) =>
        item.area < current.area ? item : current,
      )
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      className="compare-backdrop"
    >
      <div className="compare-view">
        <header className="compare-view__head">
          <div>
            <p className="eyebrow">Equal-area comparison · latitude removed</p>
            <h2 id={titleId}>The scale table</h2>
            <p className="compare-view__lede">
              Every outline below shares one scale. The map has been taken out
              of the equation.
            </p>
          </div>
          <div className="compare-view__tools">
            <div className="units-toggle" role="group" aria-label="Area units">
              <button
                type="button"
                className={units === 'km' ? 'is-active' : ''}
                onClick={() => onUnitsChange('km')}
                aria-pressed={units === 'km'}
              >
                km²
              </button>
              <button
                type="button"
                className={units === 'mi' ? 'is-active' : ''}
                onClick={() => onUnitsChange('mi')}
                aria-pressed={units === 'mi'}
              >
                mi²
              </button>
            </div>
            <button
              type="button"
              className="icon-button compare-view__close"
              onClick={onClose}
              aria-label="Close scale table"
              data-autofocus
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {items.length < 2 ? (
          <div className="compare-empty">
            <Move size={28} aria-hidden="true" />
            <h3>Two outlines make a comparison.</h3>
            <p>Add another place from the map, then open the scale table.</p>
            <button type="button" className="button button--primary" onClick={onClose}>
              Back to the map
            </button>
          </div>
        ) : (
          <>
            <div className="compare-plot" ref={plotRef}>
              <div className="compare-scroll">
                <svg
                  className={`compare-svg ${revealed ? 'is-revealed' : ''}`}
                  width={layout.contentWidth}
                  height={layout.svgHeight}
                  role="img"
                  aria-label={`Equal-area comparison of ${items.map((item) => item.name).join(', ')}`}
                >
                  <defs>
                    <pattern
                      id="compare-grid"
                      width="34"
                      height="34"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 34 0 L 0 0 0 34"
                        fill="none"
                        stroke="var(--grid-line)"
                        strokeWidth="0.8"
                      />
                    </pattern>
                    <filter id="compare-shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow
                        dx="0"
                        dy="5"
                        stdDeviation="4"
                        floodColor="#1f2b26"
                        floodOpacity="0.12"
                      />
                    </filter>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width={layout.contentWidth}
                    height={layout.svgHeight}
                    fill="url(#compare-grid)"
                  />

                  {layout.positions.map(({ item, x }, index) => (
                    <g key={item.countryId}>
                      <text
                        className="compare-index"
                        x={x}
                        y={26}
                        textAnchor="middle"
                      >
                        {String(index + 1).padStart(2, '0')}
                      </text>
                      <line
                        className="compare-guide"
                        x1={x}
                        y1={34}
                        x2={x}
                        y2={layout.baselineY + 66}
                      />
                      <g
                        className="compare-shape"
                        style={{ animationDelay: `${index * 55}ms` }}
                        transform={`translate(${x} ${layout.baselineY}) scale(${layout.scale}) translate(${-item.centerX} ${-item.maxY})`}
                        filter="url(#compare-shadow)"
                      >
                        <path
                          d={item.path}
                          fill={item.color}
                          fillOpacity="0.34"
                          stroke={item.color}
                          strokeWidth="2.4"
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                      <line
                        className="compare-baseline"
                        x1={x - 44}
                        y1={layout.baselineY}
                        x2={x + 44}
                        y2={layout.baselineY}
                      />
                      <text
                        className="compare-label compare-label--name"
                        x={x}
                        y={layout.baselineY + 28}
                        textAnchor="middle"
                      >
                        {item.name}
                      </text>
                      <text
                        className="compare-label compare-label--area"
                        x={x}
                        y={layout.baselineY + 46}
                        textAnchor="middle"
                      >
                        {formatArea(item.area, units)}
                      </text>
                      <text
                        className="compare-label compare-label--ratio"
                        x={x}
                        y={layout.baselineY + 62}
                        textAnchor="middle"
                      >
                        {largest
                          ? item.area === largest.area
                            ? 'largest outline'
                            : `${Math.max(
                                1,
                                Math.round((item.area / largest.area) * 100),
                              )}% of largest`
                          : ''}
                      </text>
                    </g>
                  ))}

                  <g
                    className="compare-scalebar"
                    transform={`translate(28 ${layout.svgHeight - 26})`}
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2={layout.barLength * layout.scale}
                      y2="0"
                    />
                    <line x1="0" y1="-4" x2="0" y2="4" />
                    <line
                      x1={layout.barLength * layout.scale}
                      y1="-4"
                      x2={layout.barLength * layout.scale}
                      y2="4"
                    />
                    <text x="0" y="16">
                      {layout.barLength.toLocaleString('en-US')} km
                    </text>
                  </g>
                </svg>
              </div>
            </div>

            <footer className="compare-view__foot">
              <div className="compare-summary">
                <Ruler size={16} aria-hidden="true" />
                <p>
                  {largest && smallest && largest.countryId !== smallest.countryId ? (
                    <>
                      <strong>{largest.name}</strong> is{' '}
                      <strong>{formatRatio(largest.area / smallest.area)}×</strong>{' '}
                      the area of {smallest.name}.{' '}
                      <span>
                        {formatAreaCompact(largest.area, units)} vs{' '}
                        {formatAreaCompact(smallest.area, units)}.
                      </span>
                    </>
                  ) : (
                    'All outlines share one true-area scale.'
                  )}
                </p>
              </div>
              <div className="compare-view__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={onClose}
                >
                  Back to map
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={onArrange}
                >
                  Line up on map
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </Modal>
  );
}
