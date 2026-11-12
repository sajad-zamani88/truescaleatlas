import {
  Crosshair,
  Eye,
  EyeOff,
  Layers3,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { COUNTRY_BY_ID } from '../data/countries';
import {
  SHAPE_COLORS,
  colorForShape,
  formatArea,
  formatLatitude,
  formatRatio,
  mercatorStretch,
} from '../lib/atlas';
import type { ActiveShape, Units } from '../types';

interface PlacesPanelProps {
  shapes: ActiveShape[];
  selectedId: string | null;
  units: Units;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelect: (countryId: string) => void;
  onToggleHidden: (countryId: string) => void;
  onFocus: (countryId: string) => void;
  onRemove: (countryId: string) => void;
  onRecolor: (countryId: string, colorId: string) => void;
  onRotate: (countryId: string, rotation: number) => void;
  onResetShape: (countryId: string) => void;
  onArrange: () => void;
  onClear: () => void;
  onCompare: () => void;
  onUnitsChange: (units: Units) => void;
}

export function PlacesPanel({
  shapes,
  selectedId,
  units,
  mobileOpen,
  onCloseMobile,
  onSelect,
  onToggleHidden,
  onFocus,
  onRemove,
  onRecolor,
  onRotate,
  onResetShape,
  onArrange,
  onClear,
  onCompare,
  onUnitsChange,
}: PlacesPanelProps) {
  const selectedShape =
    shapes.find((shape) => shape.countryId === selectedId) ?? null;
  const selectedCountry = selectedShape
    ? COUNTRY_BY_ID.get(selectedShape.countryId) ?? null
    : null;
  const visibleShapes = shapes.filter((shape) => !shape.hidden);
  const visibleCountries = visibleShapes
    .map((shape) => COUNTRY_BY_ID.get(shape.countryId))
    .filter((country): country is NonNullable<typeof country> => Boolean(country));
  const largest = visibleCountries.length
    ? visibleCountries.reduce((current, country) =>
        country.area > current.area ? country : current,
      )
    : null;
  const smallest = visibleCountries.length
    ? visibleCountries.reduce((current, country) =>
        country.area < current.area ? country : current,
      )
    : null;
  let relationshipText = '';
  if (visibleCountries.length <= 1 && largest) {
    relationshipText =
      'Only place on the map. Add another to read a direct ratio.';
  } else if (selectedCountry && largest && smallest) {
    const relationships: string[] = [];
    if (selectedCountry.id === largest.id) {
      relationships.push('Largest active outline');
    } else {
      relationships.push(
        `${formatRatio(selectedCountry.area / largest.area)}× the area of ${largest.name}`,
      );
    }
    if (selectedCountry.id === smallest.id) {
      relationships.push('smallest active outline');
    } else {
      relationships.push(
        `${formatRatio(selectedCountry.area / smallest.area)}× the area of ${smallest.name}`,
      );
    }
    relationshipText = `${relationships.join(' · ')}.`;
  }

  return (
    <aside
      className={`places-panel ${mobileOpen ? 'is-open' : ''}`}
      aria-label="Active places"
    >
      <div className="places-panel__head">
        <div>
          <p className="eyebrow">Specimens on the map</p>
          <h2>
            Active places <span>{String(shapes.length).padStart(2, '0')}</span>
          </h2>
        </div>
        <div className="places-panel__head-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onArrange}
            disabled={visibleShapes.length < 2}
            aria-label="Arrange visible places side by side on the map"
            title="Line up at one latitude"
          >
            <Layers3 size={17} />
          </button>
          <button
            type="button"
            className="icon-button places-panel__close"
            onClick={onCloseMobile}
            aria-label="Close active places panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <p className="places-panel__hint">
        Select a place to inspect it. Drag its outline to move it across
        latitudes.
      </p>

      <ul className="places-list">
        {shapes.map((shape) => {
          const country = COUNTRY_BY_ID.get(shape.countryId);
          if (!country) return null;
          const color = colorForShape(shape);
          const isSelected = shape.countryId === selectedId;
          return (
            <li
              key={shape.countryId}
              className={`places-list__item ${
                isSelected ? 'is-selected' : ''
              } ${shape.hidden ? 'is-hidden' : ''}`}
            >
              <button
                type="button"
                className="place-row__main"
                onClick={() => onSelect(shape.countryId)}
                aria-pressed={isSelected}
              >
                <span
                  className="place-row__swatch"
                  style={{ background: color.hex }}
                  aria-hidden="true"
                />
                <span className="place-row__flag" aria-hidden="true">
                  {country.flag}
                </span>
                <span className="place-row__text">
                  <strong>{country.name}</strong>
                  <span>
                    {formatArea(country.area, units)} ·{' '}
                    {formatLatitude(shape.lat)}
                  </span>
                </span>
              </button>
              <div className="place-row__actions">
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => onToggleHidden(shape.countryId)}
                  aria-label={`${shape.hidden ? 'Show' : 'Hide'} ${country.name}`}
                  title={shape.hidden ? 'Show on map' : 'Hide from map'}
                >
                  {shape.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => onFocus(shape.countryId)}
                  aria-label={`Focus the map on ${country.name}`}
                  title="Focus on map"
                >
                  <Crosshair size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--small place-row__remove"
                  onClick={() => onRemove(shape.countryId)}
                  aria-label={`Remove ${country.name}`}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {selectedShape && selectedCountry && (
        <section className="place-detail" aria-labelledby="place-detail-title">
          <div className="place-detail__top">
            <span
              className="place-detail__color"
              style={{ background: colorForShape(selectedShape).hex }}
              aria-hidden="true"
            />
            <div>
              <p>
                {selectedCountry.region}
                {selectedCountry.subregion
                  ? ` · ${selectedCountry.subregion}`
                  : ''}
              </p>
              <h3 id="place-detail-title">
                {selectedCountry.flag} {selectedCountry.name}
              </h3>
            </div>
            <span className="place-detail__stamp" aria-hidden="true">
              {selectedCountry.id}
            </span>
          </div>

          <dl className="place-metrics">
            <div>
              <dt>True area</dt>
              <dd>{formatArea(selectedCountry.area, units)}</dd>
            </div>
            <div>
              <dt>Latitude</dt>
              <dd>{formatLatitude(selectedShape.lat)}</dd>
            </div>
            <div>
              <dt>Mercator stretch</dt>
              <dd>×{mercatorStretch(selectedShape.lat).toFixed(2)}</dd>
            </div>
          </dl>

          <p className="place-detail__relation">
            {relationshipText}
          </p>

          <div className="place-detail__palette">
            <span>Ink</span>
            <div className="swatches" role="group" aria-label="Outline color">
              {SHAPE_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`swatch ${
                    selectedShape.colorId === color.id ? 'is-active' : ''
                  }`}
                  style={{ background: color.hex }}
                  onClick={() => onRecolor(selectedShape.countryId, color.id)}
                  aria-label={`Use ${color.name}`}
                  aria-pressed={selectedShape.colorId === color.id}
                />
              ))}
            </div>
          </div>

          <label className="rotate-control">
            <span>Rotate</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={selectedShape.rotation}
              onChange={(event) =>
                onRotate(
                  selectedShape.countryId,
                  Number(event.target.value),
                )
              }
            />
            <output>{selectedShape.rotation}°</output>
          </label>

          <div className="place-detail__actions">
            <button
              type="button"
              className="text-button"
              onClick={() => onResetShape(selectedShape.countryId)}
            >
              <RotateCcw size={14} />
              Reset place
            </button>
            <button
              type="button"
              className="text-button text-button--danger"
              onClick={() => onRemove(selectedShape.countryId)}
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        </section>
      )}

      <div className="places-panel__foot">
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
          className="text-button text-button--danger places-panel__clear"
          onClick={onClear}
        >
          Clear map
        </button>
        <button
          type="button"
          className="button button--small button--primary places-panel__compare"
          onClick={onCompare}
          disabled={visibleShapes.length < 2}
        >
          Scale table
        </button>
      </div>
    </aside>
  );
}
