// The recipe itself: a header band in the category colour, the actions a cook
// reaches for, ingredients you can tick off, the numbered method, and below
// those the tags, nutrition estimate and your own notes.
//
// ONE component, TWO frames. RecipeModal renders it over the list; RecipePage
// renders it at /r/<slug>/ for someone who arrived from a shared link. They are
// the same route, so a second renderer would be a second thing to keep correct
// — which is exactly how a card and its page drift apart.
import { Component, lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './RecipeView.module.css';
import { estimateServings } from '../../utils/estimateServings.js';
import { useMacroEstimate } from '../../hooks/useMacroEstimate.js';
import { scaleIngredientText } from '../../utils/scaleIngredient.js';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { getEffectiveTags } from '../../utils/autoTags.js';
import { useWakeLock } from '../../hooks/useWakeLock.js';
import { useIngredientTicks } from '../../hooks/useIngredientTicks.js';
import { cookModeMessage } from '../../utils/screenLock.js';
import { recipePath } from '../../utils/recipeRoute.js';
import { recipeDocumentTitle } from '../../utils/siteTitle.js';
import { recipePhoto } from '../../utils/recipePhoto.js';
import { ingredientCount, stepCount } from '../../utils/recipeStats.js';
import { categoryOf, categoryStyle } from '../../data/catalog.js';
import { domainOf } from '../ToTryLinks/ToTryLinks.jsx';
import Icon from '../Icon/Icon.jsx';

const MacroCard = lazy(() => import('../MacroCard/MacroCard.jsx'));

// Silent error boundary for the macro section — if the lazy chunk 404s after
// a new deployment, the macro card just disappears instead of crashing the view.
class MacroErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

const SCALE_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Toast: one short line at the bottom of the screen, read out by a screen
// reader (role="status"), gone after a few seconds.
// ---------------------------------------------------------------------------

function useToast() {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div className={styles.toastSlot} role="status" aria-live="polite">
      {message && <div className={styles.toast}>{message}</div>}
    </div>
  );
  return [node, show];
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

function Ingredients({ recipeId, items, scale, servings, onScaleDown, onScaleUp, onAddToList, onListModeChange, Heading, toast }) {
  const [ticks, toggleTick, clearTicks] = useIngredientTicks(recipeId);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  if (!items?.length) return null;

  const itemIndices = items.reduce((acc, ing, i) => (ing.type === 'item' ? [...acc, i] : acc), []);
  const lineText = (ing) => (ing.type === 'item' ? scaleIngredientText(ing.text, scale) : ing.text);

  // "Add to shopping list" opens a pick list with every ingredient ticked, so
  // the ones already in the cupboard can be left out.
  const startSelecting = () => {
    setSelected(new Set(itemIndices));
    setSelecting(true);
    onListModeChange?.(true);
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    onListModeChange?.(false);
  };
  const confirm = () => {
    const chosen = items.filter((ing, i) => ing.type === 'item' && selected.has(i));
    onAddToList?.(chosen, scale);
    stopSelecting();
  };
  const toggleSelected = (i) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const handleCopy = () => {
    const text = items
      .filter((ing) => ing.type !== 'section')
      .map((ing) => (ing.type === 'header' ? `\n${ing.text}` : lineText(ing)))
      .join('\n').trim();
    navigator.clipboard?.writeText(text)
      .then(() => toast('Ingredients copied'))
      .catch(() => toast('Could not copy: your browser blocked the clipboard'));
  };

  const checked = selecting ? selected : ticks;
  const onCheck = selecting ? toggleSelected : toggleTick;

  return (
    <section className={styles.ingredients} aria-labelledby={`${recipeId}-ing`}>
      <div className={styles.sectionHead}>
        <Heading id={`${recipeId}-ing`}>{selecting ? 'Add to shopping list' : 'Ingredients'}</Heading>
        <span className={styles.n}>{itemIndices.length}</span>
        {!selecting && ticks.size > 0 && (
          <button type="button" className={styles.textBtn} onClick={clearTicks} data-print-hide>
            Clear ticks
          </button>
        )}
      </div>

      {servings && !selecting && (
        <div className={styles.scaler} data-print-hide>
          <span>About {plural(Math.round(servings.servings * scale), 'serving')}{scale !== 1 && <> (×{scale % 1 === 0 ? scale : scale.toFixed(2)})</>}</span>
          <button type="button" className={styles.stepBtn} onClick={onScaleDown} aria-label="Fewer servings" disabled={scale <= SCALE_STEPS[0]}>−</button>
          <button type="button" className={styles.stepBtn} onClick={onScaleUp} aria-label="More servings" disabled={scale >= SCALE_STEPS.at(-1)}>+</button>
        </div>
      )}

      <ul className={styles.ingList}>
        {items.map((ing, i) => {
          if (ing.type === 'section' || ing.type === 'header') {
            return <li key={i} className={styles.sub}>{ing.text.replace(/:$/, '')}</li>;
          }
          return (
            <li key={i}>
              <label className={styles.check}>
                <input type="checkbox" checked={checked.has(i)} onChange={() => onCheck(i)} />
                <span>{lineText(ing)}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className={styles.ingActions} data-print-hide>
        {selecting ? (
          <>
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={confirm} disabled={selected.size === 0}>
              Add {plural(selected.size, 'item')}
            </button>
            <button type="button" className={styles.btn} onClick={stopSelecting}>Cancel</button>
          </>
        ) : (
          <>
            {onAddToList && (
              <button type="button" className={styles.btn} onClick={startSelecting}>
                <Icon name="plus" />Add to shopping list
              </button>
            )}
            <button type="button" className={styles.btn} onClick={handleCopy}>Copy</button>
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Method
// ---------------------------------------------------------------------------

function Method({ steps, headingId, Heading }) {
  if (!steps?.length) return null;
  const count = steps.filter((s) => s.type !== 'section' && s.type !== 'header').length;
  // Numbering restarts after a version marker, so each version of a
  // multi-version recipe counts from 1.
  let n = 0;
  return (
    <section className={styles.method} aria-labelledby={headingId}>
      <div className={styles.sectionHead}>
        <Heading id={headingId} tabIndex={-1}>Method</Heading>
        <span className={styles.n}>{plural(count, 'step')}</span>
      </div>
      <ol className={styles.steps}>
        {steps.map((s, i) => {
          if (s.type === 'section' || s.type === 'header') {
            if (s.type === 'section') n = 0;
            return <li key={i} className={styles.sub}>{s.step}</li>;
          }
          n += 1;
          // Classic steps carry a short title in `step` and the text in
          // `detail`; grouped steps carry the text in `step` alone.
          return (
            <li key={i} className={styles.step} data-n={n}>
              {s.detail ? (
                <>
                  <span className={styles.stepTitle}>{s.step}</span>
                  <p>{s.detail}</p>
                </>
              ) : (
                <p>{s.step}</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Notes (cook log)
// ---------------------------------------------------------------------------

function CookLogSection({ recipeId, Heading }) {
  const { cookLog, logCook, updateNotes } = useCookHistoryContext();
  const entry = cookLog[recipeId];
  const [draft, setDraft] = useState(entry?.notes ?? '');
  const [loggedFlash, setLoggedFlash] = useState(false);
  const notesId = useId();

  useEffect(() => { setDraft(cookLog[recipeId]?.notes ?? ''); }, [recipeId, cookLog]);

  const handleBlur = () => {
    const trimmed = draft.trim();
    if (trimmed !== (entry?.notes ?? '').trim()) updateNotes(recipeId, trimmed);
  };

  const handleLogCook = () => {
    logCook(recipeId);
    setLoggedFlash(true);
    setTimeout(() => setLoggedFlash(false), 2000);
  };

  const cookCount = entry?.dates?.length ?? 0;
  const lastCooked = cookCount ? formatDate(entry.dates[cookCount - 1]) : null;

  return (
    <section className={styles.notes} data-print-hide>
      <div className={styles.sectionHead}>
        <Heading>My notes</Heading>
        {cookCount > 0 && (
          <span className={styles.n}>Cooked {cookCount}×{lastCooked && <> · last {lastCooked}</>}</span>
        )}
        <button type="button" className={`${styles.btn} ${styles.push}`} onClick={handleLogCook}>
          {loggedFlash ? <><Icon name="check" />Logged</> : <><Icon name="plus" />Log a cook</>}
        </button>
      </div>
      <label htmlFor={notesId} className="sr-only">Your notes on this recipe</label>
      <textarea
        id={notesId}
        className={styles.notesArea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="Substitutions, tweaks, how it went…"
        rows={3}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * The recipe, with no opinion about the frame around it.
 *
 * @param recipe       the display row to render; null renders nothing
 * @param titleId      id put on the title, so a dialog frame can aria-labelledby it
 * @param headingLevel 1 on the full page (the recipe IS the page's subject), 2 in
 *                     the modal (the list is the page). Sections are one below.
 * @param barStart     frame controls at the start of the sticky bar (the page's
 *                     "All recipes")
 * @param barEnd       frame controls at the end of the sticky bar (the modal's
 *                     "Open full page" and Close)
 * @param onTagClick   tag -> search the list
 * @param onAddToList  (recipeId, items, scale) -> shopping list; omit to hide
 * @param footer       extra content after the notes (the page's related recipes)
 */
export default function RecipeView({
  recipe, titleId, headingLevel = 2, barStart = null, barEnd = null,
  onTagClick, onAddToList, footer = null,
}) {
  const [scale, setScale] = useState(1);
  const [listSelecting, setListSelecting] = useState(false);
  const [stuck, setStuck] = useState(false);
  const wakeLock = useWakeLock();
  const { madeSet, toggleMade, pinnedSet, togglePinned } = useCookHistoryContext();
  const [toastNode, toast] = useToast();
  const titleRef = useRef(null);
  const localId = useId();

  const servingEstimate = useMemo(() => (recipe ? estimateServings(recipe) : null), [recipe]);
  const macroState = useMacroEstimate(recipe, servingEstimate);

  useEffect(() => { setScale(1); setListSelecting(false); }, [recipe]);

  // Name the recipe in the browser tab, history and bookmarks, and put back
  // whatever was there when the view goes away. Covers both frames, and matters
  // most for a returning visitor on /r/<slug>/: the service worker serves them
  // the generic shell, so the prerendered <title> never reaches them.
  const recipeName = recipe?.name;
  useEffect(() => {
    if (!recipeName) return undefined;
    const previous = document.title;
    document.title = recipeDocumentTitle(recipeName);
    return () => { document.title = previous; };
  }, [recipeName]);

  // The sticky bar shows the recipe's name once the title itself has scrolled
  // up under it.
  useEffect(() => {
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [recipe]);

  if (!recipe) return null;

  const category = categoryOf(recipe);
  const photo = recipePhoto(recipe);
  const isMade = madeSet.has(recipe.id);
  const isPinned = pinnedSet.has(recipe.id);
  const methodId = `${localId}-method`;
  const TitleTag = headingLevel === 1 ? 'h1' : 'h2';
  const Heading = headingLevel === 1 ? 'h2' : 'h3';
  const tags = getEffectiveTags(recipe);
  const hasSource = recipe.source && recipe.source !== 'Original';

  const scaleIdx = SCALE_STEPS.indexOf(scale);
  const scaleDown = () => { if (scaleIdx > 0) setScale(SCALE_STEPS[scaleIdx - 1]); };
  const scaleUp = () => { if (scaleIdx < SCALE_STEPS.length - 1) setScale(SCALE_STEPS[scaleIdx + 1]); };

  const handleCook = async () => { toast(cookModeMessage(await wakeLock.toggle())); };

  const handleShare = () => {
    // The recipe's own page, built from the id (which survives a rename). It is
    // the one URL with a prerendered file behind it, so a link preview shows
    // this recipe and not the generic shell.
    const url = `${window.location.origin}${recipePath(recipe.id)}`;
    if (navigator.share) {
      navigator.share({ title: recipe.name, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url)
        .then(() => toast('Link copied'))
        .catch(() => toast('Could not copy the link'));
    }
  };

  // In-page jump that does not touch the URL: the path is the route, and a
  // #fragment would add a history entry to step back through.
  const jumpToMethod = (e) => {
    e.preventDefault();
    const target = document.getElementById(methodId);
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  };

  const cookButton = (className, withLabel) => wakeLock.supported && (
    <button
      type="button"
      className={className}
      onClick={handleCook}
      aria-pressed={wakeLock.active}
      aria-label={withLabel ? undefined : 'Cook mode'}
    >
      <Icon name="sun" />{withLabel && 'Cook mode'}
    </button>
  );

  return (
    <div className={styles.view} style={categoryStyle(category)}>
      {/* Sticky bar: the frame's own controls, plus the name and Cook mode
          once the header has scrolled away. Stays at most 56px tall so Close
          is always on screen, even at 390px. */}
      <div className={`${styles.bar} ${stuck ? styles.stuck : ''}`} data-print-hide>
        {barStart}
        <span className={styles.barTitle} aria-hidden="true">{recipe.name}</span>
        {stuck && cookButton(styles.iconBtn, false)}
        {barEnd}
      </div>

      <header className={styles.top}>
        <div className={styles.head}>
          <div className={styles.headText}>
            {/* The reader-facing category, never the staging state: this page
                is what a shared link opens (architecture.md §8). */}
            {category && <p className={styles.kicker}>{category.label}</p>}
            <TitleTag id={titleId} ref={titleRef} className={styles.title}>{recipe.name}</TitleTag>
            {!recipe.is_blank && (
              <p className={styles.facts}>
                <span><b>{ingredientCount(recipe)}</b> ingredients</span>
                <a href={`#${methodId}`} onClick={jumpToMethod} data-print-hide>
                  <b>{stepCount(recipe)}</b> steps · jump to method
                </a>
                <span>
                  Source:{' '}
                  {hasSource ? (
                    isUrl(recipe.source)
                      ? <a href={recipe.source} target="_blank" rel="noreferrer noopener">{domainOf(recipe.source) || recipe.source}</a>
                      : recipe.source
                  ) : 'Original recipe'}
                </span>
              </p>
            )}
            <div className={styles.actions} data-print-hide>
              {!recipe.is_blank && cookButton(`${styles.btn} ${styles.primary}`, true)}
              {!recipe.is_blank && (
                <>
                  <button type="button" className={`${styles.btn} ${styles.pinBtn}`} aria-pressed={isPinned} onClick={() => togglePinned(recipe.id)}>
                    <Icon name="star" filled={isPinned} />Pin
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.madeBtn}`} aria-pressed={isMade} onClick={() => toggleMade(recipe.id)}>
                    <Icon name="check" />Made it
                  </button>
                </>
              )}
              <button type="button" className={styles.btn} onClick={handleShare}><Icon name="share" />Share</button>
              <button type="button" className={styles.btn} onClick={() => window.print()}><Icon name="print" />Print</button>
            </div>
          </div>
          {/* Only a real photo. alt="" because the title beside it names the
              dish; describing it again is noise to a screen reader. */}
          {photo && (
            <div className={styles.photo}>
              <img src={photo.large} alt="" width="800" height="600" />
            </div>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {recipe.is_blank ? (
          <p className={styles.comingSoon}>Recipe coming soon. This one is on the list.</p>
        ) : (
          <div className={styles.columns}>
            <Ingredients
              recipeId={recipe.id}
              items={recipe.ingredients}
              scale={scale}
              servings={servingEstimate}
              onScaleDown={scaleDown}
              onScaleUp={scaleUp}
              onAddToList={onAddToList ? (items, sc) => onAddToList(recipe.id, items, sc) : null}
              onListModeChange={setListSelecting}
              Heading={Heading}
              toast={toast}
            />
            <div className={listSelecting ? styles.dimmed : undefined}>
              <Method steps={recipe.instructions} headingId={methodId} Heading={Heading} />
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <section className={styles.tags} data-print-hide aria-label="Tags">
            {tags.map((tag) => (
              <button key={tag} type="button" className={styles.tag} onClick={() => onTagClick?.(tag)}>
                {tag}
              </button>
            ))}
          </section>
        )}

        {!recipe.is_blank && (
          <div className={styles.extras} data-print-hide>
            <MacroErrorBoundary>
              <Suspense fallback={null}>
                <MacroCard {...macroState} />
              </Suspense>
            </MacroErrorBoundary>
            <CookLogSection recipeId={recipe.id} Heading={Heading} />
          </div>
        )}
        {footer}
      </div>
      {toastNode}
    </div>
  );
}
