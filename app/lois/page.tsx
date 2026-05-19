"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const laws = [
  {
    id: "demand",
    title: "Demande sectorielle",
    variable: "D_{s,t}(ω)",
    distribution: "Normale + Tendance polynomiale",
    formula: "D_{s,t}(ω) = max(0, D̂_{s,t} + ε_{s,t}(ω))",
    explanation: `La demande energetique par secteur est modelisee comme une tendance deterministe (polynomiale ou lineaire selon le secteur) a laquelle s'ajoute un terme d'erreur stochastique.

**Pourquoi cette loi ?**
- La tendance capture l'evolution structurelle de la demande (croissance demographique, industrialisation, etc.)
- Le terme aleatoire normal represente les fluctuations imprevisibles autour de cette tendance
- La fonction max(0, ...) garantit que la demande reste toujours positive

**Tendances par secteur :**
- Residentiel: D̂_Res = 2.97t² + 218.55t + 3614.88 (croissance acceleree)
- Industriel: D̂_Ind = 7.37t² - 108.43t + 4045.29 (transition puis croissance)
- Transport: D̂_Tra = 8.92t² - 51.88t + 3291.95 (electrification progressive)
- Agriculture: D̂_Agr = 40.77t - 1003.81 (croissance lineaire)
- Tertiaire: D̂_Ter = 142.29t - 801.03 (forte croissance lineaire)

**Correlation entre secteurs :**
Les erreurs des trois principaux secteurs (Res, Ind, Tra) sont correlees via une decomposition de Cholesky, car les facteurs economiques affectent simultanement plusieurs secteurs.`,
    params: [
      { name: "σ_Res", value: "1330", unit: "ktep" },
      { name: "σ_Ind", value: "488", unit: "ktep" },
      { name: "σ_Tra", value: "1408", unit: "ktep" },
      { name: "σ_Agr", value: "102", unit: "ktep" },
      { name: "σ_Ter", value: "230", unit: "ktep" },
    ]
  },
  {
    id: "solar",
    title: "Disponibilite solaire",
    variable: "h_{PV,t}(ω)",
    distribution: "Loi Beta",
    formula: "h_{PV,t}(ω) ~ Beta(α, β)",
    explanation: `Le facteur de capacite solaire est modelise par une loi Beta.

**Pourquoi la loi Beta ?**
- Elle est naturellement bornee entre 0 et 1, ce qui correspond parfaitement a un facteur de capacite
- Elle permet de representer une distribution asymetrique, typique de la disponibilite solaire
- Les parametres α et β permettent de calibrer precisement la forme de la distribution

**Interpretation des parametres :**
- α = 5.76 et β = 3.84 donnent une moyenne de α/(α+β) ≈ 0.60 (60%)
- La distribution est legerement asymetrique vers la droite, refletant le fait que les bonnes journees d'ensoleillement sont plus frequentes en Algerie

**Avantages :**
- Garantit 0 ≤ h_PV ≤ 1 sans troncature artificielle
- Capture la variabilite inter-annuelle de l'irradiation solaire
- Parametres facilement interpretables et calibrables sur donnees historiques`,
    params: [
      { name: "α (alpha)", value: "5.76", unit: "" },
      { name: "β (beta)", value: "3.84", unit: "" },
      { name: "Moyenne", value: "0.60", unit: "(60%)" },
    ]
  },
  {
    id: "wind",
    title: "Disponibilite eolienne",
    variable: "h_{Wind,t}(ω)",
    distribution: "Normale tronquee",
    formula: "h_{Wind,t}(ω) ~ N_{[0,1]}(μ, σ²)",
    explanation: `Le facteur de capacite eolien est modelise par une loi normale tronquee sur [0, 1].

**Pourquoi la normale tronquee ?**
- La loi normale represente bien la variabilite naturelle de la ressource eolienne
- La troncature garantit que le facteur de capacite reste dans les bornes physiques [0, 1]
- Avec les parametres calibres (μ = 0.296, σ = 0.035), la troncature a un effet minimal

**Caracteristiques :**
- Moyenne de 29.6%, typique des sites eoliens algeriens
- Faible ecart-type (3.5%) refletant une ressource relativement stable a l'echelle annuelle
- La variabilite infra-annuelle est capturee de maniere agregee

**Comparaison avec le solaire :**
- Le facteur eolien moyen est inferieur au facteur solaire (30% vs 60%)
- La variabilite relative est plus faible pour l'eolien
- Les deux ressources sont supposees independantes dans ce modele`,
    params: [
      { name: "μ (moyenne)", value: "0.296", unit: "(29.6%)" },
      { name: "σ (ecart-type)", value: "0.035", unit: "(3.5%)" },
      { name: "Bornes", value: "[0, 1]", unit: "" },
    ]
  },
  {
    id: "capex",
    title: "CAPEX solaire",
    variable: "c^{inv}_{PV,t}(ω)",
    distribution: "Mouvement brownien geometrique (GBM)",
    formula: "c^{inv}_{PV,t+1} = c^{inv}_{PV,t} × exp(μ - σ²/2 + σZ_t)",
    explanation: `Le cout d'investissement solaire PV evolue selon un mouvement brownien geometrique.

**Pourquoi le GBM ?**
- Il garantit des valeurs toujours positives (propriete essentielle pour un cout)
- Les rendements logarithmiques sont normalement distribues
- Ce modele capture bien la tendance baissiere des couts PV avec une incertitude croissante
- C'est le modele standard en finance pour les prix d'actifs

**Parametres :**
- μ = -0.05 : tendance baissiere de 5% par an (apprentissage technologique)
- σ = 0.10 : volatilite de 10% (incertitude sur le rythme de baisse)
- c₀ = 800 €/kW : cout initial en 2024

**Interpretation :**
- En moyenne, les couts PV diminuent de ~5% par an
- Mais cette baisse est incertaine : certains scenarios montrent des baisses plus rapides (breakthroughs technologiques), d'autres plus lentes (contraintes de supply chain)
- En 2050, les couts moyens sont autour de 200-250 €/kW avec une large dispersion`,
    params: [
      { name: "c₀ (initial)", value: "800", unit: "€/kW" },
      { name: "μ (tendance)", value: "-0.05", unit: "(-5%/an)" },
      { name: "σ (volatilite)", value: "0.10", unit: "(10%)" },
    ]
  },
  {
    id: "gas",
    title: "Prix du gaz",
    variable: "P^{gaz}_t(ω)",
    distribution: "GARCH(1,1)",
    formula: "P^{gaz}_t = P^{gaz}_{t-1} × exp(μ + σ_t × z_t), σ²_t = ω + α×ε²_{t-1} + β×σ²_{t-1}",
    explanation: `Le prix du gaz est modelise par un processus GARCH(1,1), qui capture le clustering de volatilite.

**Pourquoi le modele GARCH ?**
- Les prix energetiques presentent des periodes de forte volatilite suivies d'autres periodes de forte volatilite (clustering)
- Le modele ARCH/GARCH capture cette heteroscedasticite conditionnelle
- Il permet de modeliser les chocs de prix (crises, tensions geopolitiques) et leur persistance

**Composantes du modele :**
- μ = 0.02 : tendance haussiere de 2% par an
- ω = 0.0002 : composante constante de la variance
- α = 0.10 : reaction aux chocs (coefficient ARCH)
- β = 0.85 : persistance de la volatilite (coefficient GARCH)

**Interpretation :**
- La somme α + β = 0.95 proche de 1 indique une forte persistance des regimes de volatilite
- Un choc de prix aujourd'hui a un impact durable sur la volatilite future
- Ce modele est realiste pour les marches energetiques

**Note importante :**
Le prix du gaz n'est pas ajoute separement dans la fonction objectif. Il est integre dans le cout operationnel complet : c̃_Gas,t = c_tech + P_gaz,t`,
    params: [
      { name: "P₀ (initial)", value: "4.5", unit: "€/MBtu" },
      { name: "μ (tendance)", value: "0.02", unit: "(+2%/an)" },
      { name: "ω (GARCH)", value: "0.0002", unit: "" },
      { name: "α (ARCH)", value: "0.10", unit: "" },
      { name: "β (GARCH)", value: "0.85", unit: "" },
    ]
  },
  {
    id: "fossil",
    title: "Disponibilite fossile",
    variable: "h_{i,t}(ω), i ∈ I_f",
    distribution: "Constante",
    formula: "h_{i,t}(ω) = 0.85",
    explanation: `La disponibilite des centrales fossiles est supposee constante a 85%.

**Pourquoi une valeur constante ?**
- A l'echelle annuelle, la disponibilite des centrales thermiques est relativement stable
- Les arrets programmes (maintenance) sont previsibles et integres dans le facteur de disponibilite moyen
- La variabilite intra-annuelle est negligeable pour une planification de long terme

**Valeur de 85% :**
- Represente une disponibilite technique typique des centrales a gaz
- Inclut les periodes de maintenance planifiee
- Exclut les arrets forces exceptionnels (consideres comme negligeables en moyenne)

**Simplification :**
Cette hypothese pourrait etre raffinee en introduisant une legere variabilite, mais pour un modele de planification a l'horizon 2050, cette approximation est raisonnable.`,
    params: [
      { name: "h_fossile", value: "0.85", unit: "(85%)" },
    ]
  },
  {
    id: "opcost",
    title: "Cout operationnel",
    variable: "c̃^{op}_{i,t}(ω)",
    distribution: "Normale (pour non-gaz) + Gaz integre",
    formula: "c̃^{op}_{i,t} = c̄^{op}_i + ε^{op}_{i,t}(ω) pour i ≠ Gaz, c̃^{op}_{Gas,t} = c^{tech}_{Gas} + P^{gaz}_t",
    explanation: `Les couts operationnels sont modelises differemment selon la technologie.

**Pour le gaz naturel :**
Le cout operationnel integre directement le prix du gaz simule par GARCH :
c̃_Gas,t = c_tech + P_gaz,t
Ou c_tech represente les couts techniques hors combustible.

**Pour les autres fossiles :**
c̃_i,t = c̄_i + ε_i,t avec ε_i,t ~ N(0, σ²_i)
L'ecart-type est fixe a 5% du cout moyen : σ_i = 0.05 × c̄_i

**Pourquoi cette modelisation ?**
- Le prix du gaz est la principale source d'incertitude pour les couts operationnels
- Les autres combustibles (charbon, fioul) ont des prix moins volatils
- Le terme aleatoire capture les variations de rendement, maintenance, etc.

**Point important :**
Le prix du gaz NE DOIT PAS etre ajoute separement dans la fonction objectif de l'optimisation. Il est deja integre dans le cout operationnel complet.`,
    params: [
      { name: "c_tech (gaz)", value: "15", unit: "€/MWh" },
      { name: "σ (autres)", value: "5%", unit: "du cout moyen" },
    ]
  },
]

