"use client"

export function MethodSelector({
  method,
  setMethod,
  hasMC,
  hasLHS,
}: {
  method: "mc" | "lhs"
  setMethod: (m: "mc" | "lhs") => void
  hasMC: boolean
  hasLHS: boolean
}) {
  if (!hasMC && !hasLHS) return null
  return (
    <div className="inline-flex gap-1 p-1 rounded-lg bg-secondary border border-border mb-6">
      <button
        onClick={() => setMethod("mc")}
        disabled={!hasMC}
        className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
          method === "mc"
            ? "bg-card shadow text-foreground"
            : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        Monte Carlo
      </button>
      <button
        onClick={() => setMethod("lhs")}
        disabled={!hasLHS}
        className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
          method === "lhs"
            ? "bg-card shadow text-foreground"
            : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        LHS
      </button>
    </div>
  )
}
