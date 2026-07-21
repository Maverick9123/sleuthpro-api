// Enformion matches addresses on the 2-letter USPS state code, not the full
// name. The shipped iOS app sends whatever the user typed ("Louisiana"), so we
// normalize here — a full name becomes "LA"; an already-2-letter code passes
// through untouched; anything unrecognized is returned as-is so we never make a
// search worse than the raw input.

const NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "puerto rico": "PR",
};

const VALID_CODES = new Set(Object.values(NAME_TO_CODE));

/**
 * Normalize a user-entered state to its 2-letter USPS code.
 * Returns undefined for empty/whitespace input.
 */
export function toStateCode(input?: string): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const upper = trimmed.toUpperCase();
  if (trimmed.length === 2 && VALID_CODES.has(upper)) return upper;

  const mapped = NAME_TO_CODE[trimmed.toLowerCase()];
  return mapped ?? trimmed; // unknown → pass through unchanged
}
