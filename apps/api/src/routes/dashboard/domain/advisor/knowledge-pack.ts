import type {
  DashboardAdvisorKnowledgeAnswerResponse,
  DashboardAdvisorKnowledgeCitationResponse,
  DashboardAdvisorKnowledgeTopicResponse,
  DashboardAdvisorKnowledgeTopicsResponse,
} from '../../advisor-contract'

type KnowledgeTopic = DashboardAdvisorKnowledgeTopicResponse & {
  aliases: string[]
  nextStep: string
  sections: Array<{
    sectionId: string
    title: string
    body: string
    keyPoints: string[]
    keywords: string[]
  }>
}

type KnowledgeIntent =
  DashboardAdvisorKnowledgeAnswerResponse['retrieval']['intent']

type BrowseOnlyReason = DashboardAdvisorKnowledgeTopicsResponse['browseOnlyReason']
type FallbackReason = DashboardAdvisorKnowledgeAnswerResponse['fallbackReason']

const EDUCATIONAL_GUARDRAIL =
  'Contenu educatif uniquement. Pas de recommandation personnalisee, fiscale, juridique ou de signal achat/vente.'

const KNOWLEDGE_PACK: KnowledgeTopic[] = [
  {
    topicId: 'emergency-fund',
    title: 'Fonds d urgence',
    summary:
      'Un fonds d urgence sert a absorber les chocs de court terme sans vendre des placements dans un mauvais timing.',
    difficulty: 'beginner',
    estimatedReadMinutes: 4,
    tags: ['cash', 'safety', 'budget', 'liquidity'],
    aliases: ['epargne de precaution', 'reserve de securite', 'cash buffer'],
    relatedQuestions: [
      'Combien de mois de depenses garder en cash ?',
      'Pourquoi un fonds d urgence avant d investir ?',
      'Ou placer une reserve de court terme ?',
    ],
    nextStep:
      'Estimez vos depenses fixes mensuelles puis comparez-les a votre epargne disponible et vraiment liquide.',
    sections: [
      {
        sectionId: 'role',
        title: 'Role principal',
        body:
          'Le fonds d urgence protege la tresorerie personnelle contre les imprevus comme une depense de sante, une panne, ou une baisse temporaire de revenus.',
        keyPoints: [
          'Il sert d amortisseur de court terme.',
          'Il evite de vendre un placement sous pression.',
        ],
        keywords: ['imprevu', 'liquidite', 'revenus', 'tresorerie'],
      },
      {
        sectionId: 'sizing',
        title: 'Dimensionnement',
        body:
          'Une regle pedagogique consiste a viser quelques mois de depenses essentielles, puis a ajuster selon la stabilite des revenus et les personnes a charge.',
        keyPoints: [
          'Des revenus variables justifient souvent un coussin plus epais.',
          'Le niveau cible depend de la volatilite du foyer, pas seulement du salaire nominal.',
        ],
        keywords: ['mois', 'depenses', 'stabilite', 'coussin'],
      },
    ],
  },
  {
    topicId: 'diversification',
    title: 'Diversification',
    summary:
      'Diversifier revient a ne pas faire dependre un resultat financier d une seule ligne, d un seul pays, ou d un seul scenario.',
    difficulty: 'beginner',
    estimatedReadMinutes: 5,
    tags: ['portfolio', 'risk', 'allocation'],
    aliases: ['allocation diversifiee', 'spread risk'],
    relatedQuestions: [
      'Pourquoi diversifier un portefeuille ?',
      'Est-ce qu un seul ETF suffit ?',
      'Comment reduire le risque de concentration ?',
    ],
    nextStep:
      'Listez vos expositions principales par classe d actifs, zone geographique et devise avant de juger la diversification.',
    sections: [
      {
        sectionId: 'concentration',
        title: 'Risque de concentration',
        body:
          'Une forte concentration amplifie la dependance a un theme, un employeur, un secteur ou une zone geographique. La diversification reduit ce risque specifique.',
        keyPoints: [
          'Elle amortit le choc d une seule erreur de these.',
          'Elle ne supprime pas le risque de marche global.',
        ],
        keywords: ['concentration', 'secteur', 'pays', 'risque specifique'],
      },
      {
        sectionId: 'tradeoffs',
        title: 'Compromis',
        body:
          'Diversifier peut rendre la performance moins spectaculaire en marche haussier concentre, mais elle rend souvent le parcours plus robuste.',
        keyPoints: [
          'La diversification vise la resilience, pas le maximum absolu.',
          'Le bon niveau depend de l horizon et de la tolerance a la volatilite.',
        ],
        keywords: ['resilience', 'volatilite', 'horizon', 'parcours'],
      },
    ],
  },
  {
    topicId: 'dca',
    title: 'Investissement progressif (DCA)',
    summary:
      'Le DCA consiste a investir un montant fixe a intervalles reguliers afin de lisser le prix d entree et la charge emotionnelle.',
    difficulty: 'beginner',
    estimatedReadMinutes: 4,
    tags: ['investing', 'automation', 'discipline'],
    aliases: ['dollar cost averaging', 'versement programme', 'investissement mensuel'],
    relatedQuestions: [
      'Le DCA est-il utile quand le marche est cher ?',
      'Vaut-il mieux investir en une fois ou progressivement ?',
      'Pourquoi automatiser un investissement mensuel ?',
    ],
    nextStep:
      'Mesurez si votre rythme d investissement est compatible avec votre capacite d epargne et votre horizon.',
    sections: [
      {
        sectionId: 'mechanics',
        title: 'Mecanique',
        body:
          'En investissant regulierement, on achete plus de parts quand les prix sont bas et moins quand ils sont eleves. Cela lisse le prix moyen d entree.',
        keyPoints: [
          'Le DCA agit surtout sur le comportement et la discipline.',
          'Il ne garantit pas de surperformance.',
        ],
        keywords: ['prix moyen', 'automatique', 'discipline', 'regularite'],
      },
      {
        sectionId: 'limits',
        title: 'Limites',
        body:
          'Si le capital est deja disponible et que l horizon est long, un investissement immediate peut statistiquement etre plus performant, mais le DCA peut rester plus acceptable psychologiquement.',
        keyPoints: [
          'Le bon choix depend souvent du confort comportemental.',
          'Le DCA n efface pas le risque de marche.',
        ],
        keywords: ['lump sum', 'psychologie', 'horizon long', 'timing'],
      },
    ],
  },
  {
    topicId: 'inflation-real-return',
    title: 'Inflation et rendement reel',
    summary:
      'Le rendement reel est le rendement nominal corrige de l inflation. C est lui qui compte pour le pouvoir d achat futur.',
    difficulty: 'intermediate',
    estimatedReadMinutes: 5,
    tags: ['inflation', 'returns', 'purchasing-power'],
    aliases: ['pouvoir d achat', 'real return', 'rendement net inflation'],
    relatedQuestions: [
      'Quelle difference entre rendement nominal et reel ?',
      'Pourquoi le cash peut perdre du pouvoir d achat ?',
      'Comment lire un rendement reel ?',
    ],
    nextStep:
      'Comparez vos rendements cibles avec une hypothese d inflation explicite plutot qu avec des montants nominaux seuls.',
    sections: [
      {
        sectionId: 'definition',
        title: 'Nominal versus reel',
        body:
          'Un placement qui rapporte moins que l inflation peut afficher un gain nominal tout en appauvrissant en pouvoir d achat.',
        keyPoints: [
          'Le nominal dit ce que vaut le compte.',
          'Le reel dit ce que ce compte permet encore d acheter.',
        ],
        keywords: ['nominal', 'reel', 'pouvoir achat', 'erosion'],
      },
      {
        sectionId: 'cash',
        title: 'Impact sur le cash',
        body:
          'Des liquidites trop abondantes peuvent proteger le court terme mais peser sur le rendement reel de long terme si leur remuneration reste inferieure a l inflation.',
        keyPoints: [
          'La liquidite a une utilite, mais aussi un cout d opportunite.',
          'Le bon arbitrage depend du besoin de disponibilite.',
        ],
        keywords: ['cash drag', 'opportunite', 'liquidite', 'inflation'],
      },
    ],
  },
  {
    topicId: 'bonds-rates',
    title: 'Obligations et taux',
    summary:
      'Le prix des obligations varie en sens inverse des taux. Cette relation explique pourquoi la partie taux d un portefeuille peut bouger fortement.',
    difficulty: 'intermediate',
    estimatedReadMinutes: 6,
    tags: ['bonds', 'rates', 'duration'],
    aliases: ['sensibilite aux taux', 'duration', 'obligations'],
    relatedQuestions: [
      'Pourquoi les obligations baissent quand les taux montent ?',
      'Que signifie la duration ?',
      'A quoi servent les obligations dans un portefeuille ?',
    ],
    nextStep:
      'Regardez la maturite et la duration avant de comparer deux expositions obligataires.',
    sections: [
      {
        sectionId: 'inverse',
        title: 'Relation inverse',
        body:
          'Quand les taux montent, les anciennes obligations au coupon plus faible deviennent moins attractives, donc leur prix baisse pour s ajuster.',
        keyPoints: [
          'Taux en hausse et prix obligataires en baisse vont souvent ensemble.',
          'L ampleur depend de la duree de vie des flux.',
        ],
        keywords: ['coupon', 'maturite', 'prix', 'taux'],
      },
      {
        sectionId: 'role',
        title: 'Role dans une allocation',
        body:
          'Les obligations peuvent stabiliser une allocation, produire du revenu, ou servir de poche moins risquee, mais leur comportement change selon le niveau de taux et la qualite de credit.',
        keyPoints: [
          'La poche obligataire n est pas un bloc homogene.',
          'Il faut distinguer taux, duration et risque credit.',
        ],
        keywords: ['credit', 'stabilite', 'revenu', 'allocation'],
      },
    ],
  },
  {
    topicId: 'debt-priority',
    title: 'Priorisation des dettes',
    summary:
      'Toutes les dettes ne se valent pas. Le cout, la flexibilite et le risque associe determinent souvent l ordre de priorite.',
    difficulty: 'beginner',
    estimatedReadMinutes: 5,
    tags: ['debt', 'budget', 'cashflow'],
    aliases: ['rembourser ses dettes', 'debt avalanche', 'debt snowball'],
    relatedQuestions: [
      'Faut-il rembourser ou investir en premier ?',
      'Comment prioriser plusieurs credits ?',
      'Pourquoi un taux eleve change la decision ?',
    ],
    nextStep:
      'Distinguez les dettes a taux eleve, les dettes amortissables stables et les dettes a risque de penalites ou d impayes.',
    sections: [
      {
        sectionId: 'cost',
        title: 'Cout explicite',
        body:
          'Une dette a taux eleve cree une charge quasi certaine. La comparer a un rendement de marche incertain aide a prioriser rationnellement.',
        keyPoints: [
          'Le cout de la dette est contractuel.',
          'Le rendement d un placement reste incertain.',
        ],
        keywords: ['taux eleve', 'cout certain', 'arbitrage', 'interets'],
      },
      {
        sectionId: 'cashflow',
        title: 'Souplesse et tresorerie',
        body:
          'Le bon ordre depend aussi de la marge mensuelle, de la presence d une reserve, et des risques lies au non-paiement.',
        keyPoints: [
          'La tresorerie compte autant que le taux nominal.',
          'Un arbitrage sain preserve la capacite a faire face aux imprevus.',
        ],
        keywords: ['marge', 'reserve', 'impayes', 'souplesse'],
      },
    ],
  },
  {
    topicId: 'risk-horizon',
    title: 'Risque et horizon',
    summary:
      'La capacite a supporter la volatilite depend moins d une preference abstraite que du temps disponible avant d avoir besoin de l argent.',
    difficulty: 'beginner',
    estimatedReadMinutes: 5,
    tags: ['risk', 'time-horizon', 'volatility'],
    aliases: ['tolerance au risque', 'horizon de placement', 'volatilite'],
    relatedQuestions: [
      'Comment relier risque et horizon de placement ?',
      'Pourquoi l horizon compte pour investir ?',
      'Quand faut-il reduire le risque ?',
    ],
    nextStep:
      'Associez chaque projet a une date cible avant de juger si une poche volatile est appropriee.',
    sections: [
      {
        sectionId: 'time',
        title: 'Le temps absorbe la volatilite',
        body:
          'Plus l horizon est long, plus un investisseur peut attendre la normalisation potentielle d un marche apres un choc, meme si rien n est garanti.',
        keyPoints: [
          'Le risque de devoir vendre au mauvais moment baisse quand le temps disponible augmente.',
          'Le court terme supporte mal les actifs volatils.',
        ],
        keywords: ['temps', 'volatilite', 'projet', 'vente forcee'],
      },
      {
        sectionId: 'bucket',
        title: 'Segmentation par objectif',
        body:
          'Il est souvent plus utile de separer les enveloppes selon les usages de l argent que de chercher un profil unique pour tout le patrimoine.',
        keyPoints: [
          'Une meme personne peut avoir plusieurs horizons.',
          'Les projets de court terme exigent souvent plus de liquidite.',
        ],
        keywords: ['objectif', 'court terme', 'long terme', 'segmentation'],
      },
    ],
  },
  {
    topicId: 'rebalancing',
    title: 'Reequilibrage',
    summary:
      'Le reequilibrage consiste a ramener une allocation vers sa cible apres les mouvements de marche ou les nouveaux versements.',
    difficulty: 'intermediate',
    estimatedReadMinutes: 5,
    tags: ['allocation', 'discipline', 'portfolio-maintenance'],
    aliases: ['rebalancing', 'bandes de reequilibrage', 'allocation cible'],
    relatedQuestions: [
      'Quand reequilibrer un portefeuille ?',
      'Pourquoi reequilibrer au lieu de laisser courir ?',
      'Comment utiliser les nouveaux versements pour reequilibrer ?',
    ],
    nextStep:
      'Definissez une allocation cible et une regle simple de tolerance avant le prochain controle.',
    sections: [
      {
        sectionId: 'discipline',
        title: 'Discipline de portefeuille',
        body:
          'Le reequilibrage limite la derive d allocation et force a vendre une partie de ce qui a trop monte ou a renforcer ce qui pese moins que prevu.',
        keyPoints: [
          'Il reconnecte les poids de portefeuille a une cible explicite.',
          'Il transforme une intention de risque en geste concret.',
        ],
        keywords: ['derive', 'allocation cible', 'poids', 'discipline'],
      },
      {
        sectionId: 'methods',
        title: 'Methodes pratiques',
        body:
          'On peut reequilibrer a date fixe, par bandes de tolerance, ou au fil des nouveaux apports pour limiter les frottements.',
        keyPoints: [
          'Les apports reguliers peuvent reduire les arbitrages necessaires.',
          'Une regle simple vaut mieux qu un timing opportuniste.',
        ],
        keywords: ['bandes', 'date fixe', 'apports', 'arbitrages'],
      },
    ],
  },
]

