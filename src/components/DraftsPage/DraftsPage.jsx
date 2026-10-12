// Chef's Drafts, as a page of its own at /drafts/: recipes my cooking
// assistant built that I have not cooked yet. They are not part of the
// Cookbook - no list, chip, search or filter shows them (catalog.js ROWS) - and
// the only way here from the UI is the quiet footer link under the Recipes
// list. Each draft is the normal card, which carries DRAFT_LABEL.
//
// A draft opens as a full page, so Back from it returns here.
import { useEffect } from 'react';
import { DRAFT_ROWS } from '../../data/catalog.js';
import { DRAFTS_INTRO, SECTIONS, DRAFTS_SECTION } from '../../data/sections.js';
import { DRAFTS_DOCUMENT_TITLE, SITE_NAME } from '../../utils/siteTitle.js';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';
import styles from './DraftsPage.module.css';

export const DRAFTS_HEADING = SECTIONS.find((s) => s.key === DRAFTS_SECTION).label;

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
    </main>
  );
}
