export const COLORS = {
  // Primary - PDCA lifecycle phases
  plan: {
    bg: "bg-blue-500",
    text: "text-blue-400",
    border: "border-blue-500",
    gradient: "from-blue-500 via-blue-600 to-blue-700"
  },
  do: {
    bg: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500",
    gradient: "from-emerald-500 via-green-500 to-emerald-600"
  },
  check: {
    bg: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-500",
    gradient: "from-amber-500 via-yellow-500 to-amber-600"
  },
  act: {
    bg: "bg-rose-500",
    text: "text-rose-400",
    border: "border-rose-500",
    gradient: "from-rose-500 via-red-500 to-rose-600"
  },

  // Status colors
  done: {
    bg: "bg-emerald-500",
    text: "text-emerald-400",
    badge: "bg-emerald-100 text-emerald-800",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600"
  },
  progress: {
    bg: "bg-orange-500",
    text: "text-orange-400",
    badge: "bg-orange-100 text-orange-800",
    gradient: "from-amber-500 via-orange-500 to-yellow-500"
  },
  late: {
    bg: "bg-rose-500",
    text: "text-rose-400",
    badge: "bg-rose-100 text-rose-800",
    gradient: "from-rose-500 via-red-500 to-orange-600"
  },
  pending: {
    bg: "bg-slate-500",
    text: "text-slate-400",
    badge: "bg-slate-100 text-slate-600",
    gradient: "from-slate-500 via-slate-600 to-slate-700"
  },

  // Primary KPI cards
  pdcas: {
    gradient: "from-sky-500 via-blue-500 to-indigo-600"
  },
  subacoes: {
    gradient: "from-violet-500 via-fuchsia-500 to-indigo-600"
  },
  efetividade: {
    gradient: "from-indigo-500 via-blue-500 to-cyan-500"
  }
} as const;

export type ColorKey = keyof typeof COLORS;