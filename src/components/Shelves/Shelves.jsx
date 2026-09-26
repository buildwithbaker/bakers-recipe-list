// Pinned and Recently viewed: two short shelves at the top of the Cookbook, so
// the recipes you reach for most are one tap away. Shown only on the plain
// Cookbook view; once a category or filter narrows the list, they step aside.
import { resolveRecipe } from '../../data/recipeIndex.js';
import { categoryOf, categoryStyle } from '../../data/catalog.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import { recipePath } from '../../utils/recipeRoute.js';
import Icon from '../Icon/Icon.jsx';
import styles from './Shelves.module.css';

// Stored entries resolve through the alias layer, so a renamed recipe or an
// entry saved before the id migration still finds its recipe. Anything that
// no longer resolves, or has no page, is skipped rather than shown broken.
function resolveAll(keys) {
  const seen = new Set();
  const out = [];
  for (const key of keys) {
    const r = key ? resolveRecipe(key) : null;
    if (!r || r.is_blank || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function Shelf({ id, title, icon, recipes, onViewRecipe, action }) {
  if (!recipes.length) return null;
  return (
    <section className={styles.shelf} aria-labelledby={id}>
      <div className={styles.head}>
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      <ul>
        {recipes.map((r) => (
          <li key={r.id}>
            <a
              href={recipePath(r.id)}
              style={categoryStyle(categoryOf(r))}
              onClick={(e) => {
                if (isModifiedClick(e)) return;
                e.preventDefault();
                onViewRecipe(r);
              }}
            >
              <Icon name={icon} filled={icon === 'star'} />
              <span>{r.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Shelves({ pinnedIds, recent, onViewRecipe, onClearRecent }) {
  const pinned = resolveAll([...pinnedIds]);
  const recentRecipes = resolveAll(recent.map((h) => h.id ?? h.name));
  return (
    <>
      <Shelf id="shelf-pinned" title="Pinned" icon="star" recipes={pinned} onViewRecipe={onViewRecipe} />
      <Shelf
        id="shelf-recent"
        title="Recently viewed"
        icon="clock"
        recipes={recentRecipes}
        onViewRecipe={onViewRecipe}
        action={onClearRecent && (
          <button type="button" className={styles.clear} onClick={onClearRecent} aria-label="Clear recently viewed">
            Clear
          </button>
        )}
      />
    </>
  );
}
