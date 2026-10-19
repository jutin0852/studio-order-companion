const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const scales = ["", " thousand", " million", " billion", " trillion"];

function belowThousand(value: number) {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(`${ones[hundreds]} hundred`);
  if (rest) {
    const spoken = rest < 20 ? ones[rest] : `${tens[Math.floor(rest / 10)]}${rest % 10 ? `-${ones[rest % 10]}` : ""}`;
    parts.push(hundreds ? `and ${spoken}` : spoken);
  }
  return parts.join(" ");
}

export function integerToWords(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Enter a whole number from zero up.");
  if (value === 0) return "zero";
  const groups: string[] = [];
  let remaining = value;
  for (let scale = 0; remaining > 0; scale += 1) {
    const group = remaining % 1000;
    if (group) groups.unshift(`${belowThousand(group)}${scales[scale]}`);
    remaining = Math.floor(remaining / 1000);
  }
  return groups.join(", ").replace(/, (?=[^,]*$)/, (match, offset: number, full: string) => (
    // "one million, five hundred" reads better as "one million, five hundred"; only the
    // final join before a sub-hundred group takes "and" ("one million and fifty").
    /^(?:and )?[a-z-]+$/.test(full.slice(offset + match.length)) && !full.slice(offset + match.length).includes("hundred") ? " and " : match
  ));
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// 45000 -> "Forty-five thousand naira only"; 1500.5 -> "One thousand, five hundred naira, fifty kobo only"
export function nairaInWords(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError("Enter an amount greater than zero.");
  const totalKobo = Math.round(amount * 100);
  const naira = Math.floor(totalKobo / 100);
  const kobo = totalKobo % 100;
  const nairaText = naira ? `${integerToWords(naira)} naira` : "";
  const koboText = kobo ? `${integerToWords(kobo)} kobo` : "";
  return `${capitalise([nairaText, koboText].filter(Boolean).join(", "))} only`;
}