const STOP_WORDS = new Set([
  'a',
  'alors',
  'au',
  'aux',
  'avec',
  'ce',
  'ces',
  'comment',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'est',
  'et',
  'faut',
  'il',
  'je',
  'la',
  'le',
  'les',
  'ma',
  'mes',
  'mon',
  'ou',
  'par',
  'pas',
  'plus',
  'pour',
  'pourquoi',
  'que',
  'quel',
  'quelle',
  'quelles',
  'quels',
  'qui',
  'se',
  'si',
  'sur',
  'un',
  'une',
  'what',
  'why',
  'how',
  'should',
  'i',
  'my',
  'me',
  'the',
  'is',
  'are',
])

const GUARDRAIL_PATTERNS: Array<{
  reason: Extract<
    FallbackReason,
    'guardrail_personalized_advice' | 'guardrail_regulatory_or_tax'
  >
  patterns: RegExp[]
}> = [
  {
    reason: 'guardrail_personalized_advice',
    patterns: [
      /\b(dois[- ]?je|should i|for my portfolio|dans mon portefeuille)\b/i,
      /\b(acheter|vendre|buy|sell)\b.*\b(action|stock|etf|fonds|obligation|bond|crypto)\b/i,
      /\b(quel|which|what)\b.*\b(etf|stock|action|fonds|crypto)\b.*\b(meilleur|best|choisir|buy)\b/i,
    ],
  },
  {
    reason: 'guardrail_regulatory_or_tax',
    patterns: [
      /\b(fiscal|tax|impot|impots|juridique|legal|reglementaire|regulatory|compliance)\b/i,
      /\b(pea|assurance vie|holding)\b.*\b(fiscal|tax|impot|legal)\b/i,
    ],
  },
]

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const tokenize = (value: string) =>
  normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token))

