// About this site, as a real page at /about/ (it replaced the bottom sheet the
// masthead's (i) used to open). Same frame as a recipe page: the masthead
// above, a card on the paper. Plain sections, no accordion: every answer is
// visible, and each question is a heading so it can be linked to.
//
// The words live in aboutCopy.js, shared with scripts/prerender.mjs, which
// writes dist/about/index.html so a direct load or a refresh works.
import { useEffect } from 'react';
import { ABOUT_DOCUMENT_TITLE } from '../../utils/siteTitle.js';
import {
  ABOUT_FAQ, ABOUT_FAQ_HEADING, ABOUT_HEADING, ABOUT_INSTALL, ABOUT_INTRO, ABOUT_MAKER,
} from './aboutCopy.js';
import styles from './AboutPage.module.css';

export default function AboutPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = ABOUT_DOCUMENT_TITLE;
    return () => { document.title = previous; };
  }, []);

  // Arriving on a question (about/#photos from an AI photo caption) lands on
  // it; anything else starts at the top. The page renders after the URL
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
      <article className={styles.card} aria-labelledby="about-title">
        <h1 id="about-title" className={styles.title}>{ABOUT_HEADING}</h1>
        {ABOUT_INTRO.map((p) => <p key={p}>{p}</p>)}

        <h2 className={styles.faqHeading}>{ABOUT_FAQ_HEADING}</h2>
        {ABOUT_FAQ.map(({ id, q, a }) => (
          <section key={q} className={styles.question}>
            <h3 id={id}>{q}</h3>
            <p>{a}</p>
          </section>
        ))}

        <p className={styles.install}>{ABOUT_INSTALL}</p>
        <p className={styles.maker}>
          <a href={ABOUT_MAKER.href} target="_blank" rel="noopener noreferrer">{ABOUT_MAKER.text}</a>
        </p>
      </article>
    </main>
  );
}
