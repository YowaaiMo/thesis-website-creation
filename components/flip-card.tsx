"use client"

import { useState } from "react"
import { RotateCw } from "lucide-react"

export function FlipCard({
  front,
  back,
  className = "",
}: {
  front: React.ReactNode
  back: React.ReactNode
  className?: string
}) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className={`relative ${className}`}>
      {/* Button sits outside the 3-D transform so it doesn't flip */}
      <button
        onClick={() => setFlipped(f => !f)}
        className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-secondary/90 border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        title={flipped ? "Voir le graphe" : "Voir l'explication"}
      >
        <RotateCw className="h-3 w-3" />
        {flipped ? "Graphe" : "Explication"}
      </button>

      {/* Perspective wrapper */}
      <div style={{ perspective: "1200px" }}>
        {/* This div rotates; front card (in flow) gives the height */}
        <div
          className="transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front — in normal flow so it sets the container height */}
          <div style={{ backfaceVisibility: "hidden" }}>{front}</div>

          {/* Back — absolutely covers same area, pre-rotated so flip reveals it */}
          <div
            className="absolute inset-0 overflow-y-auto rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground leading-relaxed space-y-3"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {back}
          </div>
        </div>
      </div>
    </div>
  )
}