const unique = <T>(items: T[]) => Array.from(new Set(items))

const toTopicResponse = (topic: KnowledgeTopic): DashboardAdvisorKnowledgeTopicResponse => ({
  topicId: topic.topicId,
  title: topic.title,
  summary: topic.summary,
  difficulty: topic.difficulty,
  estimatedReadMinutes: topic.estimatedReadMinutes,
  tags: topic.tags,
  relatedQuestions: topic.relatedQuestions,
})

const buildTopicSearchTerms = (topic: KnowledgeTopic) =>
  unique([
    ...tokenize(topic.title),
    ...tokenize(topic.summary),
    ...topic.tags.flatMap(tokenize),
    ...topic.aliases.flatMap(tokenize),
    ...topic.relatedQuestions.flatMap(tokenize),
    ...topic.sections.flatMap(section => [...tokenize(section.title), ...section.keywords.flatMap(tokenize)]),
  ])

const inferIntent = (question: string, tokens: string[]): KnowledgeIntent => {
  const normalizedQuestion = normalizeText(question)

  if (/\b(difference|diff|compare|versus|vs)\b/.test(normalizedQuestion)) {
    return 'comparison'
  }

  if (/\b(comment|how|mettre en place|mettre en oeuvre)\b/.test(normalizedQuestion)) {
    return 'how_to'
  }

  if (/\b(risque|risk|danger|volatilite)\b/.test(normalizedQuestion)) {
    return 'risk'
  }

  if (/\b(plan|planning|objectif|horizon|prioriser|priorite)\b/.test(normalizedQuestion)) {
    return 'planning'
  }

  if (
    /\b(qu est ce|c est quoi|what is|definition|explique|explain)\b/.test(normalizedQuestion) ||
    tokens.includes('pourquoi')
  ) {
    return 'definition'
  }

  return 'unknown'
}

