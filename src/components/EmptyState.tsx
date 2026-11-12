import { ArrowUpRight, Move, Search, TableProperties } from 'lucide-react';
import {
  COUNTRY_BY_ID,
  FIELD_STUDIES,
} from '../data/countries';

interface EmptyStateProps {
  onFieldStudy: (countryIds: [string, string]) => void;
  onHelp: () => void;
}

const steps = [
  {
    icon: Search,
    title: 'Find a place',
    copy: 'Search 242 countries and territories from open boundary data.',
  },
  {
    icon: Move,
    title: 'Move the latitude',
    copy: 'Drag its outline north or south. Mercator stretches; true area holds.',
  },
  {
    icon: TableProperties,
    title: 'Read the scale',
    copy: 'Line up several places at one common scale in the field table.',
  },
];

export function EmptyState({ onFieldStudy, onHelp }: EmptyStateProps) {
  return (
    <section className="empty-card" aria-labelledby="empty-title">
      <div className="empty-card__topline">
        <span>Field note 001</span>
        <span>Free &amp; open</span>
      </div>

      <div className="empty-card__stamp" aria-hidden="true">
        TRUE
        <br />
        SCALE
      </div>

      <p className="eyebrow">A working atlas of real proportions</p>
      <h1 id="empty-title">
        See the world
        <br />
        at its actual scale.
      </h1>
      <p className="empty-card__lede">
        Mercator maps stretch the poles. Add a place, drag it across
        latitudes, and watch its true footprint hold steady.
      </p>

      <ol className="empty-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title}>
              <span className="empty-steps__num">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Icon size={17} aria-hidden="true" />
              <div>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="field-studies">
        <div className="field-studies__head">
          <span>Open a field study</span>
          <span>2 places · one scale</span>
        </div>
        {FIELD_STUDIES.map((study) => {
          const first = COUNTRY_BY_ID.get(study.countryIds[0]);
          const second = COUNTRY_BY_ID.get(study.countryIds[1]);
          return (
            <button
              type="button"
              className="field-study"
              key={study.label}
              onClick={() => onFieldStudy(study.countryIds)}
            >
              <span className="field-study__flags" aria-hidden="true">
                <span>{first?.flag}</span>
                <span>{second?.flag}</span>
              </span>
              <span>{study.label}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="empty-card__foot">
        <button type="button" className="text-link" onClick={onHelp}>
          How the map works <span aria-hidden="true">↗</span>
        </button>
        <span>Natural Earth boundaries · OSM base map</span>
      </div>
    </section>
  );
}
