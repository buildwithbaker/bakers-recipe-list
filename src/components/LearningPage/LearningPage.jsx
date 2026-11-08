// Learning to Cook, as a real page at /learning-to-cook/ (routed and
// prerendered like About). One card per technique, in techniques.json order,
// each anchored by its id so /learning-to-cook/#<id> lands on it. "Used in" is
// derived from the recipe steps and left out when no recipe uses the technique.
//
// The page intro lives in learningCopy.js, shared with scripts/prerender.mjs.
// This content is not part of recipe search and not in any recipe JSON-LD.
import { useEffect } from 'react';
import { techniques, usedIn } from '../../data/techniqueIndex.js';
import { BASE_PATH, recipePath } from '../../utils/recipeRoute.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import { LEARNING_DOCUMENT_TITLE, SITE_NAME } from '../../utils/siteTitle.js';
import { LEARNING_HEADING, LEARNING_INTRO, LEARNING_USED_IN } from './learningCopy.js';
import styles from './LearningPage.module.css';

export default function LearningPage({ onViewRecipe }) {
  useEffect(() => {
    document.title = LEARNING_DOCUMENT_TITLE;
    return () => { document.title = SITE_NAME; };
  }, []);

  // Arriving on a technique (learning-to-cook/#carrot-roll-cut) lands on its
  // card; anything else starts at the top. The page renders after the URL
  // changes, so the browser's own anchor jump has nothing to land on yet.
  useEffect(() => {
    let target = null;
    try {
      const id = decodeURIComponent(window.location.hash.slice(1));
      target = id ? document.getElementById(id) : null;
    } catch { /* malformed hash: start at the top */ }
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0 });
  }, []);

  return (
    <main className={styles.page}>
      <h1 id="learning-title" className={styles.title}>{LEARNING_HEADING}</h1>
      <p className={styles.intro}>{LEARNING_INTRO}</p>
      <div className={styles.cards}>
        {techniques.map((t) => {
          const recipes = usedIn(t.id);
          return (
            <section key={t.id} id={t.id} className={styles.card} aria-labelledby={`${t.id}-title`}>
              <span className={styles.kicker}>{t.kicker}</span>
              <h2 id={`${t.id}-title`} className={styles.cardTitle}>{t.title}</h2>
              <img
                className={styles.diagram}
                src={`${BASE_PATH}${t.diagram.src.replace(/^\/+/, '')}`}
                alt={t.diagram.alt}
                loading="lazy"
                decoding="async"
              />
              <h3>How</h3>
              <ol className={styles.how}>
                {t.how.map((line) => <li key={line}>{line}</li>)}
              </ol>
              <h3>Why</h3>
              <p className={styles.why}>{t.why}</p>
              {recipes.length > 0 && (
                <>
                  <h3>{LEARNING_USED_IN}</h3>
                  <ul className={styles.usedIn}>
                    {recipes.map((r) => (
                      <li key={r.id}>
                        <a
                          href={recipePath(r.id)}
                          onClick={(e) => {
                            if (isModifiedClick(e) || !onViewRecipe) return;
                            e.preventDefault();
                            onViewRecipe(r);
                          }}
                        >
                          {r.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
