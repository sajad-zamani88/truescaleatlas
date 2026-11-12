import { useId } from 'react';
import { Database, ExternalLink, Map, ShieldCheck, X } from 'lucide-react';
import { Logo } from './Logo';
import { Modal } from './Modal';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const titleId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      className="about-backdrop"
    >
      <div className="about-view">
        <header className="dialog-head">
          <Logo compact />
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close about dialog"
            data-autofocus
          >
            <X size={20} />
          </button>
        </header>

        <p className="eyebrow">TrueScale Atlas · field instrument no. 01</p>
        <h2 id={titleId}>The map is the argument.</h2>
        <p className="dialog-lede">
          TrueScale Atlas is a small, independent cartographic instrument for
          seeing real proportions across a Mercator world. Add places, move
          their latitude, and compare the footprint that remains.
        </p>

        <div className="about-sources">
          <article>
            <Map size={19} aria-hidden="true" />
            <div>
              <h3>Map tiles</h3>
              <p>
                OpenStreetMap data and SRTM relief rendered by OpenTopoMap,
                served without a key. The warm survey tint is applied in the
                browser.
              </p>
              <a
                href="https://opentopomap.org/about"
                target="_blank"
                rel="noreferrer"
              >
                OpenTopoMap credits <ExternalLink size={12} />
              </a>
            </div>
          </article>
          <article>
            <Database size={19} aria-hidden="true" />
            <div>
              <h3>Boundaries and areas</h3>
              <p>
                Natural Earth 1:50m Admin 0 countries and territories. Areas are
                spherical estimates computed from the same boundary geometry,
                not from external population or country-statistics APIs.
              </p>
              <a
                href="https://www.naturalearthdata.com/"
                target="_blank"
                rel="noreferrer"
              >
                Natural Earth data <ExternalLink size={12} />
              </a>
            </div>
          </article>
          <article>
            <ShieldCheck size={19} aria-hidden="true" />
            <div>
              <h3>Privacy and state</h3>
              <p>
                No sign-in, profiles, or server-side comparison history. Your
                map view, colors, and positions live in the page URL and a small
                local unit preference. Search runs locally against the bundled
                dataset.
              </p>
            </div>
          </article>
        </div>

        <section className="method-note">
          <span>Method note</span>
          <p>
            Outlines use a local equal-area projection normalized to the
            place&apos;s true footprint. On the Mercator map they are re-scaled
            for the current latitude so the represented ground area stays
            constant. Borders are approximate, can be disputed, and are shown
            for geographic comparison rather than political endorsement.
          </p>
        </section>

        <footer className="dialog-actions">
          <p>Built with free and open map/data services only.</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
          >
            Close field notes
          </button>
        </footer>
      </div>
    </Modal>
  );
}
