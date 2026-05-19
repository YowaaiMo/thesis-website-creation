"use client"

import { useState, useEffect, useRef } from "react"
import { useSimulation } from "@/lib/simulation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import Link from "next/link"
import { Play, Pause, RotateCcw, FastForward } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts"

export default function AnimationPage() {
  const { result, params } = useSimulation()
  const [currentYearIndex, setCurrentYearIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(500) // ms per frame
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isPlaying && result) {
      intervalRef.current = setInterval(() => {
        setCurrentYearIndex((prev) => {
          if (prev >= result.scenarios[0].years.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, speed)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, speed, result])

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Animation temporelle</h1>
          <p className="text-muted-foreground">
            Visualisez l&apos;evolution des scenarios annee par annee.
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Aucune simulation n&apos;a encore ete lancee.
              </p>
              <Button asChild>
                <Link href="/generation">Lancer une simulation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { statistics, scenarios } = result
  const years = scenarios[0].years
  const currentYear = years[currentYearIndex]

  // Prepare data for current year
  const demandDistribution = prepareDistribution(
    scenarios.map(s => s.demand.total[currentYearIndex]),
    10
  )

  const solarDistribution = prepareDistribution(
    scenarios.map(s => s.solarAvailability[currentYearIndex] * 100),
    10
  )

  const windDistribution = prepareDistribution(
    scenarios.map(s => s.windAvailability[currentYearIndex] * 100),
    10
  )

  const capexDistribution = prepareDistribution(
    scenarios.map(s => s.capexPv[currentYearIndex]),
    10
  )

  const gasDistribution = prepareDistribution(
    scenarios.map(s => s.gasPrice[currentYearIndex]),
    10
  )

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const reset = () => {
    setIsPlaying(false)
    setCurrentYearIndex(0)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Animation temporelle</h1>
        <p className="text-muted-foreground">
          Visualisez l&apos;evolution de l&apos;incertitude entre {params.startYear} et {params.endYear}.
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Controles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Year Display */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-muted-foreground">Annee:</span>
            <span className="text-5xl font-bold text-primary">{currentYear}</span>
          </div>

          {/* Progress Slider */}
          <div className="space-y-2">
            <Slider
              value={[currentYearIndex]}
              onValueChange={([value]) => {
                setCurrentYearIndex(value)
                setIsPlaying(false)
              }}
              min={0}
              max={years.length - 1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{params.startYear}</span>
              <span>{params.endYear}</span>
            </div>
          </div>

          {/* Play Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button onClick={togglePlay} size="lg" className="w-32 gap-2">
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Play
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSpeed(Math.max(100, speed - 100))}
              disabled={speed <= 100}
            >
              <FastForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Speed Control */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-muted-foreground">Vitesse:</span>
            <Slider
              value={[speed]}
              onValueChange={([value]) => setSpeed(value)}
              min={100}
              max={1000}
              step={100}
              className="w-48"
            />
            <span className="text-sm text-muted-foreground w-20">{speed}ms</span>
          </div>
        </CardContent>
      </Card>

      {/* Statistics for Current Year */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Demande moyenne"
          value={`${(statistics.demand.mean[currentYearIndex] / 1000).toFixed(1)}k`}
          unit="ktep"
          q5={statistics.demand.q5[currentYearIndex] / 1000}
          q95={statistics.demand.q95[currentYearIndex] / 1000}
        />
        <StatCard
          label="Solaire moyen"
          value={`${(statistics.solarAvailability.mean[currentYearIndex] * 100).toFixed(1)}`}
          unit="%"
          q5={statistics.solarAvailability.q5[currentYearIndex] * 100}
          q95={statistics.solarAvailability.q95[currentYearIndex] * 100}
        />
        <StatCard
          label="Eolien moyen"
          value={`${(statistics.windAvailability.mean[currentYearIndex] * 100).toFixed(1)}`}
          unit="%"
          q5={statistics.windAvailability.q5[currentYearIndex] * 100}
          q95={statistics.windAvailability.q95[currentYearIndex] * 100}
        />
        <StatCard
          label="CAPEX PV"
          value={`${statistics.capexPv.mean[currentYearIndex].toFixed(0)}`}
          unit="Euro/kW"
          q5={statistics.capexPv.q5[currentYearIndex]}
          q95={statistics.capexPv.q95[currentYearIndex]}
        />
        <StatCard
          label="Prix Gaz"
          value={`${statistics.gasPrice.mean[currentYearIndex].toFixed(2)}`}
          unit="Euro/MBtu"
          q5={statistics.gasPrice.q5[currentYearIndex]}
          q95={statistics.gasPrice.q95[currentYearIndex]}
        />
      </div>

      {/* Distribution Charts */}
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <DistributionChart
          title="Distribution de la demande"
          data={demandDistribution}
          color="var(--chart-1)"
          unit="ktep"
        />
        <DistributionChart
          title="Distribution solaire"
          data={solarDistribution}
          color="var(--chart-3)"
          unit="%"
        />
        <DistributionChart
          title="Distribution eolienne"
          data={windDistribution}
          color="var(--chart-5)"
          unit="%"
        />
        <DistributionChart
          title="Distribution CAPEX PV"
          data={capexDistribution}
          color="var(--chart-2)"
          unit="Euro/kW"
        />
        <DistributionChart
          title="Distribution prix gaz"
          data={gasDistribution}
          color="var(--chart-4)"
          unit="Euro/MBtu"
        />
      </div>
    </div>
  )
}

function prepareDistribution(values: number[], numBins: number) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const binWidth = (max - min) / numBins

  const bins = Array(numBins).fill(0).map((_, i) => ({
    range: `${(min + i * binWidth).toFixed(0)}-${(min + (i + 1) * binWidth).toFixed(0)}`,
    count: 0,
    min: min + i * binWidth,
    max: min + (i + 1) * binWidth,
  }))

  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), numBins - 1)
    if (binIndex >= 0) bins[binIndex].count++
  })

  return bins
}

function StatCard({ 
  label, 
  value, 
  unit, 
  q5, 
  q95 
}: { 
  label: string; 
  value: string; 
  unit: string;
  q5: number;
  q95: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-3xl font-bold">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          IC 90%: [{q5.toFixed(1)} - {q95.toFixed(1)}]
        </p>
      </CardContent>
    </Card>
  )
}

function DistributionChart({ 
  title, 
  data, 
  color, 
  unit 
}: { 
  title: string; 
  data: { range: string; count: number }[];
  color: string;
  unit: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Histogramme des {data.reduce((a, b) => a + b.count, 0)} scenarios</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis 
                dataKey="range" 
                stroke="var(--muted-foreground)"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                interval={1}
              />
              <YAxis 
                stroke="var(--muted-foreground)"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--card-foreground)'
                }}
                formatter={(value: number) => [`${value} scenarios`, 'Frequence']}
              />
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
