"use client"

import { useRef, useState, Component, type ReactNode } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { exportToCSV, exportToJSON, DEFAULT_DETERMINISTIC_PARAMS, buildComparison, type SimulationResult } from "@/lib/monte-carlo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Download, FileText, FileJson, FileSpreadsheet, Printer, Loader2 } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, ComposedChart, Legend
} from "recharts"

// ─── Excel helper (xlsx) ──────────────────────────────────────────────────────

async function downloadExcelMultiSheet(simResult: SimulationResult, method: "mc" | "lhs", numScenarios: number, startYear: number, endYear: number) {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()
  const years = simResult.scenarios[0].years

  // Sheet 1 — Tous (all variables, one row per scenario×year)
  const allHeaders = [
    "Scenario", "Annee", "Demande totale (ktep)",
    "Residentiel (ktep)", "Industriel (ktep)", "Transport (ktep)", "Agriculture (ktep)", "Tertiaire (ktep)",
    "Solaire h_PV", "Eolien h_Wind", "CAPEX PV (€/kW)", "Prix gaz (€/MBtu)",
    "Cout op. gaz (€/MWh)", "Cout op. petrole (DA/tep)", "Cout op. GPL (DA/tep)", "Cout op. condensat (DA/tep)"
  ]
  const allRows: (string | number)[][] = [allHeaders]
  simResult.scenarios.forEach(s => {
    years.forEach((yr, i) => {
      allRows.push([
        s.id + 1, yr,
        +s.demand.total[i].toFixed(2),
        +s.demand.residential[i].toFixed(2),
        +s.demand.industrial[i].toFixed(2),
        +s.demand.transport[i].toFixed(2),
        +s.demand.agriculture[i].toFixed(2),
        +s.demand.tertiary[i].toFixed(2),
        +s.solarAvailability[i].toFixed(4),
        +s.windAvailability[i].toFixed(4),
        +s.capexPv[i].toFixed(2),
        +s.gasPrice[i].toFixed(2),
        +s.operationalCostGas[i].toFixed(2),
        +s.operationalCostOil[i].toFixed(0),
        +s.operationalCostGPL[i].toFixed(0),
        +s.operationalCostCondensat[i].toFixed(0),
      ])
    })
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allRows), "Tous")

  // Sheets 2–6 — one per sector (matrix: rows=années, cols=scénarios)
  const sectors: { key: "residential" | "industrial" | "transport" | "agriculture" | "tertiary"; label: string }[] = [
    { key: "residential", label: "Residentiel" },
    { key: "industrial",  label: "Industriel" },
    { key: "transport",   label: "Transport" },
    { key: "agriculture", label: "Agriculture" },
    { key: "tertiary",    label: "Tertiaire" },
  ]
  sectors.forEach(({ key, label }) => {
    const header = ["Annee", ...simResult.scenarios.map(s => `Sc.${s.id + 1}`), "Moyenne", "Std", "Q5%", "Q95%"]
    const rows: (string | number)[][] = [header]
    years.forEach((yr, i) => {
      const vals = simResult.scenarios.map(s => s.demand[key][i])
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const std  = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
      const sorted = [...vals].sort((a, b) => a - b)
      const q5  = sorted[Math.floor(0.05 * (sorted.length - 1))]
      const q95 = sorted[Math.floor(0.95 * (sorted.length - 1))]
      rows.push([yr, ...vals.map(v => +v.toFixed(2)), +mean.toFixed(2), +std.toFixed(2), +q5.toFixed(2), +q95.toFixed(2)])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), label)
  })

  // Sheet 7 — Statistiques agrégées
  const statHeader = ["Annee", "Dem. Moy", "Dem. Std", "Dem. Q5", "Dem. Q95", "Solaire Moy", "Solaire Std", "Eolien Moy", "Eolien Std", "CAPEX Moy", "CAPEX Std", "Gaz Moy", "Gaz Std"]
  const statRows: (string | number)[][] = [statHeader]
  const st = simResult.statistics
  years.forEach((yr, i) => {
    statRows.push([
      yr,
      +st.demand.mean[i].toFixed(2), +st.demand.std[i].toFixed(2),
      +st.demand.q5[i].toFixed(2),   +st.demand.q95[i].toFixed(2),
      +(st.solarAvailability.mean[i]*100).toFixed(2), +(st.solarAvailability.std[i]*100).toFixed(2),
      +(st.windAvailability.mean[i]*100).toFixed(2),  +(st.windAvailability.std[i]*100).toFixed(2),
      +st.capexPv.mean[i].toFixed(2), +st.capexPv.std[i].toFixed(2),
      +st.gasPrice.mean[i].toFixed(2), +st.gasPrice.std[i].toFixed(2),
    ])
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(statRows), "Statistiques")

  XLSX.writeFile(wb, `${method === "mc" ? "monte_carlo" : "lhs"}_scenarios_${numScenarios}s_${startYear}-${endYear}.xlsx`)
}

// ─── Chart helpers for PDF ────────────────────────────────────────────────────

function buildEnvelopeData(simResult: SimulationResult) {
  const years = simResult.scenarios[0].years
  const st = simResult.statistics
  return years.map((yr, i) => ({
    year: yr,
    mean: +st.demand.mean[i].toFixed(1),
    q5:   +st.demand.q5[i].toFixed(1),
    q95:  +st.demand.q95[i].toFixed(1),
    min:  +st.demand.min[i].toFixed(1),
    max:  +st.demand.max[i].toFixed(1),
  }))
}

function buildSectorData(simResult: SimulationResult) {
  const years = simResult.scenarios[0].years
  const st = simResult.statistics
  return years.map((yr, i) => ({
    year: yr,
    solaire: +(st.solarAvailability.mean[i] * 100).toFixed(2),
    eolien:  +(st.windAvailability.mean[i]  * 100).toFixed(2),
    capex:   +st.capexPv.mean[i].toFixed(1),
    gaz:     +st.gasPrice.mean[i].toFixed(2),
  }))
}

const CHART_COLORS = {
  mc:   { stroke: "#3b82f6", fill: "#3b82f680" },
  lhs:  { stroke: "#10b981", fill: "#10b98180" },
  mean: "#6366f1",
  q95:  "#f59e0b",
  q5:   "#f59e0b",
  capex:"#8b5cf6",
  gaz:  "#ef4444",
}

// ─── PDF chart section (rendered in page, captured by html2canvas) ─────────────

function PdfChartSection({ mcResult, lhsResult }: { mcResult: SimulationResult | null; lhsResult: SimulationResult | null }) {
  const comparisons = (mcResult && lhsResult)
    ? [
        buildComparison(mcResult, lhsResult, "demand",            "Demande totale",         "ktep"),
        buildComparison(mcResult, lhsResult, "solarAvailability", "Disponibilite solaire",  "%"),
        buildComparison(mcResult, lhsResult, "windAvailability",  "Disponibilite eolienne", "%"),
        buildComparison(mcResult, lhsResult, "capexPv",           "CAPEX PV",               "€/kW"),
        buildComparison(mcResult, lhsResult, "gasPrice",          "Prix du gaz",            "€/MBtu"),
      ]
    : []

  const multiKeys: Record<string, (v: number) => number> = {
    "Disponibilite solaire":  v => v * 100,
    "Disponibilite eolienne": v => v * 100,
  }

  return (
    <div style={{ background: "#fff", color: "#111", fontFamily: "sans-serif", padding: 24, minWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Rapport de Simulation Monte Carlo &amp; LHS</h1>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 24 }}>Généré le {new Date().toLocaleDateString("fr-FR")}</p>

      {/* ── Monte Carlo ── */}
      {mcResult && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, borderBottom: "2px solid #3b82f6", paddingBottom: 6, marginBottom: 16 }}>Monte Carlo — {mcResult.scenarios.length} scénarios</h2>

          {/* Stats table */}
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Statistiques — Demande totale (ktep)</h3>
          <StatsTablePdf result={mcResult} />

          {/* Envelope chart */}
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>Enveloppe — Demande totale</h3>
          <div style={{ width: 860, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={buildEnvelopeData(mcResult)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="q95" fill="#3b82f640" stroke="none" name="Q95" />
                <Area type="monotone" dataKey="q5"  fill="#ffffff"   stroke="none" name="Q5" />
                <Line type="monotone" dataKey="mean" stroke="#3b82f6" strokeWidth={2} dot={false} name="Moyenne" />
                <Line type="monotone" dataKey="q5"   stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Q5%" />
                <Line type="monotone" dataKey="q95"  stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Q95%" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Sector trends */}
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>Variables stochastiques — Moyennes</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <MiniChart data={buildSectorData(mcResult)} dataKey="solaire" label="Solaire (%)" color="#f59e0b" />
            <MiniChart data={buildSectorData(mcResult)} dataKey="eolien"  label="Eolien (%)"  color="#6366f1" />
            <MiniChart data={buildSectorData(mcResult)} dataKey="capex"   label="CAPEX PV (€/kW)" color="#8b5cf6" />
            <MiniChart data={buildSectorData(mcResult)} dataKey="gaz"     label="Prix gaz (€/MBtu)" color="#ef4444" />
          </div>
        </section>
      )}

      {/* ── LHS ── */}
      {lhsResult && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, borderBottom: "2px solid #10b981", paddingBottom: 6, marginBottom: 16 }}>LHS — {lhsResult.scenarios.length} scénarios</h2>

          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Statistiques — Demande totale (ktep)</h3>
          <StatsTablePdf result={lhsResult} />

          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>Enveloppe — Demande totale</h3>
          <div style={{ width: 860, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={buildEnvelopeData(lhsResult)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="q95" fill="#10b98140" stroke="none" name="Q95" />
                <Area type="monotone" dataKey="q5"  fill="#ffffff"   stroke="none" name="Q5" />
                <Line type="monotone" dataKey="mean" stroke="#10b981" strokeWidth={2} dot={false} name="Moyenne" />
                <Line type="monotone" dataKey="q5"   stroke="#10b981" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Q5%" />
                <Line type="monotone" dataKey="q95"  stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Q95%" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>Variables stochastiques — Moyennes</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <MiniChart data={buildSectorData(lhsResult)} dataKey="solaire" label="Solaire (%)" color="#f59e0b" />
            <MiniChart data={buildSectorData(lhsResult)} dataKey="eolien"  label="Eolien (%)"  color="#6366f1" />
            <MiniChart data={buildSectorData(lhsResult)} dataKey="capex"   label="CAPEX PV (€/kW)" color="#8b5cf6" />
            <MiniChart data={buildSectorData(lhsResult)} dataKey="gaz"     label="Prix gaz (€/MBtu)" color="#ef4444" />
          </div>
        </section>
      )}

      {/* ── Comparaison MC vs LHS ── */}
      {comparisons.length > 0 && (
        <section>
          <h2 style={{ fontSize: 17, fontWeight: 700, borderBottom: "2px solid #6366f1", paddingBottom: 6, marginBottom: 16 }}>Comparaison MC vs LHS</h2>

          {/* Summary table */}
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Résumé comparatif (dernière année)</h3>
          <ComparisonTablePdf comparisons={comparisons} multipliers={multiKeys} />

          {/* Comparison charts per variable */}
          {comparisons.map(comp => {
            const mult = multiKeys[comp.variable] ?? ((v: number) => v)
            const chartData = comp.years.map((year, i) => ({
              year,
              mc:  +mult(comp.mcMean[i]).toFixed(2),
              lhs: +mult(comp.lhsMean[i]).toFixed(2),
            }))
            return (
              <div key={comp.variable} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 6px" }}>Moyenne — {comp.variable} ({comp.unit})</h3>
                <div style={{ width: 860, height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="mc"  stroke="#3b82f6" strokeWidth={2} dot={false} name="Monte Carlo" />
                      <Line type="monotone" dataKey="lhs" stroke="#10b981" strokeWidth={2} dot={false} name="LHS" strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

function MiniChart({ data, dataKey, label, color }: { data: Record<string, unknown>[]; dataKey: string; label: string; color: string }) {
  return (
    <div style={{ width: 200, marginBottom: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: "#374151" }}>{label}</p>
      <div style={{ width: 200, height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="year" hide />
            <YAxis hide />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatsTablePdf({ result }: { result: SimulationResult }) {
  const years = result.scenarios[0].years
  const st = result.statistics
  const show = [0, Math.floor(years.length / 4), Math.floor(years.length / 2), Math.floor(3 * years.length / 4), years.length - 1]
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 4 }}>
      <thead>
        <tr style={{ background: "#f3f4f6" }}>
          {["Année","Moyenne","Std","Min","Q5%","Q50%","Q95%","Max"].map(h => (
            <th key={h} style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {show.map(i => (
          <tr key={years[i]}>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", fontWeight: 600 }}>{years[i]}</td>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{st.demand.mean[i].toFixed(0)}</td>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{st.demand.std[i].toFixed(0)}</td>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{st.demand.min[i].toFixed(0)}</td>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{st.demand.q5[i].toFixed(0)}</td>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{st.demand.q50[i].toFixed(0)}</td>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{st.demand.q95[i].toFixed(0)}</td>
            <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{st.demand.max[i].toFixed(0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ComparisonTablePdf({ comparisons, multipliers }: { comparisons: ReturnType<typeof buildComparison>[]; multipliers: Record<string, (v: number) => number> }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12 }}>
      <thead>
        <tr style={{ background: "#f3f4f6" }}>
          {["Variable","Moy. MC","Moy. LHS","σ MC","σ LHS","Écart relatif μ","Ratio σ"].map(h => (
            <th key={h} style={{ border: "1px solid #d1d5db", padding: "4px 8px", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {comparisons.map(c => {
          const mult = multipliers[c.variable] ?? ((v: number) => v)
          const last = c.years.length - 1
          const mcMu  = mult(c.mcMean[last])
          const lhsMu = mult(c.lhsMean[last])
          const mcS   = mult(c.mcStd[last])
          const lhsS  = mult(c.lhsStd[last])
          const rel   = mcS > 0 ? (Math.abs(mcMu - lhsMu) / mcS * 100).toFixed(1) + "%" : "—"
          const ratio = mcS > 0 ? (lhsS / mcS).toFixed(3) : "—"
          const dec   = c.unit === "€/MBtu" ? 2 : c.unit === "%" ? 1 : 0
          return (
            <tr key={c.variable}>
              <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", fontWeight: 600 }}>{c.variable} ({c.unit})</td>
              <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{mcMu.toFixed(dec)}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{lhsMu.toFixed(dec)}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{mcS.toFixed(dec)}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{lhsS.toFixed(dec)}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{rel}</td>
              <td style={{ border: "1px solid #d1d5db", padding: "3px 8px", textAlign: "right" }}>{ratio}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Error boundary so a chart crash doesn't wipe the page state ─────────────

class PdfErrorBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  render() { return this.state.err ? null : this.props.children }
}

// ─── Main Export Page ──────────────────────────────────────────────────────────

export default function ExportPage() {
  const { result, lhsResult, params } = useSimulation()
  const [pdfLoading, setPdfLoading] = useState(false)
  const pdfRef = useRef<HTMLDivElement>(null)

  if (!result && !lhsResult) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Export des données</h1>
          <p className="text-muted-foreground">Exportez vos scénarios pour l&apos;optimisation.</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Aucune simulation n&apos;a encore été lancée.</p>
              <Button asChild><Link href="/generation">Lancer une simulation</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Download helpers ─────────────────────────────────────────────────────────

  const downloadCSV = () => {
    if (!result) return
    const csv = exportToCSV(result)
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `monte_carlo_scenarios_${params.numScenarios}s_${params.startYear}-${params.endYear}.csv`)
  }

  const downloadJSON = () => {
    if (!result) return
    triggerDownload(new Blob([exportToJSON(result)], { type: "application/json" }), `monte_carlo_scenarios_${params.numScenarios}s_${params.startYear}-${params.endYear}.json`)
  }

  const downloadJSONConfig = () => {
    const config = JSON.stringify({ stochasticParams: params, deterministicParams: DEFAULT_DETERMINISTIC_PARAMS }, null, 2)
    triggerDownload(new Blob([config], { type: "application/json" }), `simulation_config_${params.startYear}-${params.endYear}.json`)
  }

  const downloadMCExcel = async () => {
    if (!result) return
    await downloadExcelMultiSheet(result, "mc", params.numScenarios, params.startYear, params.endYear)
  }

  const downloadLHSExcel = async () => {
    if (!lhsResult) return
    await downloadExcelMultiSheet(lhsResult, "lhs", params.numScenarios, params.startYear, params.endYear)
  }

  const downloadPDF = async () => {
    if (!pdfRef.current) return
    setPdfLoading(true)
    try {
      const { toPng } = await import("html-to-image")
      const { default: jsPDF } = await import("jspdf")

      // Let Recharts mount and measure its containers
      await new Promise(resolve => setTimeout(resolve, 800))

      const dataUrl = await toPng(pdfRef.current, {
        pixelRatio: 1.5,
        backgroundColor: "#ffffff",
      })

      const img = new Image()
      img.src = dataUrl
      await new Promise<void>(resolve => { img.onload = () => resolve() })

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usableW = pageW - margin * 2
      const imgW = img.width
      const imgH = img.height
      const ratio = usableW / imgW
      const scaledH = imgH * ratio
      const pagesNeeded = Math.ceil(scaledH / (pageH - margin * 2))

      for (let p = 0; p < pagesNeeded; p++) {
        if (p > 0) pdf.addPage()
        const srcY = p * (pageH - margin * 2) / ratio
        const sliceH = Math.min((pageH - margin * 2) / ratio, imgH - srcY)
        const sliceCanvas = document.createElement("canvas")
        sliceCanvas.width = imgW
        sliceCanvas.height = sliceH
        const ctx = sliceCanvas.getContext("2d")!
        ctx.drawImage(img, 0, srcY, imgW, sliceH, 0, 0, imgW, sliceH)
        pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, margin, usableW, sliceH * ratio)
      }

      pdf.save(`rapport_simulation_mc_lhs_${params.startYear}-${params.endYear}.pdf`)
    } catch (err) {
      console.error("PDF error:", err)
      window.alert("Erreur PDF. Utilisez Ctrl+P pour imprimer/enregistrer en PDF depuis le navigateur.")
    } finally {
      setPdfLoading(false)
    }
  }

  const totalDataPoints = (result?.scenarios.length ?? 0) * ((result?.scenarios[0]?.years.length) ?? 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Export des données</h1>
        <p className="text-muted-foreground">Excel multi-feuilles par méthode + PDF complet avec graphiques et tableaux.</p>
      </div>

      {/* Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Données disponibles</CardTitle>
          <CardDescription>Résumé des simulations à exporter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Scénarios" value={(result ?? lhsResult)!.scenarios.length.toString()} />
            <StatCard label="Années" value={(params.endYear - params.startYear + 1).toString()} />
            <StatCard label="MC" value={result ? "✓ Généré" : "—"} />
            <StatCard label="LHS" value={lhsResult ? "✓ Généré" : "—"} />
          </div>
        </CardContent>
      </Card>

      {/* ── Excel exports ── */}
      <h2 className="text-xl font-semibold mb-4">Exports Excel multi-feuilles</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Chaque fichier contient : <strong>Tous</strong> (toutes variables) · <strong>Résidentiel</strong> · <strong>Industriel</strong> · <strong>Transport</strong> · <strong>Agriculture</strong> · <strong>Tertiaire</strong> · <strong>Statistiques</strong>
      </p>
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileSpreadsheet className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Monte Carlo (.xlsx)</CardTitle>
                <CardDescription>7 feuilles — tous secteurs + stats</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Feuille 1 : toutes les variables. Feuilles 2–6 : une par secteur (lignes = années, colonnes = scénarios + stats). Feuille 7 : statistiques agrégées.
            </p>
            <Button onClick={downloadMCExcel} className="w-full gap-2" disabled={!result}>
              <Download className="h-4 w-4" />
              {result ? "Télécharger Monte Carlo" : "Simulation MC non lancée"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-lg">LHS (.xlsx)</CardTitle>
                <CardDescription>7 feuilles — tous secteurs + stats</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Même structure que Monte Carlo. Feuille 1 : toutes variables. Feuilles 2–6 : par secteur. Feuille 7 : statistiques LHS.
            </p>
            <Button onClick={downloadLHSExcel} className="w-full gap-2" variant="outline" disabled={!lhsResult}
              style={{ borderColor: "#10b981", color: "#10b981" }}>
              <Download className="h-4 w-4" />
              {lhsResult ? "Télécharger LHS" : "Simulation LHS non lancée"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── PDF export ── */}
      <h2 className="text-xl font-semibold mb-4">Export PDF — Rapport complet</h2>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Printer className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-lg">PDF avec graphiques &amp; tableaux</CardTitle>
              <CardDescription>Rapport unique : MC + LHS + Comparaison</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Un PDF A4 contenant : enveloppes de demande · variables stochastiques · tableaux statistiques · comparaison MC vs LHS pour les deux méthodes. La génération peut prendre quelques secondes.
          </p>
          <Button onClick={downloadPDF} disabled={pdfLoading || (!result && !lhsResult)} className="w-full gap-2" variant="outline">
            {pdfLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Génération du PDF…</> : <><Printer className="h-4 w-4" />Télécharger le PDF complet</>}
          </Button>
        </CardContent>
      </Card>

      {/* ── Other exports ── */}
      <h2 className="text-xl font-semibold mb-4">Autres formats</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">CSV</CardTitle>
                <CardDescription>Format tabulaire (MC)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Une ligne par (scénario, année). Compatible Python/Pandas, R, Excel.</p>
            <Button onClick={downloadCSV} className="w-full gap-2" disabled={!result}>
              <Download className="h-4 w-4" />Télécharger CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileJson className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">JSON</CardTitle>
                <CardDescription>Structure complète (MC)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Hiérarchique avec metadata, scénarios, statistiques et extrêmes.</p>
            <Button onClick={downloadJSON} className="w-full gap-2" disabled={!result}>
              <Download className="h-4 w-4" />Télécharger JSON
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileJson className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Config</CardTitle>
                <CardDescription>Paramètres complets</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Tous les paramètres stochastiques et déterministes en JSON.</p>
            <Button onClick={downloadJSONConfig} variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />Config JSON
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Hidden PDF render zone — wrapped in ErrorBoundary so a Recharts crash doesn't reset page state */}
      <div style={{ position: "fixed", top: 0, left: "-9999px", width: 920, zIndex: -1, pointerEvents: "none" }}>
        <div ref={pdfRef}>
          <PdfErrorBoundary>
            <PdfChartSection mcResult={result} lhsResult={lhsResult} />
          </PdfErrorBoundary>
        </div>
      </div>
    </div>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