const detectGuardrailReason = (question: string): Extract<
  FallbackReason,
  'guardrail_personalized_advice' | 'guardrail_regulatory_or_tax'
> | null => {
  for (const candidate of GUARDRAIL_PATTERNS) {
    if (candidate.patterns.some(pattern => pattern.test(question))) {
      return candidate.reason
    }
  }

  return null
}

const scoreTopic = (topic: KnowledgeTopic, question: string, queryTokens: string[]) => {
  const normalizedQuestion = normalizeText(question)
  const searchableTerms = buildTopicSearchTerms(topic)
  const searchableSet = new Set(searchableTerms)
  const titleTokens = tokenize(topic.title)
  const aliasMatches = topic.aliases.filter(alias => normalizedQuestion.includes(normalizeText(alias))).length
  const relatedQuestionMatches = topic.relatedQuestions.filter(related =>
    normalizedQuestion.includes(normalizeText(related))
  ).length

  const overlap = queryTokens.filter(token => searchableSet.has(token)).length
  const titleOverlap = queryTokens.filter(token => titleTokens.includes(token)).length

  const score =
    overlap * 2 + titleOverlap * 2 + aliasMatches * 4 + relatedQuestionMatches * 3

  return {
    score,
    topic,
  }
}

const scoreSection = (
  topic: KnowledgeTopic,
  section: KnowledgeTopic['sections'][number],
  question: string,
  queryTokens: string[]
) => {
  const normalizedQuestion = normalizeText(question)
  const searchableTerms = unique([
    ...tokenize(section.title),
    ...section.keywords.flatMap(tokenize),
    ...section.keyPoints.flatMap(tokenize),
    ...tokenize(section.body),
  ])
  const searchableSet = new Set(searchableTerms)
  const overlap = queryTokens.filter(token => searchableSet.has(token)).length
  const titleMatch = normalizedQuestion.includes(normalizeText(section.title)) ? 2 : 0

  return {
    topic,
    section,
    score: overlap * 2 + titleMatch,
  }
}

