import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronUp, Layers3, RefreshCw } from 'lucide-react';
import { AboutDialog } from './components/AboutDialog';
import { CompareView } from './components/CompareView';
import { ConfirmClearDialog } from './components/ConfirmClearDialog';
import { EmptyState } from './components/EmptyState';
import { Header } from './components/Header';
import { HelpDialog } from './components/HelpDialog';
import { Logo } from './components/Logo';
import {
  MapStage,
  type MapStageHandle,
} from './components/MapStage';
import { PlacesPanel } from './components/PlacesPanel';
import { Toast, type ToastTone } from './components/Toast';
import {
  COUNTRY_BY_ID,
} from './data/countries';
import {
  COLOR_BY_ID,
  DEFAULT_VIEW,
  MAX_SHAPES,
  SHAPE_COLORS,
  buildPayload,
  buildShareUrl,
  clampLatitude,
  decodeAtlasState,
  encodeAtlasState,
  pickNextColor,
  wrapLongitude,
} from './lib/atlas';
import type {
  ActiveShape,
  Country,
  MapView,
  Units,
} from './types';

interface InitialAtlasState {
  shapes: ActiveShape[];
  selectedId: string | null;
  view: MapView;
  compareOpen: boolean;
  units: Units;
  invalidLink: boolean;
}

interface ToastState {
  message: string;
  tone: ToastTone;
  key: number;
}

function readStoredUnits(): Units {
  try {
    return window.localStorage.getItem('truescale-units') === 'mi'
      ? 'mi'
      : 'km';
  } catch {
    return 'km';
  }
}

function readInitialState(): InitialAtlasState {
  const units = readStoredUnits();
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get('atlas');
  if (!encoded) {
    return {
      shapes: [],
      selectedId: null,
      view: DEFAULT_VIEW,
      compareOpen: false,
      units,
      invalidLink: false,
    };
  }

  const payload = decodeAtlasState(encoded);
  if (!payload) {
    return {
      shapes: [],
      selectedId: null,
      view: DEFAULT_VIEW,
      compareOpen: false,
      units,
      invalidLink: true,
    };
  }

  const seen = new Set<string>();
  const shapes: ActiveShape[] = [];
  for (const entry of payload.shapes.slice(0, MAX_SHAPES)) {
    const country = COUNTRY_BY_ID.get(entry.c);
    if (!country || seen.has(country.id)) continue;
    if (
      !Array.isArray(entry.p) ||
      entry.p.length !== 2 ||
      !Number.isFinite(entry.p[0]) ||
      !Number.isFinite(entry.p[1])
    ) {
      continue;
    }
    seen.add(country.id);
    shapes.push({
      countryId: country.id,
      colorId: COLOR_BY_ID.has(entry.k)
        ? entry.k
        : SHAPE_COLORS[shapes.length % SHAPE_COLORS.length].id,
      lat: clampLatitude(entry.p[0]),
      lng: wrapLongitude(entry.p[1]),
      rotation:
        Number.isFinite(entry.r) && Math.abs(entry.r) <= 360
          ? entry.r
          : 0,
      hidden: entry.h === 1,
    });
  }

  const selected =
    shapes.find((shape) => shape.countryId === payload.selected)?.countryId ??
    shapes.find((shape) => !shape.hidden)?.countryId ??
    shapes[0]?.countryId ??
    null;
  const visibleCount = shapes.filter((shape) => !shape.hidden).length;

  return {
    shapes,
    selectedId: selected,
    view: {
      lat: clampLatitude(payload.view[0]),
      lng: wrapLongitude(payload.view[1]),
      zoom: Math.max(2, Math.min(14, payload.view[2])),
    },
    compareOpen: payload.compare === 1 && visibleCount >= 2,
    units: payload.units === 'mi' ? 'mi' : units,
    invalidLink: payload.shapes.length > 0 && shapes.length === 0,
  };
}

