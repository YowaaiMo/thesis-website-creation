"use client"

import { useState } from "react"
import { HelpCircle, X } from "lucide-react"

export function PageInfo({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-20 z-40 flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        title="Informations sur cette page"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Info
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[420px] max-w-[90vw] bg-card border-l border-border shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-64px)] px-6 py-5 text-sm text-muted-foreground space-y-4 leading-relaxed">
          {children}
        </div>
      </div>
    </>
  )
}
