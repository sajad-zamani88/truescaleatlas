import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Globe2, Minus, Move, Plus } from 'lucide-react';
import { COUNTRY_BY_ID } from '../data/countries';
import {
  DEFAULT_VIEW,
  EARTH_RADIUS_KM,
  WORLD_TILE_SIZE,
  clampLatitude,
  colorForShape,
  fitZoomForCountry,
  formatAreaCompact,
  formatLatitude,
  formatLongitude,
  mercatorStretch,
  pixelsPerKmAt,
  wrapLongitude,
} from '../lib/atlas';
import type {
  ActiveShape,
  Country,
  MapView,
  Units,
} from '../types';

const TILE_URL =
  'https://tile.opentopomap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, SRTM · Style: <a href="https://opentopomap.org/about" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA) · Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>';

interface MapStageProps {
  initialView: MapView;
  shapes: ActiveShape[];
  selectedId: string | null;
  units: Units;
  onSelect: (countryId: string) => void;
  onMoveShape: (countryId: string, lat: number, lng: number) => void;
  onViewChange: (view: MapView) => void;
  onReady: () => void;
  onTileError: () => void;
}

export interface MapStageHandle {
  focusShape: (country: Country, shape: ActiveShape) => void;
  getAddAnchor: (index: number) => { lat: number; lng: number };
  arrangeShapes: (
    shapes: ActiveShape[],
  ) => Array<{ countryId: string; lat: number; lng: number }>;
  resetView: () => void;
  retryTiles: () => void;
}

interface DragState {
  countryId: string;
  pointerId: number;
  startX: number;
  startY: number;
  anchorX: number;
  anchorY: number;
  currentLat: number;
  currentLng: number;
  moved: boolean;
}

interface DragPreview {
  countryId: string;
  lat: number;
  lng: number;
}

const DRAG_OFFSETS = [
  [0, 0],
  [64, -34],
  [-64, 34],
  [124, 28],
  [-124, -28],
  [0, 92],
  [96, -92],
  [-96, 92],
  [172, 0],
  [-172, 0],
  [0, 150],
  [0, -150],
];

function linePath(points: L.Point[]) {
  if (points.length < 2) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
}

function buildGraticule(map: L.Map) {
  const meridians: string[] = [];
  const parallels: string[] = [];
  const tropics: string[] = [];

  for (let lng = -180; lng < 180; lng += 30) {
    const points: L.Point[] = [];
    for (let lat = -82; lat <= 82; lat += 4) {
      points.push(map.latLngToContainerPoint([lat, lng]));
    }
    meridians.push(linePath(points));
  }

  for (let lat = -60; lat <= 60; lat += 30) {
    const points: L.Point[] = [];
    for (let lng = -180; lng <= 180; lng += 5) {
      points.push(map.latLngToContainerPoint([lat, lng]));
    }
    parallels.push(linePath(points));
  }

  for (const lat of [-23.436, 23.436]) {
    const points: L.Point[] = [];
    for (let lng = -180; lng <= 180; lng += 5) {
      points.push(map.latLngToContainerPoint([lat, lng]));
    }
    tropics.push(linePath(points));
  }

  return { meridians, parallels, tropics };
}

