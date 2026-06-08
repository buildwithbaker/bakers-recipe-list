import { Component, lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './RecipeModal.module.css';
import { estimateServings } from '../../utils/estimateServings.js';
import { useMacroEstimate } from '../../hooks/useMacroEstimate.js';
import { scaleIngredientText } from '../../utils/scaleIngredient.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { getEffectiveTags } from '../../utils/autoTags.js';

const MacroCard = lazy(() => import('../MacroCard/MacroCard.jsx'));

// Silent error boundary for the macro section — if the lazy chunk 404s after
// a new deployment, the macro card just disappears instead of crashing the modal.
class MacroErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

const SCALE_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUrl(str) {
  return typeof str === 'string' && /^https?:\/\//i.test(str);
}


function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetaLine({ recipe, servingEstimate, onTagClick, scale, onScaleDown, onScaleUp }) {
  const tags = getEffectiveTags(recipe);
  const hasSource = recipe.source && recipe.source !== 'Original';
  return (
    <div className={styles.modalMeta}>
      {tags.map((tag, i) => (
        <span key={tag}>
          {i > 0 && <span className={styles.metaSep}> </span>}
          <button type="button" className={styles.tagBtn} onClick={() => onTagClick?.(tag)} title={`Filter by ${tag}`}>
            {tag}
          </button>
        </span>
      ))}
      {tags.length > 0 && <span className={styles.metaSep}> · </span>}
      {hasSource ? (
        <span>
          Source:{' '}
          {isUrl(recipe.source) ? (
            <a href={recipe.source} target="_blank" rel="noreferrer noopener" className={styles.sourceLink}>{recipe.source}</a>
          ) : recipe.source}
        </span>
      ) : (
        <span>Original recipe</span>
      )}
      {servingEstimate && (
        <>
          <span className={styles.metaSep}> · </span>
          <span className={styles.scalerRow}>
            <button type="button" className={styles.scalerBtn} onClick={onScaleDown} aria-label="Fewer servings" disabled={scale <= 0.25}>−</button>
            <span className={styles.servingEstimate} title={`${servingEstimate.basis} — actual yield may vary`}>
              ~{Math.round(servingEstimate.servings * scale)} serving{Math.round(servingEstimate.servings * scale) !== 1 ? 's' : ''}
              {scale !== 1 && <span className={styles.scaleTag}> ×{scale % 1 === 0 ? scale : scale.toFixed(2)}</span>}
            </span>
            <button type="button" className={styles.scalerBtn} onClick={onScaleUp} aria-label="More servings" disabled={scale >= 4}>+</button>
          </span>
        </>
      )}
    </div>
  );
}

function Ingredients({ items, scale, onAddToList, onListModeChange }) {
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(() => new Set());

  if (!items?.length) return null;

  // Only 'item' type lines get checkboxes
  const foodIndices = items.reduce((acc, ing, i) => {
    if (ing.type === 'item') acc.push(i);
    return acc;
  }, []);

  const handleListClick = () => {
    // Pre-check all food items
    setSelectedItems(new Set(foodIndices));
    setSelectionMode(true);
    onListModeChange?.(true);
  };

  const handleCancelSelect = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
    onListModeChange?.(false);
  };

  const handleConfirmSelect = () => {
    // Pass only the checked ingredient items (skip headers/sections)
    const chosen = items.filter((ing, i) => ing.type === 'item' && selectedItems.has(i));
    onAddToList?.(chosen, scale);
    setSelectionMode(false);
    setSelectedItems(new Set());
    onListModeChange?.(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const toggleItem = (idx) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleCopy = () => {
    const text = items
      .filter((ing) => ing.type !== 'section')
      .map((ing) => ing.type === 'header' ? `\n${ing.text}` : scaleIngredientText(ing.text, scale))
      .join('\n').trim();
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const selectedCount = selectedItems.size;

  return (
    <>
      <div className={styles.sectionRow}>
        <div className={styles.modalSectionTitle}>Ingredients</div>
        <div className={styles.ingActions}>
          {onAddToList && !selectionMode && (
            <button
              type="button"
              className={`${styles.listBtn} ${added ? styles.listBtnDone : ''}`}
              onClick={handleListClick}
              aria-label="Select ingredients to add to shopping list"
            >
              {added ? (
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Added</>
              ) : (
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> List</>
              )}
            </button>
          )}
          {!selectionMode && (
            <button
              type="button"
              className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
              onClick={handleCopy}
              aria-label="Copy ingredients to clipboard"
            >
              {copied ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
              )}
            </button>
          )}
          {selectionMode && (
            <div className={styles.selectBar}>
              <button type="button" className={styles.selectCancelBtn} onClick={handleCancelSelect}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.selectConfirmBtn}
                onClick={handleConfirmSelect}
                disabled={selectedCount === 0}
              >
                Add {selectedCount} item{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>

      {selectionMode ? (
        <ul className={styles.ingSelectList}>
          {items.map((ing, i) => (
            <li
              key={i}
              className={
                ing.type === 'section' ? styles.ingSection :
                ing.type === 'header' ? styles.ingHeader :
                styles.ingSelectItem
              }
            >
              {ing.type === 'item' ? (
                <label className={styles.ingCheckLabel}>
                  <input
                    type="checkbox"
                    className={styles.ingCheckbox}
                    checked={selectedItems.has(i)}
                    onChange={() => toggleItem(i)}
                  />
                  <span>{scaleIngredientText(ing.text, scale)}</span>
                </label>
              ) : (
                ing.text
              )}
            </li>
          ))}
        </ul>
      ) : (
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
      )}
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
          if (s.type === 'section') { stepNum = 0; return <div key={i} className={styles.verHeader}>{s.step}</div>; }
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

// Cook log section — history summary + notes textarea + manual log button
function CookLogSection({ recipeName }) {
  const { cookLog, logCook, updateNotes } = useCookHistoryContext();
  const entry = cookLog[recipeName];
  const [draft, setDraft] = useState(entry?.notes ?? '');
  const [loggedFlash, setLoggedFlash] = useState(false);

  // Keep draft in sync if another tab updates localStorage (edge case)
  useEffect(() => {
    setDraft(cookLog[recipeName]?.notes ?? '');
  }, [recipeName, cookLog]);

  const handleBlur = () => {
    const trimmed = draft.trim();
    // Only write if value actually changed to avoid spurious localStorage writes.
    if (trimmed !== (entry?.notes ?? '').trim()) {
      updateNotes(recipeName, trimmed);
    }
  };

  const handleLogCook = () => {
    logCook(recipeName);
    setLoggedFlash(true);
    setTimeout(() => setLoggedFlash(false), 2000);
  };

  const cookCount = entry?.dates?.length ?? 0;
  const lastCooked = entry?.dates?.length
    ? formatDate(entry.dates[entry.dates.length - 1])
    : null;

  return (
    <div className={styles.cookLogSection}>
      <div className={styles.cookLogHeader}>
        <div className={styles.modalSectionTitle} style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>My Notes</div>
        <div className={styles.cookLogRight}>
          {cookCount > 0 && (
            <span className={styles.cookStat}>
              Cooked {cookCount}×
              {lastCooked && <> · Last {lastCooked}</>}
            </span>
          )}
          <button
            type="button"
            className={`${styles.logCookBtn} ${loggedFlash ? styles.logCookBtnDone : ''}`}
            onClick={handleLogCook}
            title="Record a cook session"
          >
            {loggedFlash ? (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Logged</>
            ) : (
              <>+ Log cook</>
            )}
          </button>
        </div>
      </div>
      <textarea
        className={styles.notesArea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="Your notes — substitutions, tweaks, how it went…"
        rows={3}
        aria-label="Recipe notes"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RecipeModal({ recipe, onClose, onTagClick, onAddToList }) {
  const titleId = useId();
  const [scale, setScale] = useState(1);
  const [shareCopied, setShareCopied] = useState(false);
  const [listSelecting, setListSelecting] = useState(false);
  const modalCardRef = useRef(null);

  const servingEstimate = useMemo(() => recipe ? estimateServings(recipe) : null, [recipe]);
  const macroState = useMacroEstimate(recipe, servingEstimate);

  useFocusTrap(modalCardRef, !!recipe);

  useEffect(() => { setScale(1); setListSelecting(false); }, [recipe]);

  useEffect(() => {
    if (!recipe) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [recipe, onClose]);

  useEffect(() => {
    if (!recipe) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [recipe]);

  if (!recipe) return null;

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  const scaleIdx = SCALE_STEPS.indexOf(scale);
  const handleScaleDown = () => { if (scaleIdx > 0) setScale(SCALE_STEPS[scaleIdx - 1]); };
  const handleScaleUp   = () => { if (scaleIdx < SCALE_STEPS.length - 1) setScale(SCALE_STEPS[scaleIdx + 1]); };

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?recipe=${encodeURIComponent(recipe.name)}`;
    if (navigator.share) {
      navigator.share({ title: recipe.name, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const handleAddToList = (items, sc) => {
    onAddToList?.(recipe.name, items, sc);
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div ref={modalCardRef} className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby={titleId} data-print-modal>
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
              className={`${styles.shareBtn} ${shareCopied ? styles.shareBtnDone : ''}`}
              onClick={handleShare}
              aria-label="Share recipe"
              title={shareCopied ? 'Link copied!' : 'Share recipe'}
            >
              {shareCopied ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              )}
            </button>
            <button type="button" className={styles.printBtn} onClick={() => window.print()} aria-label="Print recipe" title="Print recipe">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
            </button>
            <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close" autoFocus>&#x2715;</button>
          </div>
        </div>
        <div className={styles.modalBody}>
          {recipe.is_blank ? (
            <div className={styles.comingSoon}>🍳 Recipe coming soon — this one is on the list!</div>
          ) : (
            <>
              <Ingredients
                items={recipe.ingredients}
                scale={scale}
                onAddToList={onAddToList ? handleAddToList : null}
                onListModeChange={setListSelecting}
              />
              <div className={listSelecting ? styles.dimmed : undefined}>
                <Instructions steps={recipe.instructions} />
                <MacroErrorBoundary>
                  <Suspense fallback={null}>
                    <MacroCard {...macroState} />
                  </Suspense>
                </MacroErrorBoundary>
                <CookLogSection recipeName={recipe.name} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
