import { useEffect, useId, useMemo, useState } from 'react';
import styles from './RecipeModal.module.css';
import MacroCard from '../MacroCard/MacroCard.jsx';
import { estimateServings } from '../../utils/estimateServings.js';
import { useMacroEstimate } from '../../hooks/useMacroEstimate.js';
import { parseIngredient } from '../../utils/parseIngredient.js';
import { formatQuantity } from '../../utils/fractions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUrl(str) {
  return typeof str === 'string' && /^https?:\/\//i.test(str);
}

// Scale an ingredient text string by a numeric factor, preserving as much of
// the original wording as possible. Falls back to unmodified text if parsing fails.
const LEADING_QTY_RE = /^([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘./\s]+)/;
function scaleIngredientText(text, scale) {
  if (scale === 1) return text;
  const parsed = parseIngredient(text);
  if (!parsed) return text;
  const newQty = parsed.quantity * scale;
  const qStr = formatQuantity(newQty);
  // Replace only the leading numeric portion, keeping unit + rest intact.
  const after = text.replace(LEADING_QTY_RE, '').trimStart();
  return after ? `${qStr} ${after}` : qStr;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetaLine({ recipe, servingEstimate, onTagClick, scale, onScaleDown, onScaleUp }) {
  const tags = recipe.tags?.length ? recipe.tags : [];
  const hasSource = recipe.source && recipe.source !== 'Original';
  return (
    <div className={styles.modalMeta}>
      {/* Clickable tags */}
      {tags.map((tag, i) => (
        <span key={tag}>
          {i > 0 && <span className={styles.metaSep}> </span>}
          <button
            type="button"
            className={styles.tagBtn}
            onClick={() => onTagClick?.(tag)}
            title={`Filter by ${tag}`}
          >
            {tag}
          </button>
        </span>
      ))}
      {tags.length > 0 && <span className={styles.metaSep}> · </span>}

      {/* Source */}
      {hasSource ? (
        <span>
          Source:{' '}
          {isUrl(recipe.source) ? (
            <a href={recipe.source} target="_blank" rel="noreferrer noopener" className={styles.sourceLink}>
              {recipe.source}
            </a>
          ) : (
            recipe.source
          )}
        </span>
      ) : (
        <span>Original recipe</span>
      )}

      {/* Serving estimate + scaler */}
      {servingEstimate && (
        <>
          <span className={styles.metaSep}> · </span>
          <span className={styles.scalerRow}>
            <button
              type="button"
              className={styles.scalerBtn}
              onClick={onScaleDown}
              aria-label="Fewer servings"
              disabled={scale <= 0.25}
            >−</button>
            <span
              className={styles.servingEstimate}
              title={`${servingEstimate.basis} — actual yield may vary`}
            >
              ~{Math.round(servingEstimate.servings * scale)} serving{Math.round(servingEstimate.servings * scale) !== 1 ? 's' : ''}
              {scale !== 1 && <span className={styles.scaleTag}> ×{scale % 1 === 0 ? scale : scale.toFixed(2)}</span>}
            </span>
            <button
              type="button"
              className={styles.scalerBtn}
              onClick={onScaleUp}
              aria-label="More servings"
              disabled={scale >= 4}
            >+</button>
          </span>
        </>
      )}
    </div>
  );
}

function Ingredients({ items, scale }) {
  const [copied, setCopied] = useState(false);

  if (!items?.length) return null;

  const handleCopy = () => {
    const text = items
      .filter((ing) => ing.type !== 'section')
      .map((ing) => ing.type === 'header' ? `\n${ing.text}` : scaleIngredientText(ing.text, scale))
      .join('\n')
      .trim();
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <>
      <div className={styles.sectionRow}>
        <div className={styles.modalSectionTitle}>Ingredients</div>
        <button
          type="button"
          className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
          onClick={handleCopy}
          aria-label="Copy ingredients to clipboard"
          title="Copy ingredients"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Copied
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </>
          )}
        </button>
      </div>
      <ul className={styles.ingList}>
        {items.map((ing, i) => (
          <li key={i} className={
            ing.type === 'section' ? styles.ingSection :
            ing.type === 'header' ? styles.ingHeader : ''
          }>
            {ing.type === 'item' ? scaleIngredientText(ing.text, scale) : ing.text}
          </li>
        ))}
      </ul>
    </>
  );
}

function Instructions({ steps }) {
  if (!steps?.length) return null;
  let stepNum = 0;
  return (
    <>
      <div className={styles.modalSectionTitle}>Instructions</div>
      <div className={styles.stepList}>
        {steps.map((s, i) => {
          if (s.type === 'section') {
            stepNum = 0;
            return <div key={i} className={styles.verHeader}>{s.step}</div>;
          }
          stepNum++;
          return (
            <div key={i} className={styles.stepItem}>
              <div className={styles.stepNum}>{stepNum}</div>
              <div>
                <div className={styles.stepName}>{s.step}</div>
                {s.detail && <div className={styles.stepDetail}>{s.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RecipeModal({ recipe, onClose, onTagClick }) {
  const titleId = useId();

  // Serving scale: 1 = as written, 0.5 = half, 2 = double, etc.
  const [scale, setScale] = useState(1);

  const servingEstimate = useMemo(
    () => (recipe ? estimateServings(recipe) : null),
    [recipe]
  );

  // All macro logic lives in the hook.
  const macroState = useMacroEstimate(recipe, servingEstimate);

  // Reset scale when a new recipe opens.
  useEffect(() => {
    setScale(1);
  }, [recipe]);

  // Effect 1: keyboard listener — synchronizes with recipe open/close and onClose identity.
  useEffect(() => {
    if (!recipe) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [recipe, onClose]);

  // Effect 2: body scroll lock — independent concern from the keyboard handler.
  useEffect(() => {
    if (!recipe) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [recipe]);

  if (!recipe) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Scale steps: 0.25 → 0.5 → 0.75 → 1 → 1.5 → 2 → 3 → 4
  const SCALE_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  const scaleIdx = SCALE_STEPS.indexOf(scale);
  const handleScaleDown = () => {
    if (scaleIdx > 0) setScale(SCALE_STEPS[scaleIdx - 1]);
  };
  const handleScaleUp = () => {
    if (scaleIdx < SCALE_STEPS.length - 1) setScale(SCALE_STEPS[scaleIdx + 1]);
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-print-modal
      >
        <div className={styles.modalHeader}>
          <div>
            <div id={titleId} className={styles.modalTitle}>{recipe.name}</div>
            <MetaLine
              recipe={recipe}
              servingEstimate={servingEstimate}
              onTagClick={onTagClick}
              scale={scale}
              onScaleDown={handleScaleDown}
              onScaleUp={handleScaleUp}
            />
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.printBtn}
              onClick={() => window.print()}
              aria-label="Print recipe"
              title="Print recipe"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
            </button>
            <button
              type="button"
              className={styles.modalClose}
              onClick={onClose}
              aria-label="Close"
            >
              &#x2715;
            </button>
          </div>
        </div>
        <div className={styles.modalBody}>
          {recipe.is_blank ? (
            <div className={styles.comingSoon}>🍳 Recipe coming soon — this one is on the list!</div>
          ) : (
            <>
              <Ingredients items={recipe.ingredients} scale={scale} />
              <Instructions steps={recipe.instructions} />
              <MacroCard {...macroState} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
