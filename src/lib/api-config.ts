/** Matches server MAX_LIST_LIMIT for client list fetches (dashboard, cards, study, export preview). */
export const CARDS_LIST_LIMIT = 10_000;

export const cardsApiUrl = `/api/cards?limit=${CARDS_LIST_LIMIT}`;
