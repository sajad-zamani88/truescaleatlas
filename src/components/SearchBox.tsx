import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Search, X } from 'lucide-react';
import {
  COUNTRIES,
  FEATURED_IDS,
  REGIONS,
} from '../data/countries';
import { formatArea } from '../lib/atlas';
import type { Country, Region, Units } from '../types';

interface SearchBoxProps {
  activeIds: Set<string>;
  units: Units;
  onSelectCountry: (country: Country) => void;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function rankCountry(country: Country, query: string) {
  const name = normalize(country.name);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/[\s-]+/).some((word) => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  const aliases = country.aliases.map(normalize);
  if (aliases.some((alias) => alias.startsWith(query))) return 4;
  if (aliases.some((alias) => alias.includes(query))) return 5;
  return Number.POSITIVE_INFINITY;
}

export function SearchBox({
  activeIds,
  units,
  onSelectCountry,
}: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<Region | 'All'>('All');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = 'country-search-results';

  const results = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) {
      if (region !== 'All') {
        return COUNTRIES.filter((country) => country.region === region)
          .sort((a, b) => b.area - a.area || a.name.localeCompare(b.name))
          .slice(0, 80);
      }
      return FEATURED_IDS.map((id) =>
        COUNTRIES.find((country) => country.id === id),
      ).filter((country): country is Country => Boolean(country));
    }

    return COUNTRIES.filter(
      (country) => region === 'All' || country.region === region,
    )
      .map((country) => ({
        country,
        score: rankCountry(country, normalizedQuery),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort(
        (a, b) =>
          a.score - b.score ||
          b.country.area - a.country.area ||
          a.country.name.localeCompare(b.country.name),
      )
      .slice(0, 80)
      .map((entry) => entry.country);
  }, [query, region]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, region]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        document.body.classList.contains('dialog-open')
      ) {
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        active?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  const choose = (country: Country) => {
    onSelectCountry(country);
    setOpen(false);
    setActiveIndex(-1);
    setQuery('');
    setRegion('All');
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open && results.length > 0) {
      event.preventDefault();
      const country = results[activeIndex >= 0 ? activeIndex : 0];
      if (country) choose(country);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  };

  const showResults = open;

  return (
    <div className="search" ref={rootRef}>
      <div className={`search__field ${open ? 'is-open' : ''}`}>
        <Search size={17} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={
            showResults && results.length > 0 ? listId : undefined
          }
          aria-activedescendant={
            activeIndex >= 0
              ? `country-option-${results[activeIndex]?.id ?? ''}`
              : undefined
          }
          aria-label="Search countries and territories"
          placeholder="Search a country or territory"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="icon-button icon-button--small search__clear"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
        <span className="search__key" aria-hidden="true">
          /
        </span>
      </div>

      {showResults && (
        <div className="search__panel">
          <div className="search__filters" aria-label="Filter by region">
            {REGIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`filter-chip ${
                  region === item ? 'is-active' : ''
                }`}
                aria-pressed={region === item}
                onClick={() => {
                  setRegion(item);
                  setActiveIndex(-1);
                }}
              >
                {item === 'All' ? 'All regions' : item}
              </button>
            ))}
          </div>

          <div className="search__meta">
            <span>
              {query.trim()
                ? `${results.length} match${results.length === 1 ? '' : 'es'}`
                : region === 'All'
                  ? 'Quick picks'
                  : `${region} · ${results.length} places`}
            </span>
            <span>Natural Earth · free & open</span>
          </div>

          {results.length === 0 ? (
            <div className="search__empty">
              <Search size={22} aria-hidden="true" />
              <p>No place found for “{query.trim()}”.</p>
              <span>Try a shorter spelling, or browse a region.</span>
            </div>
          ) : (
            <ul
              className="search__results"
              id={listId}
              role="listbox"
              aria-label="Country search results"
            >
              {results.map((country, index) => {
                const active = activeIds.has(country.id);
                return (
                  <li key={country.id}>
                    <button
                      type="button"
                      id={`country-option-${country.id}`}
                      role="option"
                      aria-selected={activeIndex === index}
                      className={`result-row ${
                        activeIndex === index ? 'is-highlighted' : ''
                      } ${active ? 'is-on-map' : ''}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(country)}
                    >
                      <span className="result-row__flag" aria-hidden="true">
                        {country.flag}
                      </span>
                      <span className="result-row__main">
                        <strong>{country.name}</strong>
                        <span>
                          {country.region}
                          {country.subregion ? ` · ${country.subregion}` : ''}
                        </span>
                      </span>
                      <span className="result-row__area">
                        {formatArea(country.area, units)}
                        {active && <em>On map</em>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="search__foot">
            <span>
              <kbd>↑</kbd><kbd>↓</kbd> browse
            </span>
            <span>
              <kbd>↵</kbd> add to map
            </span>
            <span>
              <kbd>esc</kbd> close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
