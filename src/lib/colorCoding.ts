// Deterministic color assignment for schools/classes based on name hash
const SCHOOL_COLORS = [
  { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary', border: 'border-primary/30' },
  { bg: 'bg-accent/10', text: 'text-accent', dot: 'bg-accent', border: 'border-accent/30' },
  { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success', border: 'border-success/30' },
  { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', border: 'border-warning/30' },
  { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', border: 'border-destructive/30' },
  { bg: 'bg-[hsl(260,60%,50%)]/10', text: 'text-[hsl(260,60%,50%)]', dot: 'bg-[hsl(260,60%,50%)]', border: 'border-[hsl(260,60%,50%)]/30' },
  { bg: 'bg-[hsl(200,70%,45%)]/10', text: 'text-[hsl(200,70%,45%)]', dot: 'bg-[hsl(200,70%,45%)]', border: 'border-[hsl(200,70%,45%)]/30' },
  { bg: 'bg-[hsl(330,60%,50%)]/10', text: 'text-[hsl(330,60%,50%)]', dot: 'bg-[hsl(330,60%,50%)]', border: 'border-[hsl(330,60%,50%)]/30' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSchoolColor(nameOrId: string) {
  return SCHOOL_COLORS[hashString(nameOrId) % SCHOOL_COLORS.length];
}

export function getColorDot(nameOrId: string) {
  const color = getSchoolColor(nameOrId);
  return color.dot;
}
