// The search mode (Name / Ingredient / All) as App holds it.
//
// App owns the mode beside the query and provides it here; SearchResults reads
// it. RecipeList sits between the two and has no use for it, so it is not
// threaded through RecipeList's props. Outside a provider the mode is All,
// today's behaviour.
import { createContext } from 'react';
import { SEARCH_MODES } from '../../utils/search.js';

export const SearchModeContext = createContext(SEARCH_MODES.ALL);
