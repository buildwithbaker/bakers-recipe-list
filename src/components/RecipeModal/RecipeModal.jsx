import { useEffect, useMemo, useState } from 'react';
import styles from './RecipeModal.module.css';
import MacroCard from '../MacroCard/MacroCard.jsx';
import { estimateServings } from '../../utils/estimateServings.js';
import { estimateMacros } from '../../utils/estimateMacros.js';

const MACRO_EXCLUDED_SECTIONS = new Set(['SEASONINGS', 'DOUGHS']);

function isUrl(str) {
  return typeof str === 'string' && /^https?:\/\//i.test(str);
}

function MetaLine({ recipe, servingEstimate }) {
  const tags = recipe.tags?.length ? recipe.tags.join(' ') : '';
  const hasSource = recipe.source && recipe.source !== 'Original';
  return (
    <div className={styles.modalMeta}>
      {tags && <span>{tags}</span>}
      {tags && <span> · </span>}
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
      {servingEstimate && (
        <>
          <span> · </span>
          <span
            className={styles.servingEstimate}
            title={`${servingEstimate.basis} — actual yield may vary`}
          >
            ~{servingEstimate.servings} servings*
          </span>
        </>
      )}
    </div>
  );
}

function Ingredients({ items }) {
  if (!items?.length) return null;
  return (
    <>
      <div className={styles.modalSectionTitle}>Ingredients</div>
      <ul className={styles.ingList}>
        {items.map((ing, i) => (
          <li key={i} className={
            ing.type === 'section' ? styles.ingSection :
            ing.type === 'header' ? styles.ingHeader : ''
          }>
            {ing.text}
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
            return (
              <div key={i} className={styles.verHeader}>
                {s.step}
              </div>
            );
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

export default function RecipeModal({ recipe, onClose }) {
  // Compute serving estimate synchronously when the recipe changes.
  const servingEstimate = useMemo(
    () => (recipe ? estimateServings(recipe) : null),
    [recipe]
  );

  // Macro estimation is async (USDA API). Reset state every time the recipe changes.
  const [macroState, setMacroState] = useState({ status: 'unavailable', macros: null });

  useEffect(() => {
    if (!recipe) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [recipe, onClose]);

  useEffect(() => {
    if (!recipe || recipe.is_blank || MACRO_EXCLUDED_SECTIONS.has(recipe.section)) {
      setMacroState({ status: 'unavailable', macros: null });
      return;
    }
    if (!servingEstimate) {
      setMacroState({ status: 'unavailable', macros: null });
      return;
    }

    let cancelled = false;
    setMacroState({ status: 'loading', macros: null });
    estimateMacros(recipe, servingEstimate.servings)
      .then((macros) => {
        if (cancelled) return;
        if (!macros) {
          setMacroState({ status: 'unavailable', macros: null });
          return;
        }
        if (macros.matchedCount === 0) {
          // Differentiate rate-limited (transient) from genuine no-match
          setMacroState({
            status: macros.rateLimited ? 'rate-limited' : 'unavailable',
            macros: null,
          });
          return;
        }
        setMacroState({
          status: 'done',
          macros,
          matchedCount: macros.matchedCount,
          totalCount: macros.totalCount,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setMacroState({ status: 'error', macros: null });
      });

    return () => {
      cancelled = true;
    };
  }, [recipe, servingEstimate]);

  if (!recipe) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <div>
            <div id="modal-title" className={styles.modalTitle}>{recipe.name}</div>
            <MetaLine recipe={recipe} servingEstimate={servingEstimate} />
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>
        <div className={styles.modalBody}>
          {recipe.is_blank ? (
            <div className={styles.comingSoon}>🍳 Recipe coming soon — this one is on the list!</div>
          ) : (
            <>
              <Ingredients items={recipe.ingredients} />
              <Instructions steps={recipe.instructions} />
              <MacroCard
                status={macroState.status}
                macros={macroState.macros}
                matchedCount={macroState.matchedCount}
                totalCount={macroState.totalCount}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
