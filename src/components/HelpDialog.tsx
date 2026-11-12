import { useId } from 'react';
import { Compass, GripVertical, Keyboard, Layers3, X } from 'lucide-react';
import { Modal } from './Modal';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const guideSteps = [
  {
    icon: Compass,
    number: '01',
    title: 'Add a place',
    copy: 'Search a country or territory. Its boundary arrives as a true-area outline, normalized from Natural Earth geometry.',
  },
  {
    icon: GripVertical,
    number: '02',
    title: 'Drag the latitude',
    copy: 'Move the outline north or south. The map stretches with latitude; the atlas compensates so the place keeps its real footprint.',
  },
  {
    icon: Layers3,
    number: '03',
    title: 'Compare the evidence',
    copy: 'Add several places, line them up at one latitude, or open the scale table to remove the map from the comparison entirely.',
  },
];

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const titleId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      className="help-backdrop"
    >
      <div className="help-view">
        <header className="dialog-head">
          <div>
            <p className="eyebrow">Field instructions · read once</p>
            <h2 id={titleId}>How to read a true scale</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close instructions"
            data-autofocus
          >
            <X size={20} />
          </button>
        </header>

        <p className="dialog-lede">
          Every flat world map makes a trade. This one uses the familiar
          Mercator base, then separates a place&apos;s true area from the
          distortion of its latitude.
        </p>

        <div className="guide-grid">
          {guideSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="guide-step" key={step.number}>
                <div className="guide-step__top">
                  <span>{step.number}</span>
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            );
          })}
        </div>

        <section className="correction-note">
          <div className="correction-note__formula">
            <span>Mercator stretch</span>
            <strong>× 1 / cos(latitude)</strong>
          </div>
          <p>
            At 60° north, a degree of longitude is drawn about twice as wide as
            at the equator. The atlas keeps each outline&apos;s represented
            ground area constant while the map beneath it changes.
          </p>
        </section>

        <section className="shortcut-note">
          <div>
            <Keyboard size={18} aria-hidden="true" />
            <strong>Keyboard survey</strong>
          </div>
          <p>
            <kbd>Tab</kbd> to an outline, then use the arrow keys to move it
            one degree. Hold <kbd>Shift</kbd> for five-degree steps. The active
            places panel carries every visibility and color control.
          </p>
        </section>

        <footer className="dialog-actions">
          <p>
            Free map tiles. Public-domain boundaries. No account required.
          </p>
          <button
            type="button"
            className="button button--primary"
            onClick={onClose}
          >
            Back to the map
          </button>
        </footer>
      </div>
    </Modal>
  );
}
