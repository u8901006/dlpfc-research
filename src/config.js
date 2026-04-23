export const CONFIG = {
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    models: ['GLM-5-Turbo', 'GLM-4.7', 'GLM-4.7-Flash'],
    maxTokens: 100000,
    timeout: 660000,
    temperature: 0.7,
  },
  pubmed: {
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    tool: 'dlpfc-research',
    email: 'u8901006@gmail.com',
    retMax: 50,
  },
  output: {
    dir: 'output',
    filePrefix: 'dlpfc-',
  },
  site: {
    title: 'DLPFC Research',
    subtitle: '前額葉皮質文獻日報',
    tagline: '每日自動更新',
    footer: {
      clinic: { name: '李政洋身心診所首頁', url: 'https://www.leepsyclinic.com/' },
      newsletter: { name: '訂閱電子報', url: 'https://blog.leepsyclinic.com/' },
      coffee: { name: 'Buy me a coffee', url: 'https://buymeacoffee.com/CYlee' },
    },
  },
};

export const SEARCH_QUERIES = [
  {
    name: 'Core PFC',
    query: '("prefrontal cortex"[Title/Abstract] OR "dorsolateral prefrontal cortex"[Title/Abstract] OR "DLPFC"[Title/Abstract] OR "ventromedial prefrontal cortex"[Title/Abstract] OR "orbitofrontal cortex"[Title/Abstract] OR "medial prefrontal cortex"[Title/Abstract] OR "ventrolateral prefrontal cortex"[Title/Abstract])',
  },
  {
    name: 'PFC + Executive Function',
    query: '("prefrontal cortex"[Title/Abstract]) AND ("executive function"[Title/Abstract] OR "cognitive control"[Title/Abstract] OR "working memory"[Title/Abstract] OR "cognitive flexibility"[Title/Abstract] OR "response inhibition"[Title/Abstract])',
  },
  {
    name: 'PFC + Psychiatry',
    query: '("prefrontal cortex"[Title/Abstract] OR "frontostriatal"[Title/Abstract]) AND (depression[Title/Abstract] OR PTSD[Title/Abstract] OR schizophrenia[Title/Abstract] OR bipolar[Title/Abstract] OR anxiety[Title/Abstract] OR ADHD[Title/Abstract] OR addiction[Title/Abstract])',
  },
  {
    name: 'PFC + Neuroimaging',
    query: '("prefrontal cortex"[Title/Abstract]) AND (fMRI[Title/Abstract] OR fNIRS[Title/Abstract] OR EEG[Title/Abstract] OR ERP[Title/Abstract] OR DTI[Title/Abstract] OR TMS[Title/Abstract] OR tDCS[Title/Abstract] OR connectivity[Title/Abstract] OR "resting-state"[Title/Abstract])',
  },
  {
    name: 'PFC + Social Cognition',
    query: '("medial prefrontal cortex"[Title/Abstract] OR "orbitofrontal cortex"[Title/Abstract] OR "ventromedial prefrontal cortex"[Title/Abstract]) AND ("social cognition"[Title/Abstract] OR empathy[Title/Abstract] OR "theory of mind"[Title/Abstract] OR "self-regulation"[Title/Abstract] OR "emotion regulation"[Title/Abstract])',
  },
  {
    name: 'PFC + Nutrition',
    query: '("prefrontal cortex"[Title/Abstract] OR "executive function"[Title/Abstract]) AND (nutrition[Title/Abstract] OR diet[Title/Abstract] OR "omega-3"[Title/Abstract] OR micronutrient*[Title/Abstract] OR "Mediterranean diet"[Title/Abstract] OR "gut-brain"[Title/Abstract])',
  },
  {
    name: 'PFC + Exercise',
    query: '("prefrontal cortex"[Title/Abstract] OR "executive function"[Title/Abstract]) AND (exercise[Title/Abstract] OR "physical activity"[Title/Abstract] OR fitness[Title/Abstract] OR aerobic[Title/Abstract] OR resistance[Title/Abstract] OR "cerebral oxygenation"[Title/Abstract])',
  },
  {
    name: 'PFC + Development',
    query: '("prefrontal cortex"[Title/Abstract] OR "executive function"[Title/Abstract]) AND (development*[Title/Abstract] OR adolescen*[Title/Abstract] OR child*[Title/Abstract] OR aging[Title/Abstract] OR "older adults"[Title/Abstract] OR "developmental trajectory"[Title/Abstract])',
  },
  {
    name: 'PFC + Neuromodulation',
    query: '("prefrontal cortex"[Title/Abstract] OR "DLPFC"[Title/Abstract]) AND (rTMS[Title/Abstract] OR tDCS[Title/Abstract] OR neuromodulation[Title/Abstract] OR "brain stimulation"[Title/Abstract] OR "deep brain stimulation"[Title/Abstract])',
  },
  {
    name: 'PFC + Decision Making',
    query: '("prefrontal cortex"[Title/Abstract]) AND ("decision making"[Title/Abstract] OR "reward processing"[Title/Abstract] OR "delay discounting"[Title/Abstract] OR valuation[Title/Abstract] OR "impulse control"[Title/Abstract])',
  },
];