export default function LoisPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explication des lois probabilistes</h1>
        <p className="text-muted-foreground">
          Documentation detaillee des choix de modelisation et des justifications scientifiques.
        </p>
      </div>

      {/* Key Message */}
      <Card className="mb-8 border-primary/50 bg-primary/5">
        <CardContent className="py-6">
          <p className="text-sm leading-relaxed">
            <strong>Message cle :</strong> Les choix de lois probabilistes ne sont pas arbitraires. 
            Chaque distribution a ete selectionnee pour ses proprietes mathematiques adaptees 
            a la nature physique et economique de la variable modelisee, et calibree sur des 
            donnees historiques ou des references de la litterature.
          </p>
        </CardContent>
      </Card>

      {/* Laws Accordion */}
      <Accordion type="single" collapsible className="space-y-4">
        {laws.map((law) => (
          <AccordionItem key={law.id} value={law.id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-4 text-left">
                <div>
                  <h3 className="font-semibold">{law.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    <code>{law.variable}</code> ~ {law.distribution}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-6">
                {/* Formula */}
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground mb-2">Formule</p>
                  <code className="text-sm font-mono">{law.formula}</code>
                </div>

                {/* Parameters */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Parametres</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {law.params.map((param) => (
                      <div key={param.name} className="p-3 rounded-lg bg-card border border-border">
                        <p className="text-xs text-muted-foreground">{param.name}</p>
                        <p className="font-mono font-medium">
                          {param.value} <span className="text-muted-foreground text-xs">{param.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Justification</h4>
                  <div className="prose prose-sm prose-invert max-w-none">
                    {law.explanation.split('\n\n').map((paragraph, i) => {
                      if (paragraph.startsWith('**')) {
                        return (
                          <h5 key={i} className="font-semibold text-sm mt-4 mb-2">
                            {paragraph.replace(/\*\*/g, '')}
                          </h5>
                        )
                      }
                      if (paragraph.startsWith('-')) {
                        return (
                          <ul key={i} className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                            {paragraph.split('\n').map((line, j) => (
                              <li key={j}>{line.replace(/^- /, '')}</li>
                            ))}
                          </ul>
                        )
                      }
                      return (
                        <p key={i} className="text-muted-foreground text-sm leading-relaxed">
                          {paragraph}
                        </p>
                      )
                    })}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Summary Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Resume des lois</CardTitle>
          <CardDescription>Vue synthetique des distributions utilisees</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Variable</th>
                  <th className="text-left py-3 px-4">Loi</th>
                  <th className="text-left py-3 px-4">Justification principale</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-xs">D_{'{s,t}'}(ω)</td>
                  <td className="py-3 px-4">Normale + Tendance</td>
                  <td className="py-3 px-4 text-muted-foreground">Croissance structurelle + variabilite</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-xs">h_{'{PV}'}(ω)</td>
                  <td className="py-3 px-4">Beta(5.76, 3.84)</td>
                  <td className="py-3 px-4 text-muted-foreground">Bornee [0,1], asymetrique</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-xs">h_{'{Wind}'}(ω)</td>
                  <td className="py-3 px-4">Normale tronquee</td>
                  <td className="py-3 px-4 text-muted-foreground">Variabilite naturelle bornee</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-xs">c^inv_{'{PV}'}(ω)</td>
                  <td className="py-3 px-4">GBM</td>
                  <td className="py-3 px-4 text-muted-foreground">Toujours positif, tendance baissiere</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-xs">P^gaz(ω)</td>
                  <td className="py-3 px-4">GARCH(1,1)</td>
                  <td className="py-3 px-4 text-muted-foreground">Clustering de volatilite</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-xs">h_{'{fossile}'}(ω)</td>
                  <td className="py-3 px-4">Constante (0.85)</td>
                  <td className="py-3 px-4 text-muted-foreground">Disponibilite technique stable</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