function isDefaultView(view: MapView) {
  return (
    Math.abs(view.lat - DEFAULT_VIEW.lat) < 0.02 &&
    Math.abs(view.lng - DEFAULT_VIEW.lng) < 0.02 &&
    Math.abs(view.zoom - DEFAULT_VIEW.zoom) < 0.02
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path.
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

export default function App() {
  const initialStateRef = useRef<InitialAtlasState | null>(null);
  if (!initialStateRef.current) initialStateRef.current = readInitialState();
  const initialState = initialStateRef.current;

  const mapRef = useRef<MapStageHandle>(null);
  const toastTimerRef = useRef<number | null>(null);
  const invalidLinkShownRef = useRef(false);

  const [shapes, setShapes] = useState<ActiveShape[]>(initialState.shapes);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialState.selectedId,
  );
  const [view, setView] = useState<MapView>(initialState.view);
  const [units, setUnits] = useState<Units>(initialState.units);
  const [compareOpen, setCompareOpen] = useState(initialState.compareOpen);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const activeIds = useMemo(
    () => new Set(shapes.map((shape) => shape.countryId)),
    [shapes],
  );
  const visibleCount = shapes.filter((shape) => !shape.hidden).length;

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ message, tone, key: Date.now() });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 3900);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('truescale-units', units);
    } catch {
      // A blocked local preference does not affect the atlas.
    }
  }, [units]);

  useEffect(() => {
    if (visibleCount < 2 && compareOpen) setCompareOpen(false);
  }, [visibleCount, compareOpen]);

  useEffect(() => {
    if (!mapReady || !initialState.invalidLink || invalidLinkShownRef.current) {
      return;
    }
    invalidLinkShownRef.current = true;
    showToast(
      'That atlas link could not be read. Starting with a fresh survey sheet.',
      'error',
    );
  }, [initialState.invalidLink, mapReady, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const isClean =
        shapes.length === 0 &&
        !selectedId &&
        !compareOpen &&
        units === 'km' &&
        isDefaultView(view);
      const url = new URL(window.location.href);
      if (isClean) {
        url.searchParams.delete('atlas');
      } else {
        url.searchParams.set(
          'atlas',
          encodeAtlasState(
            buildPayload(
              shapes,
              view,
              selectedId,
              compareOpen,
              units,
            ),
          ),
        );
      }
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }, 280);
    return () => window.clearTimeout(timer);
  }, [shapes, selectedId, view, compareOpen, units]);

  const handleAddCountry = useCallback(
    (country: Country) => {
      const existing = shapes.find(
        (shape) => shape.countryId === country.id,
      );
      if (existing) {
        const shownShape = { ...existing, hidden: false };
        if (existing.hidden) {
          setShapes((current) =>
            current.map((shape) =>
              shape.countryId === country.id
                ? { ...shape, hidden: false }
                : shape,
            ),
          );
        }
        setSelectedId(country.id);
        setCompareOpen(false);
        setPlacesOpen(false);
        window.requestAnimationFrame(() =>
          mapRef.current?.focusShape(country, shownShape),
        );
        showToast(`${country.name} is already on the map.`, 'info');
        return;
      }

      if (shapes.length >= MAX_SHAPES) {
        showToast(
          `The survey sheet holds up to ${MAX_SHAPES} places. Remove one to add another.`,
          'error',
        );
        return;
      }

      const anchor =
        shapes.length === 0
          ? { lat: country.labelLat, lng: country.labelLng }
          : mapRef.current?.getAddAnchor(shapes.length) ?? {
              lat: country.labelLat,
              lng: country.labelLng,
            };
      const newShape: ActiveShape = {
        countryId: country.id,
        colorId: pickNextColor(shapes).id,
        lat: clampLatitude(anchor.lat),
        lng: wrapLongitude(anchor.lng),
        rotation: 0,
        hidden: false,
      };

      setShapes((current) => [...current, newShape]);
      setSelectedId(country.id);
      setCompareOpen(false);
      setPlacesOpen(false);

      if (shapes.length === 0) {
        window.setTimeout(() => {
          mapRef.current?.focusShape(country, newShape);
        }, 120);
      }
      showToast(
        `${country.name} added at its home latitude. Drag it to compare.`,
        'success',
      );
    },
    [shapes, showToast],
  );

  const handleFieldStudy = useCallback(
    (countryIds: [string, string]) => {
      const newShapes: ActiveShape[] = [];
      countryIds.forEach((id, index) => {
        const country = COUNTRY_BY_ID.get(id);
        if (!country) return;
        const anchor =
          mapRef.current?.getAddAnchor(index) ?? {
            lat: country.labelLat,
            lng: country.labelLng,
          };
        newShapes.push({
          countryId: country.id,
          colorId: SHAPE_COLORS[index % SHAPE_COLORS.length].id,
          lat: clampLatitude(anchor.lat),
          lng: wrapLongitude(anchor.lng),
          rotation: 0,
          hidden: false,
        });
      });

      if (newShapes.length < 2) return;
      setShapes(newShapes);
      setSelectedId(newShapes[0].countryId);
      setCompareOpen(true);
      setPlacesOpen(false);
      showToast('Field study opened at one common scale.', 'info');

      window.setTimeout(() => {
        const arranged = mapRef.current?.arrangeShapes(newShapes);
        if (!arranged?.length) return;
        const positions = new Map(
          arranged.map((entry) => [entry.countryId, entry]),
        );
        setShapes((current) =>
          current.map((shape) => {
            const position = positions.get(shape.countryId);
            return position
              ? { ...shape, lat: position.lat, lng: position.lng }
              : shape;
          }),
        );
      }, 160);
    },
    [showToast],
  );

  const handleToggleHidden = useCallback(
    (countryId: string) => {
      const target = shapes.find(
        (shape) => shape.countryId === countryId,
      );
      const country = COUNTRY_BY_ID.get(countryId);
      if (!target || !country) return;
      const nextHidden = !target.hidden;
      const nextShapes = shapes.map((shape) =>
        shape.countryId === countryId
          ? { ...shape, hidden: nextHidden }
          : shape,
      );
      setShapes(nextShapes);
      if (nextHidden) {
        if (selectedId === countryId) {
          const replacement = nextShapes.find((shape) => !shape.hidden);
          setSelectedId(replacement?.countryId ?? countryId);
        }
        showToast(`${country.name} hidden from the map.`, 'info');
      } else {
        setSelectedId(countryId);
        showToast(`${country.name} shown on the map.`, 'success');
      }
    },
    [shapes, selectedId, showToast],
  );

  const handleRemove = useCallback(
    (countryId: string) => {
      const country = COUNTRY_BY_ID.get(countryId);
      const nextShapes = shapes.filter(
        (shape) => shape.countryId !== countryId,
      );
      setShapes(nextShapes);
      if (selectedId === countryId) {
        setSelectedId(
          nextShapes.find((shape) => !shape.hidden)?.countryId ??
            nextShapes[0]?.countryId ??
            null,
        );
      }
      if (nextShapes.length === 0) {
        setCompareOpen(false);
        setPlacesOpen(false);
      }
      showToast(`${country?.name ?? 'Place'} removed.`, 'info');
    },
    [shapes, selectedId, showToast],
  );

  const handleFocus = useCallback(
    (countryId: string) => {
      const shape = shapes.find((entry) => entry.countryId === countryId);
      const country = COUNTRY_BY_ID.get(countryId);
      if (!shape || !country) return;
      mapRef.current?.focusShape(country, shape);
      setSelectedId(countryId);
      setPlacesOpen(false);
    },
    [shapes],
  );

  const handleRecolor = useCallback(
    (countryId: string, colorId: string) => {
      if (!COLOR_BY_ID.has(colorId)) return;
      setShapes((current) =>
        current.map((shape) =>
          shape.countryId === countryId ? { ...shape, colorId } : shape,
        ),
      );
    },
    [],
  );

  const handleRotate = useCallback(
    (countryId: string, rotation: number) => {
      setShapes((current) =>
        current.map((shape) =>
          shape.countryId === countryId ? { ...shape, rotation } : shape,
        ),
      );
    },
    [],
  );

  const handleResetShape = useCallback(
    (countryId: string) => {
      const country = COUNTRY_BY_ID.get(countryId);
      if (!country) return;
      const resetShape: ActiveShape = {
        countryId,
        colorId:
          shapes.find((shape) => shape.countryId === countryId)?.colorId ??
          SHAPE_COLORS[0].id,
        lat: country.labelLat,
        lng: country.labelLng,
        rotation: 0,
        hidden: false,
      };
      setShapes((current) =>
        current.map((shape) =>
          shape.countryId === countryId ? resetShape : shape,
        ),
      );
      setSelectedId(countryId);
      showToast(`${country.name} reset to its home position.`, 'success');
      window.setTimeout(
        () => mapRef.current?.focusShape(country, resetShape),
        80,
      );
    },
    [shapes, showToast],
  );

  const handleArrange = useCallback(() => {
    if (visibleCount < 2) {
      showToast('Add at least two visible places to line them up.', 'info');
      return;
    }
    const arranged = mapRef.current?.arrangeShapes(shapes);
    if (!arranged?.length) return;
    const positions = new Map(
      arranged.map((entry) => [entry.countryId, entry]),
    );
    setShapes((current) =>
      current.map((shape) => {
        const position = positions.get(shape.countryId);
        return position
          ? { ...shape, lat: position.lat, lng: position.lng }
          : shape;
      }),
    );
    setCompareOpen(false);
    setPlacesOpen(false);
    showToast('Visible outlines lined up at one latitude.', 'success');
  }, [shapes, visibleCount, showToast]);

  const handleClearConfirm = useCallback(() => {
    setShapes([]);
    setSelectedId(null);
    setCompareOpen(false);
    setClearOpen(false);
    setPlacesOpen(false);
    mapRef.current?.resetView();
    showToast('The survey sheet is clear.', 'success');
  }, [showToast]);

  const handleCompare = useCallback(() => {
    if (visibleCount < 2) {
      showToast('Add at least two visible places to compare.', 'info');
      return;
    }
    setPlacesOpen(false);
    setCompareOpen(true);
  }, [visibleCount, showToast]);

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(
      buildPayload(shapes, view, selectedId, compareOpen, units),
    );
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'TrueScale Atlas',
          text: 'Compare countries at their true geographic scale.',
          url,
        });
        showToast('Atlas link shared.', 'success');
        return;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return;
      }
    }
    const copied = await copyText(url);
    showToast(
      copied
        ? 'Share link copied — view, places, and colors included.'
        : 'Copy failed. Use the address bar to share this atlas.',
      copied ? 'success' : 'error',
    );
  }, [shapes, view, selectedId, compareOpen, units, showToast]);

  return (
    <div className="atlas-app">
      <a className="skip-link" href="#atlas-main">
        Skip to the atlas
      </a>

      <Header
        activeIds={activeIds}
        visibleCount={visibleCount}
        shapeCount={shapes.length}
        units={units}
        onSelectCountry={handleAddCountry}
        onCompare={handleCompare}
        onShare={handleShare}
        onHelp={() => setHelpOpen(true)}
        onAbout={() => setAboutOpen(true)}
      />

      <main id="atlas-main" className="atlas-main" tabIndex={-1}>
        <MapStage
          ref={mapRef}
          initialView={initialState.view}
          shapes={shapes}
          selectedId={selectedId}
          units={units}
          onSelect={(countryId) => setSelectedId(countryId)}
          onMoveShape={(countryId, lat, lng) => {
            setShapes((current) =>
              current.map((shape) =>
                shape.countryId === countryId
                  ? { ...shape, lat, lng }
                  : shape,
              ),
            );
          }}
          onViewChange={setView}
          onReady={() => setMapReady(true)}
          onTileError={() => setTileError(true)}
        />

        {mapReady && shapes.length === 0 && (
          <EmptyState
            onFieldStudy={handleFieldStudy}
            onHelp={() => setHelpOpen(true)}
          />
        )}

        {mapReady && shapes.length > 0 && (
          <PlacesPanel
            shapes={shapes}
            selectedId={selectedId}
            units={units}
            mobileOpen={placesOpen}
            onCloseMobile={() => setPlacesOpen(false)}
            onSelect={setSelectedId}
            onToggleHidden={handleToggleHidden}
            onFocus={handleFocus}
            onRemove={handleRemove}
            onRecolor={handleRecolor}
            onRotate={handleRotate}
            onResetShape={handleResetShape}
            onArrange={handleArrange}
            onClear={() => setClearOpen(true)}
            onCompare={handleCompare}
            onUnitsChange={setUnits}
          />
        )}

        {mapReady && shapes.length > 0 && !placesOpen && (
          <button
            type="button"
            className="places-trigger"
            onClick={() => setPlacesOpen((open) => !open)}
            aria-expanded={placesOpen}
          >
            <Layers3 size={17} />
            <span>
              {shapes.length} place{shapes.length === 1 ? '' : 's'}
            </span>
            <ChevronUp size={15} />
          </button>
        )}

        {tileError && (
          <div className="map-alert" role="alert">
            <RefreshCw size={17} aria-hidden="true" />
            <div>
              <strong>Map tiles are slow to arrive.</strong>
              <span>Outlines and comparisons still work.</span>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setTileError(false);
                mapRef.current?.retryTiles();
              }}
            >
              Retry
            </button>
          </div>
        )}
      </main>

      <div
        className={`loading-screen ${mapReady ? 'is-done' : ''}`}
        aria-hidden={mapReady}
      >
        <div className="loading-screen__inner">
          <Logo />
          <div className="loading-screen__rule" aria-hidden="true" />
          <p>Unrolling the survey map…</p>
          <span>Natural Earth boundaries · OpenStreetMap tiles</span>
        </div>
      </div>

      <CompareView
        open={compareOpen}
        shapes={shapes}
        units={units}
        onUnitsChange={setUnits}
        onClose={() => setCompareOpen(false)}
        onArrange={handleArrange}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ConfirmClearDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
      />

      {toast && (
        <Toast key={toast.key} message={toast.message} tone={toast.tone} />
      )}
    </div>
  );
}