const toConfidence = ({
  topScore,
  secondScore,
}: {
  topScore: number
  secondScore: number
}): Pick<
  DashboardAdvisorKnowledgeAnswerResponse,
  'confidenceScore' | 'confidenceLabel' | 'lowConfidence'
> => {
  if (topScore <= 0) {
    return {
      confidenceScore: 0,
      confidenceLabel: 'low',
      lowConfidence: true,
    }
  }

  const margin = Math.max(0, topScore - secondScore)
  const confidenceScore = Math.max(
    0,
    Math.min(1, topScore / 16 + Math.min(0.2, margin / 20))
  )

  if (confidenceScore >= 0.72 && topScore >= 8) {
    return {
      confidenceScore,
      confidenceLabel: 'high',
      lowConfidence: false,
    }
  }

  if (confidenceScore >= 0.48 && topScore >= 5) {
    return {
      confidenceScore,
      confidenceLabel: 'medium',
      lowConfidence: false,
    }
  }

  return {
    confidenceScore,
    confidenceLabel: 'low',
    lowConfidence: true,
  }
}

const buildCitations = ({
  question,
  queryTokens,
  rankedTopics,
}: {
  question: string
  queryTokens: string[]
  rankedTopics: Array<{ topic: KnowledgeTopic; score: number }>
}): DashboardAdvisorKnowledgeCitationResponse[] => {
  return rankedTopics
    .slice(0, 2)
    .flatMap(({ topic }) =>
      topic.sections
        .map(section => scoreSection(topic, section, question, queryTokens))
        .sort((left, right) => right.score - left.score)
        .slice(0, 2)
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ topic, section }) => ({
      citationId: `${topic.topicId}-${section.sectionId}`,
      topicId: topic.topicId,
      topicTitle: topic.title,
      sectionTitle: section.title,
      label: `${topic.title} - ${section.title}`,
      excerpt: section.body,
    }))
}

