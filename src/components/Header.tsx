import { CircleHelp, Info, Layers3, Share2 } from 'lucide-react';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';
import type { Country, Units } from '../types';

interface HeaderProps {
  activeIds: Set<string>;
  visibleCount: number;
  shapeCount: number;
  units: Units;
  onSelectCountry: (country: Country) => void;
  onCompare: () => void;
  onShare: () => void;
  onHelp: () => void;
  onAbout: () => void;
}

export function Header({
  activeIds,
  visibleCount,
  shapeCount,
  units,
  onSelectCountry,
  onCompare,
  onShare,
  onHelp,
  onAbout,
}: HeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__brand">
        <Logo />
        <span className="site-header__edition">EST. 2026 · WORLD SURVEY</span>
      </div>

      <SearchBox
        activeIds={activeIds}
        units={units}
        onSelectCountry={onSelectCountry}
      />

      <nav className="site-header__actions" aria-label="Atlas actions">
        <button
          type="button"
          className="header-action"
          onClick={onHelp}
          aria-label="How the atlas works"
          title="How the atlas works"
        >
          <CircleHelp size={17} aria-hidden="true" />
          <span>How it works</span>
        </button>
        <button
          type="button"
          className="header-action header-action--compare"
          onClick={onCompare}
          disabled={visibleCount < 2}
          aria-label="Open the equal-area scale table"
          title={
            visibleCount < 2
              ? 'Add at least two visible places to compare'
              : 'Open the equal-area scale table'
          }
        >
          <Layers3 size={17} aria-hidden="true" />
          <span>Compare</span>
          {shapeCount > 0 && (
            <span className="header-action__count">{shapeCount}</span>
          )}
        </button>
        <button
          type="button"
          className="header-action header-action--primary"
          onClick={onShare}
          aria-label="Share this atlas"
          title="Share this atlas"
        >
          <Share2 size={16} aria-hidden="true" />
          <span>Share</span>
        </button>
        <button
          type="button"
          className="icon-button site-header__info"
          onClick={onAbout}
          aria-label="About this atlas and its data"
        >
          <Info size={18} />
        </button>
      </nav>
    </header>
  );
}
