// The Card button's lazy chunk: pdf-lib, its font engine and the card fonts
// arrive only when a reader asks for a card (RecipeView imports this module
// with a dynamic import()). It fetches the fonts, builds the PDF and hands
// the file to the browser as <recipe-id>-card.pdf.
//
// Fonts: Young Serif from the site's own @fontsource package (the files the
// site already serves); Inter, full static TTFs from the official v4.1
// release (rsms/inter), committed under src/fonts/inter/ with their OFL.
// Inter is full rather than a web subset because recipes use ⅓, ⅔ and ⅛.
import * as pdfLib from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import serifUrl from '@fontsource/young-serif/files/young-serif-latin-400-normal.woff?url';
import sansUrl from '../fonts/inter/Inter-Regular.ttf?url';
import sansBoldUrl from '../fonts/inter/Inter-SemiBold.ttf?url';
import sansItalicUrl from '../fonts/inter/Inter-Italic.ttf?url';
import { buildCardPdf } from './cardPdf.js';
import { estimateServings } from './estimateServings.js';

const FONT_URLS = { serif: serifUrl, sans: sansUrl, sansBold: sansBoldUrl, sansItalic: sansItalicUrl };

async function fetchFonts() {
  const entries = await Promise.all(
    Object.entries(FONT_URLS).map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font ${key}: HTTP ${res.status}`);
      return [key, new Uint8Array(await res.arrayBuffer())];
    }),
  );
  return Object.fromEntries(entries);
}

export const cardFileName = (recipe) => `${recipe.id}-card.pdf`;

export async function downloadRecipeCard(recipe, settings) {
  const fontBytes = await fetchFonts();
  const bytes = await buildCardPdf({
    pdfLib, fontkit, fontBytes, recipe, settings, servings: estimateServings(recipe),
  });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = cardFileName(recipe);
  document.body.append(a);
  a.click();
  a.remove();
  // Long enough for the browser to start the download before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