const buildStages = ({
  retrievalEnabled,
  guardrailTriggered,
  fallbackReason,
  hitCount,
}: {
  retrievalEnabled: boolean
  guardrailTriggered: boolean
  fallbackReason: FallbackReason
  hitCount: number
}) => {
  if (guardrailTriggered) {
    return [
      {
        stage: 'query_parse',
        status: 'completed',
        detail: 'Question normalisee et classee.',
      },
      {
        stage: 'retrieval',
        status: 'skipped',
        detail: 'Retrieval saute car la garde-fou a ete declenchee.',
      },
      {
        stage: 'answer_assembly',
        status: 'skipped',
        detail: 'Assemblage saute pour rester educatif et non personnalise.',
      },
      {
        stage: 'fallback',
        status: 'completed',
        detail: fallbackReason ?? 'Fallback guardrail.',
      },
    ] as const
  }

  if (!retrievalEnabled) {
    return [
      {
        stage: 'query_parse',
        status: 'completed',
        detail: 'Question normalisee et classee.',
      },
      {
        stage: 'retrieval',
        status: 'skipped',
        detail: 'Retrieval desactive par configuration runtime.',
      },
      {
        stage: 'answer_assembly',
        status: 'skipped',
        detail: 'Assemblage saute, experience browse-only preservee.',
      },
      {
        stage: 'fallback',
        status: 'completed',
        detail: fallbackReason ?? 'Browse-only mode.',
      },
    ] as const
  }

  return [
    {
      stage: 'query_parse',
      status: 'completed',
      detail: 'Question normalisee et intention inferee.',
    },
    {
      stage: 'retrieval',
      status: 'completed',
      detail: `${hitCount} sujet(s) pertinents trouves.`,
    },
    {
      stage: 'answer_assembly',
      status: hitCount > 0 ? 'completed' : 'skipped',
      detail:
        hitCount > 0
          ? 'Reponse assemblee depuis le knowledge pack.'
          : 'Assemblage saute faute de signal suffisant.',
    },
    {
      stage: 'fallback',
      status: fallbackReason ? 'completed' : 'skipped',
      detail: fallbackReason ?? 'Aucun fallback necessaire.',
    },
  ] as const
}

