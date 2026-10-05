// The navy band across the top of every screen: wordmark, the main
// destinations (from 720px up; a phone has the bottom TabBar), and an (i)
// that goes to the About page. The (i) is a real link to /about/, so a
// modified click opens a new tab and it works with JavaScript off; a plain
// click goes there in-app through onAbout.
//
// Two pieces, so only the compact part sticks:
//   <header>  the wordmark row, sticky at the top (--masthead-stuck tall)
//   foot      the tagline and the band's lower edge, where the search box
//             overlaps it. Scrolls away with the page.
// (A sticky element cannot drop its own bottom half, and a sticky child of
// the band would leave with the band, hence siblings.) Once the foot has
// scrolled away the header draws the amber rule itself.
//
// The wordmark is the page's h1 on the list. On a full recipe page (or About)
// the page's own title is the h1, so the wordmark steps down to plain text and becomes the way home.
import { useEffect, useRef, useState } from 'react';
import { CATALOG_COUNTS } from '../../data/catalog.js';
import { BASE_PATH, aboutPath } from '../../utils/recipeRoute.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import Icon from '../Icon/Icon.jsx';
import styles from './Masthead.module.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const TAGLINE = plural(CATALOG_COUNTS.written, 'recipe');

export default function Masthead({ nav, onAbout, aboutCurrent = false, siteTitleIsHeading = true, slim = false, onHome }) {
  const Title = siteTitleIsHeading ? 'h1' : 'p';
  const word = <>Baker’s <span className={styles.accent}>Recipe</span> List</>;
  const headerRef = useRef(null);
  const footRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  // Stuck once the foot is entirely behind the header.
  useEffect(() => {
    const header = headerRef.current;
    const foot = footRef.current;
    if (!header || !foot || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting),
      { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` },
    );
    io.observe(foot);
    return () => io.disconnect();
  }, [slim]);

  return (
    <>
      <header ref={headerRef} className={`${styles.masthead} ${stuck ? styles.stuck : ''}`}>
        <div className={`wrap ${styles.inner}`}>
          <Title className={styles.wordmark}>
            {onHome ? (
              <a
                className={styles.home}
                href={BASE_PATH}
                onClick={(e) => {
                  if (isModifiedClick(e)) return;
                  e.preventDefault();
                  onHome();
                }}
              >
                {word}
              </a>
            ) : word}
          </Title>
          {nav}
          <a
            className={styles.about}
            href={aboutPath()}
            aria-label="About this site"
            aria-current={aboutCurrent ? 'page' : undefined}
            onClick={(e) => {
              if (isModifiedClick(e) || !onAbout) return;
              e.preventDefault();
              onAbout();
            }}
          >
            <Icon name="info" />
          </a>
        </div>
      </header>
      <div ref={footRef} className={`${styles.foot} ${slim ? styles.slim : ''}`}>
        {!slim && <p className={`wrap ${styles.tagline}`}>{TAGLINE}</p>}
      </div>
    </>
  );
}