export const MapStage = forwardRef<MapStageHandle, MapStageProps>(
  function MapStage(
    {
      initialView,
      shapes,
      selectedId,
      units,
      onSelect,
      onMoveShape,
      onViewChange,
      onReady,
      onTileError,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const tileRef = useRef<L.TileLayer | null>(null);
    const initialViewRef = useRef(initialView);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [, setTick] = useState(0);
    const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const tileErrorReportedRef = useRef(false);

    const callbacksRef = useRef({
      onSelect,
      onMoveShape,
      onViewChange,
      onReady,
      onTileError,
    });
    callbacksRef.current = {
      onSelect,
      onMoveShape,
      onViewChange,
      onReady,
      onTileError,
    };

    const installTileLayer = (map: L.Map, announceReady: boolean) => {
      if (tileRef.current) map.removeLayer(tileRef.current);
      const tile = L.tileLayer(TILE_URL, {
        minZoom: 2,
        maxZoom: 17,
        maxNativeZoom: 17,
        attribution: TILE_ATTRIBUTION,
        keepBuffer: 4,
      });
      tile.on('tileerror', () => {
        if (tileErrorReportedRef.current) return;
        tileErrorReportedRef.current = true;
        callbacksRef.current.onTileError();
      });
      if (announceReady) {
        tile.once('load', () => callbacksRef.current.onReady());
      }
      tile.addTo(map);
      tileRef.current = tile;
      return tile;
    };

    useEffect(() => {
      const container = containerRef.current;
      if (!container || mapRef.current) return;

      const map = L.map(container, {
        center: [initialViewRef.current.lat, initialViewRef.current.lng],
        zoom: initialViewRef.current.zoom,
        zoomControl: false,
        attributionControl: true,
        minZoom: 2,
        maxZoom: 14,
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 90,
        worldCopyJump: true,
        fadeAnimation: true,
        zoomAnimation: true,
      });
      mapRef.current = map;
      map.attributionControl.setPrefix(false);

      L.control
        .scale({
          position: 'bottomright',
          metric: true,
          imperial: false,
          maxWidth: 110,
        })
        .addTo(map);

      installTileLayer(map, true);

      const readyFallback = window.setTimeout(
        () => callbacksRef.current.onReady(),
        1300,
      );

      const updateSize = () => {
        if (!mapRef.current) return;
        const mapSize = map.getSize();
        setSize((current) =>
          current.width === mapSize.x && current.height === mapSize.y
            ? current
            : { width: mapSize.x, height: mapSize.y },
        );
        setTick((value) => value + 1);
      };

      let frame = 0;
      const scheduleDraw = () => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          updateSize();
        });
      };

      const reportView = () => {
        const center = map.getCenter();
        callbacksRef.current.onViewChange({
          lat: center.lat,
          lng: center.lng,
          zoom: map.getZoom(),
        });
      };

      map.on('move zoom resize viewreset', scheduleDraw);
      map.on('moveend zoomend', reportView);
      map.whenReady(() => {
        updateSize();
        reportView();
      });

      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
        updateSize();
      });
      resizeObserver.observe(container);

      return () => {
        window.clearTimeout(readyFallback);
        if (frame) window.cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        map.off();
        map.remove();
        mapRef.current = null;
        tileRef.current = null;
        document.body.classList.remove('is-dragging-shape');
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focusShape(country, shape) {
          const map = mapRef.current;
          if (!map) return;
          const mapSize = map.getSize();
          const lat = clampLatitude(shape.lat);
          const zoom = fitZoomForCountry(
            country,
            lat,
            mapSize.x,
            mapSize.y,
          );
          map.flyTo(
            [lat, wrapLongitude(shape.lng)],
            Math.max(zoom, 2.4),
            {
              duration: 0.8,
              easeLinearity: 0.2,
            },
          );
        },

        getAddAnchor(index) {
          const map = mapRef.current;
          if (!map) {
            const fallback = COUNTRY_BY_ID.get('GRL');
            return {
              lat: fallback?.labelLat ?? 18,
              lng: fallback?.labelLng ?? 8,
            };
          }
          const mapSize = map.getSize();
          const [offsetX, offsetY] =
            DRAG_OFFSETS[index % DRAG_OFFSETS.length] ?? [0, 0];
          const latLng = map.containerPointToLatLng([
            mapSize.x / 2 + offsetX,
            mapSize.y / 2 + offsetY,
          ]);
          return {
            lat: clampLatitude(latLng.lat),
            lng: wrapLongitude(latLng.lng),
          };
        },

        arrangeShapes(activeShapes) {
          const map = mapRef.current;
          if (!map) return [];
          const visible = activeShapes
            .filter((shape) => !shape.hidden)
            .map((shape) => ({
              shape,
              country: COUNTRY_BY_ID.get(shape.countryId),
            }))
            .filter(
              (
                entry,
              ): entry is {
                shape: ActiveShape;
                country: Country;
              } => Boolean(entry.country),
            );
          if (visible.length === 0) return [];

          const mapSize = map.getSize();
          const center = map.getCenter();
          const targetLat = clampLatitude(center.lat);
          const panelInset = window.innerWidth > 900 ? 376 : 24;
          const usableWidth = Math.max(
            280,
            mapSize.x - panelInset - 24,
          );
          const basePerZoom =
            WORLD_TILE_SIZE /
            (2 * Math.PI * EARTH_RADIUS_KM) *
            mercatorStretch(targetLat);
          const gap = visible.length > 4 ? 34 : 54;
          const horizontalSpace = Math.max(280, usableWidth * 0.94);
          const verticalSpace = Math.max(220, mapSize.y * 0.5);
          const sumWidths = visible.reduce(
            (total, entry) =>
              total + Math.max(1, entry.country.bounds[2] - entry.country.bounds[0]),
            0,
          );
          const maxHeight = Math.max(
            ...visible.map((entry) =>
              Math.max(1, entry.country.bounds[3] - entry.country.bounds[1]),
            ),
          );
          const zoomForWidth = Math.log2(
            Math.max(
              1,
              horizontalSpace - gap * Math.max(0, visible.length - 1),
            ) /
              Math.max(1, sumWidths * basePerZoom),
          );
          const zoomForHeight = Math.log2(
            verticalSpace / Math.max(1, maxHeight * basePerZoom),
          );
          let zoom = Math.max(
            2,
            Math.min(8, zoomForWidth, zoomForHeight),
          );
          zoom = Number(zoom.toFixed(1));

          map.setView([targetLat, center.lng], zoom, { animate: false });

          let scale = pixelsPerKmAt(targetLat, zoom);
          let columnWidths = visible.map((entry) =>
            Math.max(
              (entry.country.bounds[2] - entry.country.bounds[0]) * scale,
              78,
            ),
          );
          let totalWidth =
            columnWidths.reduce((total, width) => total + width, 0) +
            gap * Math.max(0, visible.length - 1);

          if (totalWidth > horizontalSpace) {
            const correction = Math.log2(horizontalSpace / totalWidth);
            zoom = Number(Math.max(2, zoom + correction).toFixed(1));
            map.setZoom(zoom, { animate: false });
            scale = pixelsPerKmAt(targetLat, zoom);
            columnWidths = visible.map((entry) =>
              Math.max(
                (entry.country.bounds[2] - entry.country.bounds[0]) * scale,
                78,
              ),
            );
            totalWidth =
              columnWidths.reduce((total, width) => total + width, 0) +
              gap * Math.max(0, visible.length - 1);
          }

          const startX = panelInset + (usableWidth - totalWidth) / 2;
          const targetY = mapSize.y * 0.52;
          let cursorX = startX;

          return visible.map((entry, index) => {
            const [minX, , maxX] = entry.country.bounds;
            const centerX = (minX + maxX) / 2;
            const columnWidth = columnWidths[index];
            const columnCenter = cursorX + columnWidth / 2;
            cursorX += columnWidth + gap;

            const anchorX = columnCenter - centerX * scale;
            const anchorY = targetY;
            const latLng = map.containerPointToLatLng([anchorX, anchorY]);
            return {
              countryId: entry.shape.countryId,
              lat: clampLatitude(latLng.lat),
              lng: wrapLongitude(latLng.lng),
            };
          });
        },

        resetView() {
          mapRef.current?.flyTo(
            [DEFAULT_VIEW.lat, DEFAULT_VIEW.lng],
            DEFAULT_VIEW.zoom,
            { duration: 0.8 },
          );
        },

        retryTiles() {
          const map = mapRef.current;
          if (!map) return;
          tileErrorReportedRef.current = false;
          installTileLayer(map, false);
        },
      }),
      [],
    );

    const beginDrag = (
      event: ReactPointerEvent<SVGGElement>,
      shape: ActiveShape,
    ) => {
      if (event.button !== 0) return;
      const map = mapRef.current;
      if (!map) return;
      event.preventDefault();
      event.stopPropagation();
      callbacksRef.current.onSelect(shape.countryId);

      const anchor = map.latLngToContainerPoint([shape.lat, shape.lng]);
      const drag: DragState = {
        countryId: shape.countryId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        anchorX: anchor.x,
        anchorY: anchor.y,
        currentLat: shape.lat,
        currentLng: shape.lng,
        moved: false,
      };
      dragRef.current = drag;
      setDragPreview({
        countryId: shape.countryId,
        lat: shape.lat,
        lng: shape.lng,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      document.body.classList.add('is-dragging-shape');
    };

    const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
      const drag = dragRef.current;
      const map = mapRef.current;
      if (!drag || !map || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (Math.hypot(deltaX, deltaY) > 2) drag.moved = true;
      const latLng = map.containerPointToLatLng([
        drag.anchorX + deltaX,
        drag.anchorY + deltaY,
      ]);
      drag.currentLat = clampLatitude(latLng.lat);
      drag.currentLng = wrapLongitude(latLng.lng);
      setDragPreview({
        countryId: drag.countryId,
        lat: drag.currentLat,
        lng: drag.currentLng,
      });
    };

    const finishDrag = (event: ReactPointerEvent<SVGGElement>) => {
      const drag = dragRef.current;
      const map = mapRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();

      if (drag.moved) {
        callbacksRef.current.onMoveShape(
          drag.countryId,
          drag.currentLat,
          drag.currentLng,
        );
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      setDragPreview(null);
      if (map) {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
      }
      document.body.classList.remove('is-dragging-shape');
    };

    const handleShapeKeyDown = (
      event: ReactKeyboardEvent<SVGGElement>,
      shape: ActiveShape,
    ) => {
      const step = event.shiftKey ? 5 : 1;
      let lat = shape.lat;
      let lng = shape.lng;
      if (event.key === 'ArrowUp') lat += step;
      else if (event.key === 'ArrowDown') lat -= step;
      else if (event.key === 'ArrowLeft') lng -= step;
      else if (event.key === 'ArrowRight') lng += step;
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        callbacksRef.current.onSelect(shape.countryId);
        return;
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      callbacksRef.current.onSelect(shape.countryId);
      callbacksRef.current.onMoveShape(
        shape.countryId,
        clampLatitude(lat),
        wrapLongitude(lng),
      );
    };

    const handleWheel = (
      event: ReactWheelEvent<SVGGElement>,
      shape: ActiveShape,
    ) => {
      const map = mapRef.current;
      if (!map) return;
      event.preventDefault();
      event.stopPropagation();
      callbacksRef.current.onSelect(shape.countryId);
      const bounds = map.getContainer().getBoundingClientRect();
      const point = L.point(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      );
      const latLng = map.containerPointToLatLng(point);
      const nextZoom = Math.max(
        2,
        Math.min(14, map.getZoom() + (event.deltaY < 0 ? 0.5 : -0.5)),
      );
      map.setZoomAround(latLng, nextZoom, { animate: false });
    };

    const map = mapRef.current;
    const zoom = map?.getZoom() ?? initialView.zoom;
    const graticule =
      map && size.width > 0 ? buildGraticule(map) : null;
    const readoutCenter = map?.getCenter();

    const visibleShapes = shapes
      .filter((shape) => !shape.hidden)
      .map((shape) => {
        const country = COUNTRY_BY_ID.get(shape.countryId);
        if (!country) return null;
        const preview =
          dragPreview?.countryId === shape.countryId ? dragPreview : null;
        const lat = preview?.lat ?? shape.lat;
        const lng = preview?.lng ?? shape.lng;
        const anchor =
          map && size.width > 0
            ? map.latLngToContainerPoint([lat, lng])
            : L.point(0, 0);
        return {
          shape,
          country,
          lat,
          lng,
          anchor,
          color: colorForShape(shape),
          scale: pixelsPerKmAt(lat, zoom),
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          shape: ActiveShape;
          country: Country;
          lat: number;
          lng: number;
          anchor: L.Point;
          color: ReturnType<typeof colorForShape>;
          scale: number;
        } => Boolean(entry),
      )
      .sort(
        (a, b) =>
          Number(a.shape.countryId === selectedId) -
          Number(b.shape.countryId === selectedId),
      );

    const visibleCount = shapes.filter((shape) => !shape.hidden).length;

    return (
      <div className="map-stage">
        <div ref={containerRef} className="map-canvas" />
        <div className="map-wash" aria-hidden="true" />

        <svg
          className="map-overlay"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
          role="group"
          aria-label="Interactive country outlines"
        >
          {graticule && (
            <g className="graticule" aria-hidden="true">
              {graticule.meridians.map((path, index) => (
                <path key={`meridian-${index}`} d={path} />
              ))}
              {graticule.parallels.map((path, index) => (
                <path key={`parallel-${index}`} d={path} />
              ))}
              {graticule.tropics.map((path, index) => (
                <path
                  key={`tropic-${index}`}
                  className="graticule__tropic"
                  d={path}
                />
              ))}
              {[-60, -30, 0, 30, 60].map((lat) => {
                if (!map) return null;
                const y = map.latLngToContainerPoint([lat, 0]).y;
                if (y < 78 || y > size.height - 38) return null;
                return (
                  <text
                    key={`lat-label-${lat}`}
                    className="graticule__label"
                    x={size.width - 16}
                    y={y - 5}
                    textAnchor="end"
                  >
                    {formatLatitude(lat)}
                  </text>
                );
              })}
            </g>
          )}

          {visibleShapes.map((item) => {
            const isSelected = item.shape.countryId === selectedId;
            const transform = `translate(${item.anchor.x} ${item.anchor.y}) rotate(${item.shape.rotation}) scale(${item.scale})`;
            return (
              <g
                key={item.shape.countryId}
                className={`country-outline ${
                  isSelected ? 'is-selected' : ''
                } ${dragPreview?.countryId === item.shape.countryId ? 'is-dragging' : ''}`}
                transform={transform}
                onPointerDown={(event) => beginDrag(event, item.shape)}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onWheel={(event) => handleWheel(event, item.shape)}
                onKeyDown={(event) =>
                  handleShapeKeyDown(event, item.shape)
                }
                tabIndex={0}
                role="button"
                aria-label={`${item.country.name}, ${formatAreaCompact(
                  item.country.area,
                  units,
                )}, at ${formatLatitude(item.lat)}. Drag with the mouse or arrow keys to move.`}
                aria-pressed={isSelected}
              >
                <title>
                  {item.country.name} · {formatAreaCompact(item.country.area, units)}
                  {' · '}drag to move
                </title>
                <path
                  className="country-outline__fill"
                  d={item.country.path}
                  fill={item.color.hex}
                  fillOpacity={isSelected ? 0.44 : 0.26}
                  stroke={item.color.hex}
                  strokeWidth={isSelected ? 2.6 : 1.6}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  className="country-outline__hit"
                  d={item.country.path}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={16}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="stroke"
                />
              </g>
            );
          })}

          {visibleShapes.map((item) => {
            if (
              item.anchor.x < -80 ||
              item.anchor.x > size.width + 80 ||
              item.anchor.y < -60 ||
              item.anchor.y > size.height + 60
            ) {
              return null;
            }
            const isSelected = item.shape.countryId === selectedId;
            const name = item.country.name;
            const areaLabel = formatAreaCompact(item.country.area, units);
            const sublabel = `${areaLabel} · ${formatLatitude(item.lat)}`;
            const width = Math.max(
              isSelected ? 124 : 76,
              (isSelected ? Math.max(name.length * 6.6, sublabel.length * 5.4) : name.length * 6.4) +
                28,
            );
            const height = isSelected ? 40 : 25;
            const top = -height / 2;
            return (
              <g
                key={`label-${item.shape.countryId}`}
                className={`country-label ${
                  isSelected ? 'is-selected' : ''
                }`}
                transform={`translate(${item.anchor.x} ${item.anchor.y})`}
                onPointerDown={(event) => beginDrag(event, item.shape)}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onWheel={(event) => handleWheel(event, item.shape)}
                aria-hidden="true"
              >
                <rect
                  className="country-label__bg"
                  x={-width / 2}
                  y={top}
                  width={width}
                  height={height}
                  rx={2}
                  stroke={item.color.hex}
                />
                <rect
                  x={-width / 2}
                  y={top}
                  width={4}
                  height={height}
                  fill={item.color.hex}
                />
                {isSelected ? (
                  <>
                    <text
                      className="country-label__name"
                      x={0}
                      y={-2}
                      textAnchor="middle"
                    >
                      {name}
                    </text>
                    <text
                      className="country-label__sub"
                      x={0}
                      y={12}
                      textAnchor="middle"
                    >
                      {sublabel}
                    </text>
                  </>
                ) : (
                  <text
                    className="country-label__name"
                    x={0}
                    y={4}
                    textAnchor="middle"
                  >
                    {name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="map-controls" role="group" aria-label="Map controls">
          <button
            type="button"
            className="map-control"
            onClick={() => mapRef.current?.zoomIn(0.7)}
            aria-label="Zoom in"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            className="map-control"
            onClick={() => mapRef.current?.zoomOut(0.7)}
            aria-label="Zoom out"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            className="map-control"
            onClick={() => mapRef.current?.flyTo(
              [DEFAULT_VIEW.lat, DEFAULT_VIEW.lng],
              DEFAULT_VIEW.zoom,
              { duration: 0.7 },
            )}
            aria-label="Reset map to world view"
          >
            <Globe2 size={17} />
          </button>
        </div>

        {readoutCenter && (
          <div className="map-readout" aria-hidden="true">
            <Compass size={13} />
            <span>
              {formatLatitude(readoutCenter.lat)} ·{' '}
              {formatLongitude(readoutCenter.lng)}
            </span>
            <span className="map-readout__divider">/</span>
            <span>Z{zoom.toFixed(1)}</span>
          </div>
        )}

        {visibleCount > 0 && (
          <div className="map-hint" aria-hidden="true">
            <Move size={14} />
            <span>Drag an outline. Its true area holds at every latitude.</span>
          </div>
        )}
      </div>
    );
  },
);
