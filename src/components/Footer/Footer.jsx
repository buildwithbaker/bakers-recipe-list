import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <a
        href="https://buildwithbaker.io"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.badge}
        aria-label="Build with Baker - the maker brand behind Baker's Recipe List"
      >
        Made by Build with Baker
      </a>
    </footer>
  );
}
