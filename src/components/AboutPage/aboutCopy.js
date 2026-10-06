// The About page's words, in ONE place: AboutPage renders them and
// scripts/prerender.mjs writes the same words into dist/about/index.html (the
// head description and the <noscript> fallback). The copy is Adam's; change
// the words here, verbatim, and both follow.
//
// `id` on a question is its anchor: the AI photo caption on every AI recipe
// photo links to about/#photos, so that id is a public link target.

export const ABOUT_HEADING = "About Baker's Recipe List";

export const ABOUT_INTRO = [
  "I've been cooking for over ten years, and I change almost every recipe I touch. This site is where the ones worth keeping end up.",
  "Every recipe here has been cooked by me, tasted and approved before it went up. If I didn't like it, it isn't here.",
  'I use AI every day, including in the kitchen. I built a cooking assistant on Claude and gave it a knowledge base I put together: cooking science, technique, ingredient substitutions, scaling and USDA nutrition data. It helps me develop and write recipes. I cook them and decide what stays.',
];

// The head's meta description: the first paragraph.
export const ABOUT_DESCRIPTION = ABOUT_INTRO[0];

export const ABOUT_FAQ_HEADING = 'FAQ';

export const ABOUT_FAQ = [
  {
    q: 'Is this just another AI recipe site?',
    a: "No. AI helps me write the recipes and makes the photos. It doesn't cook, and it doesn't decide what gets posted. Every recipe on the site was made in my kitchen and approved by me.",
  },
  {
    q: 'Why are the amounts written into the steps?',
    a: 'So you can cook from the steps without scrolling back up to the ingredient list every time. I built the site the way I always wanted recipe sites to work: easy to follow, easy to read.',
  },
  {
    q: 'Why do some steps explain the why?',
    a: "Because knowing why a step works lets you change a recipe without breaking it. My newer recipes explain the key steps using food science and culinary technique: why the sauce goes in thicker than looks right, why the lasagna rests before you cut it. I'm adding the same notes to older recipes as I update them.",
  },
  {
    id: 'photos',
    q: 'Why are the photos AI-generated?',
    a: "Because I'm bad at taking pictures of food. Good food photos take props, garnishes bought just for the shot, room to store all of it, and money. I don't have the room, and it isn't cheap. So the photos are AI-generated to show what the finished dish looks like, and each one is labeled. The photo is AI. The recipe is mine.",
  },
  {
    q: 'Where do the nutrition numbers come from?',
    a: "They're estimated from USDA FoodData Central. These are estimates only. For medically relevant dietary planning, consult a registered dietitian.",
  },
];

export const ABOUT_INSTALL = 'On iPhone: tap Share, then Add to Home Screen.';

export const ABOUT_MAKER = { text: 'Made by Build with Baker', href: 'https://buildwithbaker.io' };