export const buildAdvisorKnowledgeBrowseFallback = ({
  mode,
  requestId,
  question,
  retrievalEnabled,
  fallbackReason,
  intent,
  queryParseLatencyMs,
}: {
  mode: 'demo' | 'admin'
  requestId: string
  question: string
  retrievalEnabled: boolean
  fallbackReason: FallbackReason
  intent: KnowledgeIntent
  queryParseLatencyMs: number
}): DashboardAdvisorKnowledgeAnswerResponse => {
  const generatedAt = new Date().toISOString()
  const stages = buildStages({
    retrievalEnabled,
    guardrailTriggered:
      fallbackReason === 'guardrail_personalized_advice' ||
      fallbackReason === 'guardrail_regulatory_or_tax',
    fallbackReason,
    hitCount: 0,
  })

  return {
    mode,
    source: mode === 'demo' && retrievalEnabled ? 'demo_fixture' : 'browse_fallback',
    requestId,
    generatedAt,
    status:
      fallbackReason === 'guardrail_personalized_advice' ||
      fallbackReason === 'guardrail_regulatory_or_tax'
        ? 'guardrail_blocked'
        : retrievalEnabled
          ? 'low_confidence'
          : 'browse_only',
    question,
    answer: null,
    confidenceScore: 0,
    confidenceLabel: 'low',
    lowConfidence: true,
    fallbackReason,
    retrievalEnabled,
    retrieval: {
      intent,
      matchedTopicIds: [],
      hitCount: 0,
      guardrailTriggered:
        fallbackReason === 'guardrail_personalized_advice' ||
        fallbackReason === 'guardrail_regulatory_or_tax',
      stageLatenciesMs: {
        queryParse: queryParseLatencyMs,
        retrieval: 0,
        answerAssembly: 0,
        total: queryParseLatencyMs,
      },
      stages: stages.map(stage => ({ ...stage })),
    },
    citations: [],
    suggestedTopics: KNOWLEDGE_PACK.slice(0, 4).map(toTopicResponse),
  }
}

export const buildAdvisorKnowledgeTopics = ({
  mode,
  requestId,
  retrievalEnabled,
  browseOnlyReason,
}: {
  mode: 'demo' | 'admin'
  requestId: string
  retrievalEnabled: boolean
  browseOnlyReason: BrowseOnlyReason
}): DashboardAdvisorKnowledgeTopicsResponse => ({
  mode,
  requestId,
  generatedAt: new Date().toISOString(),
  retrievalEnabled,
  browseOnlyReason,
  topics: KNOWLEDGE_PACK.map(toTopicResponse),
})

