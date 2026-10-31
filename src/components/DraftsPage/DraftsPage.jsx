// Chef's Drafts, as a page of its own at /drafts/: recipes my cooking
// assistant built that I have not cooked yet. They are not part of the
// Cookbook - no list, chip or filter shows them (catalog.js ROWS); search finds
// them, wearing their pill - and the only way here from the UI is the quiet
// footer link under the Recipes list. Each draft is the normal card, which
// carries DRAFT_LABEL.
//
// Below the drafts, "Planned" (Adam, 2026-10-31): every coming-soon
// placeholder by name, grouped by category, so the "N more planned" counts on
// the Cookbook list can be seen. A planned card is not a link: a placeholder
// has no page of its own (prerender skips blanks).
//
// A draft opens as a full page, so Back from it returns here.
import { useEffect } from 'react';
import { DRAFT_ROWS, PLANNED_ROWS, categoryStyle, groupByCategory } from '../../data/catalog.js';
import {
  DRAFTS_INTRO, DRAFTS_SECTION, PLANNED_HEADING, PLANNED_INTRO, PLANNED_LABEL, SECTIONS,
} from '../../data/sections.js';
import { photoInitial } from '../../utils/recipePhoto.js';
import { DRAFTS_DOCUMENT_TITLE, SITE_NAME } from '../../utils/siteTitle.js';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';
import styles from './DraftsPage.module.css';

export const DRAFTS_HEADING = SECTIONS.find((s) => s.key === DRAFTS_SECTION).label;

const PLANNED_GROUPS = groupByCategory(PLANNED_ROWS);

function PlannedCard({ recipe }) {
  return (
    <li className={styles.planned}>
      <span className={styles.initial} aria-hidden="true">{photoInitial(recipe.name)}</span>
      <span className={styles.plannedText}>
        <span className={styles.plannedName}>{recipe.name}</span>
        <span className={styles.plannedLabel}>{PLANNED_LABEL}</span>
      </span>
    </li>
  );
}

export default function DraftsPage({ onViewRecipe }) {
  // The same title handling as AboutPage: back to the site's name on the way out.
  useEffect(() => {
    document.title = DRAFTS_DOCUMENT_TITLE;
    return () => { document.title = SITE_NAME; };
  }, []);

  return (
    <main className={`wrap ${styles.page}`}>
      <h1 className={styles.title}>
        {DRAFTS_HEADING}<span className={styles.count}>{DRAFT_ROWS.length}</span>
      </h1>
      <p className={styles.intro}>{DRAFTS_INTRO}</p>
      {DRAFT_ROWS.length ? (
        <ul className={styles.grid}>
          {DRAFT_ROWS.map((r) => <RecipeCard key={r.id} recipe={r} onViewRecipe={onViewRecipe} />)}
        </ul>
      ) : (
        <p className={styles.empty}>No drafts right now.</p>
      )}

      {PLANNED_ROWS.length > 0 && (
        <section className={styles.plannedSection} aria-labelledby="planned-heading" id="planned">
          <h2 id="planned-heading" className={styles.title}>
            {PLANNED_HEADING}<span className={styles.count}>{PLANNED_ROWS.length}</span>
          </h2>
          <p className={styles.intro}>{PLANNED_INTRO}</p>
          {PLANNED_GROUPS.map(({ category, rows }) => (
            <div key={category?.id ?? ''} className={styles.plannedGroup} style={categoryStyle(category)}>
              <h3 className={styles.groupTitle}>
                {category?.label ?? 'Other'}<span className={styles.count}>{rows.length}</span>
              </h3>
              <ul className={styles.plannedGrid}>
                {rows.map((r) => <PlannedCard key={r.id} recipe={r} />)}
              </ul>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