export const buildAdvisorKnowledgeAnswer = ({
  mode,
  requestId,
  question,
  retrievalEnabled,
  browseOnlyReason,
}: {
  mode: 'demo' | 'admin'
  requestId: string
  question: string
  retrievalEnabled: boolean
  browseOnlyReason: BrowseOnlyReason
}): DashboardAdvisorKnowledgeAnswerResponse => {
  const parseStartedAt = Date.now()
  const queryTokens = unique(tokenize(question))
  const intent = inferIntent(question, queryTokens)
  const queryParseLatencyMs = Date.now() - parseStartedAt

  const guardrailReason = detectGuardrailReason(question)
  if (guardrailReason) {
    return buildAdvisorKnowledgeBrowseFallback({
      mode,
      requestId,
      question,
      retrievalEnabled,
      fallbackReason: guardrailReason,
      intent,
      queryParseLatencyMs,
    })
  }

  if (!retrievalEnabled) {
    return buildAdvisorKnowledgeBrowseFallback({
      mode,
      requestId,
      question,
      retrievalEnabled,
      fallbackReason: browseOnlyReason,
      intent,
      queryParseLatencyMs,
    })
  }

  const retrievalStartedAt = Date.now()
  const rankedTopics = KNOWLEDGE_PACK.map(topic => scoreTopic(topic, question, queryTokens))
    .sort((left, right) => right.score - left.score)
    .filter(item => item.score > 0)
  const retrievalLatencyMs = Date.now() - retrievalStartedAt

  const topScore = rankedTopics[0]?.score ?? 0
  const secondScore = rankedTopics[1]?.score ?? 0
  const confidence = toConfidence({
    topScore,
    secondScore,
  })

  if (confidence.lowConfidence) {
    const lowConfidenceResponse = buildAdvisorKnowledgeBrowseFallback({
      mode,
      requestId,
      question,
      retrievalEnabled,
      fallbackReason: 'low_confidence',
      intent,
      queryParseLatencyMs,
    })

    return {
      ...lowConfidenceResponse,
      source: mode === 'demo' ? 'demo_fixture' : 'browse_fallback',
      confidenceScore: confidence.confidenceScore,
      confidenceLabel: confidence.confidenceLabel,
      retrieval: {
        ...lowConfidenceResponse.retrieval,
        matchedTopicIds: rankedTopics.slice(0, 3).map(item => item.topic.topicId),
        hitCount: rankedTopics.length,
        stageLatenciesMs: {
          queryParse: queryParseLatencyMs,
          retrieval: retrievalLatencyMs,
          answerAssembly: 0,
          total: queryParseLatencyMs + retrievalLatencyMs,
        },
        stages: buildStages({
          retrievalEnabled,
          guardrailTriggered: false,
          fallbackReason: 'low_confidence',
          hitCount: rankedTopics.length,
        }).map(stage => ({ ...stage })),
      },
      suggestedTopics: rankedTopics.slice(0, 4).map(item => toTopicResponse(item.topic)),
    }
  }

  const answerAssemblyStartedAt = Date.now()
  const topTopic = rankedTopics[0]?.topic ?? KNOWLEDGE_PACK[0]
  if (!topTopic) {
    return buildAdvisorKnowledgeBrowseFallback({
      mode,
      requestId,
      question,
      retrievalEnabled,
      fallbackReason: 'retrieval_error',
      intent,
      queryParseLatencyMs: queryParseLatencyMs + retrievalLatencyMs,
    })
  }
  const citations = buildCitations({
    question,
    queryTokens,
    rankedTopics,
  })
  const supportingSections = topTopic.sections
    .map(section => scoreSection(topTopic, section, question, queryTokens))
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map(item => item.section)
  const answerAssemblyLatencyMs = Date.now() - answerAssemblyStartedAt
  const generatedAt = new Date().toISOString()
  const stages = buildStages({
    retrievalEnabled,
    guardrailTriggered: false,
    fallbackReason: null,
    hitCount: rankedTopics.length,
  })

  return {
    mode,
    source: mode === 'demo' ? 'demo_fixture' : 'retrieval',
    requestId,
    generatedAt,
    status: 'answered',
    question,
    answer: {
      headline:
        intent === 'comparison'
          ? `${topTopic.title}: points de distinction`
          : intent === 'how_to'
            ? `${topTopic.title}: comment raisonner`
            : `${topTopic.title}: repere pedagogique`,
      summary: `${topTopic.summary} ${supportingSections[0]?.body ?? ''}`.trim(),
      keyPoints: unique(
        supportingSections.flatMap(section => section.keyPoints).slice(0, 4)
      ),
      nextStep: topTopic.nextStep,
      guardrail: EDUCATIONAL_GUARDRAIL,
    },
    confidenceScore: confidence.confidenceScore,
    confidenceLabel: confidence.confidenceLabel,
    lowConfidence: false,
    fallbackReason: null,
    retrievalEnabled,
    retrieval: {
      intent,
      matchedTopicIds: rankedTopics.slice(0, 3).map(item => item.topic.topicId),
      hitCount: rankedTopics.length,
      guardrailTriggered: false,
      stageLatenciesMs: {
        queryParse: queryParseLatencyMs,
        retrieval: retrievalLatencyMs,
        answerAssembly: answerAssemblyLatencyMs,
        total: queryParseLatencyMs + retrievalLatencyMs + answerAssemblyLatencyMs,
      },
      stages: stages.map(stage => ({ ...stage })),
    },
    citations,
    suggestedTopics: rankedTopics.slice(0, 4).map(item => toTopicResponse(item.topic)),
  }
}
