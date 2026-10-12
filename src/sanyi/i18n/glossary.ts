// src/sanyi/i18n/glossary.ts
// 中英术语表（设计 6）：纯数据，服务端翻译提示词与浏览器端共用，可进浏览器包。
// 由主管审定；改动任何译名都要递增 GLOSSARY_VERSION，使缓存的译文失效。
export const GLOSSARY_VERSION = 1;

export const ELEMENTS_EN = { 木: "Wood", 火: "Fire", 土: "Earth", 金: "Metal", 水: "Water" } as const;

export const VIRTUES_ZH = {
  木: "木主仁：仁爱上进、生机勃勃",
  火: "火主礼：热情有礼、开朗明快",
  土: "土主信：诚信稳重、宽厚包容",
  金: "金主义：果断重义、坚毅有守",
  水: "水主智：聪慧灵动、善思通达",
} as const;

/** 五德（五常）：起名与五行分析用。 */
export const VIRTUES_EN = {
  木: "Wood stands for benevolence: kind, growing, full of life",
  火: "Fire stands for propriety: warm, courteous, bright",
  土: "Earth stands for trustworthiness: steady, honest, generous",
  金: "Metal stands for righteousness: decisive, loyal, resolute",
  水: "Water stands for wisdom: clever, adaptable, thoughtful",
} as const;

export const TRIGRAMS_EN = {
  乾: { pinyin: "Qian", image: "Heaven" },
  坤: { pinyin: "Kun", image: "Earth" },
  震: { pinyin: "Zhen", image: "Thunder" },
  巽: { pinyin: "Xun", image: "Wind" },
  坎: { pinyin: "Kan", image: "Water" },
  离: { pinyin: "Li", image: "Fire" },
  艮: { pinyin: "Gen", image: "Mountain" },
  兑: { pinyin: "Dui", image: "Lake" },
} as const;

/** 六十四卦：按文王卦序（下标 0 为第 1 卦），拼音与按卦义起的英文标题。 */
export const HEXAGRAMS_EN: ReadonlyArray<{ pinyin: string; title: string }> = [
  { pinyin: "Qian", title: "Creative Force" },
  { pinyin: "Kun", title: "Receptive Earth" },
  { pinyin: "Zhun", title: "Initial Difficulty" },
  { pinyin: "Meng", title: "Youthful Ignorance" },
  { pinyin: "Xu", title: "Waiting" },
  { pinyin: "Song", title: "Conflict" },
  { pinyin: "Shi", title: "The Army" },
  { pinyin: "Bi", title: "Holding Together" },
  { pinyin: "Xiao Chu", title: "Small Restraint" },
  { pinyin: "Lü", title: "Treading Carefully" },
  { pinyin: "Tai", title: "Peace" },
  { pinyin: "Pi", title: "Standstill" },
  { pinyin: "Tong Ren", title: "Fellowship" },
  { pinyin: "Da You", title: "Great Possession" },
  { pinyin: "Qian", title: "Modesty" },
  { pinyin: "Yu", title: "Enthusiasm" },
  { pinyin: "Sui", title: "Following" },
  { pinyin: "Gu", title: "Repairing Decay" },
  { pinyin: "Lin", title: "Approach" },
  { pinyin: "Guan", title: "Contemplation" },
  { pinyin: "Shi He", title: "Biting Through" },
  { pinyin: "Bi", title: "Adornment" },
  { pinyin: "Bo", title: "Stripping Away" },
  { pinyin: "Fu", title: "Return" },
  { pinyin: "Wu Wang", title: "Innocence" },
  { pinyin: "Da Chu", title: "Great Restraint" },
  { pinyin: "Yi", title: "Nourishment" },
  { pinyin: "Da Guo", title: "Great Excess" },
  { pinyin: "Kan", title: "The Abyss" },
  { pinyin: "Li", title: "Radiance" },
  { pinyin: "Xian", title: "Mutual Attraction" },
  { pinyin: "Heng", title: "Endurance" },
  { pinyin: "Dun", title: "Retreat" },
  { pinyin: "Da Zhuang", title: "Great Strength" },
  { pinyin: "Jin", title: "Advance" },
  { pinyin: "Ming Yi", title: "Darkening of the Light" },
  { pinyin: "Jia Ren", title: "The Family" },
  { pinyin: "Kui", title: "Opposition" },
  { pinyin: "Jian", title: "Obstruction" },
  { pinyin: "Xie", title: "Release" },
  { pinyin: "Sun", title: "Decrease" },
  { pinyin: "Yi", title: "Increase" },
  { pinyin: "Guai", title: "Breakthrough" },
  { pinyin: "Gou", title: "Encounter" },
  { pinyin: "Cui", title: "Gathering" },
  { pinyin: "Sheng", title: "Rising" },
  { pinyin: "Kun", title: "Exhaustion" },
  { pinyin: "Jing", title: "The Well" },
  { pinyin: "Ge", title: "Revolution" },
  { pinyin: "Ding", title: "The Cauldron" },
  { pinyin: "Zhen", title: "Thunder" },
  { pinyin: "Gen", title: "Keeping Still" },
  { pinyin: "Jian", title: "Gradual Progress" },
  { pinyin: "Gui Mei", title: "The Marrying Maiden" },
  { pinyin: "Feng", title: "Abundance" },
  { pinyin: "Lü", title: "The Traveler" },
  { pinyin: "Xun", title: "Gentle Wind" },
  { pinyin: "Dui", title: "Joy" },
  { pinyin: "Huan", title: "Dispersal" },
  { pinyin: "Jie", title: "Limitation" },
  { pinyin: "Zhong Fu", title: "Inner Truth" },
  { pinyin: "Xiao Guo", title: "Small Excess" },
  { pinyin: "Ji Ji", title: "After Completion" },
  { pinyin: "Wei Ji", title: "Before Completion" },
];

export const STEMS_EN = {
  甲: "Jia", 乙: "Yi", 丙: "Bing", 丁: "Ding", 戊: "Wu",
  己: "Ji", 庚: "Geng", 辛: "Xin", 壬: "Ren", 癸: "Gui",
} as const;

export const BRANCHES_EN = {
  子: { pinyin: "Zi", animal: "Rat" }, 丑: { pinyin: "Chou", animal: "Ox" },
  寅: { pinyin: "Yin", animal: "Tiger" }, 卯: { pinyin: "Mao", animal: "Rabbit" },
  辰: { pinyin: "Chen", animal: "Dragon" }, 巳: { pinyin: "Si", animal: "Snake" },
  午: { pinyin: "Wu", animal: "Horse" }, 未: { pinyin: "Wei", animal: "Goat" },
  申: { pinyin: "Shen", animal: "Monkey" }, 酉: { pinyin: "You", animal: "Rooster" },
  戌: { pinyin: "Xu", animal: "Dog" }, 亥: { pinyin: "Hai", animal: "Pig" },
} as const;

/** 十神（八字）：通行英译。 */
export const TEN_GODS_EN = {
  比肩: "Friend", 劫财: "Rob Wealth", 食神: "Eating God", 伤官: "Hurting Officer",
  偏财: "Indirect Wealth", 正财: "Direct Wealth", 七杀: "Seven Killings", 正官: "Direct Officer",
  偏印: "Indirect Resource", 正印: "Direct Resource", 日主: "Day Master",
} as const;

/** 六亲（六爻）。 */
export const SIX_RELATIVES_EN = {
  父母: "Parents", 兄弟: "Siblings", 子孙: "Offspring", 妻财: "Wealth", 官鬼: "Officer",
} as const;

/** 六神（六爻）。 */
export const SIX_SPIRITS_EN = {
  青龙: "Azure Dragon", 朱雀: "Vermilion Bird", 勾陈: "Hooked Array",
  螣蛇: "Soaring Serpent", 白虎: "White Tiger", 玄武: "Black Tortoise",
} as const;

export const VERDICTS_EN = {
  大吉: "Very favorable", 吉: "Favorable", 平: "Mixed", 凶: "Unfavorable", 大凶: "Very unfavorable",
} as const;

/** 问事事项（与 QUESTION_SUBJECTS 的 key 对应）。 */
export const SUBJECTS_EN = {
  career: "Career & status",
  wealth: "Money & goods",
  documents: "Property & documents",
  wellbeing: "Skills, healing & peace of mind",
  illness: "Health & illness",
  peers: "Friends, peers & rivals",
  relationship: "Love & partner",
} as const;

/** 三家与起名三家。 */
export const SCHOOLS_EN = {
  chengyi: { name: "Cheng Yi", school: "Philosophical school" },
  jingfang: { name: "Jing Fang", school: "Six-line (Na Jia) school" },
  shaoyong: { name: "Shao Yong", school: "Plum Blossom numerology" },
  shenxiaozhan: { name: "Shen Xiaozhan", school: "Structure school" },
  yuchuntai: { name: "Yu Chuntai", school: "Climate-balance school" },
  rentieqiao: { name: "Ren Tieqiao", school: "Strength-balance school" },
  wuxing: { name: "Five Elements", school: "balancing the chart" },
  shiwen: { name: "Classical Poetry", school: "names from the classics" },
  yinyi: { name: "Sound & Meaning", school: "tone, form and sense" },
} as const;

/** 常用术语：首次出现时写「拼音（释义）」。 */
export const TERMS_EN = {
  用神: { pinyin: "Yong Shen", gloss: "the key element for the question" },
  喜用: { pinyin: "Xi Yong", gloss: "favorable elements" },
  忌神: { pinyin: "Ji Shen", gloss: "unfavorable element" },
  调候: { pinyin: "Tiao Hou", gloss: "climate balance of the chart" },
  日主: { pinyin: "Ri Zhu", gloss: "Day Master, the self in the chart" },
  大运: { pinyin: "Da Yun", gloss: "ten-year luck period" },
  流年: { pinyin: "Liu Nian", gloss: "annual influence" },
  四柱: { pinyin: "Si Zhu", gloss: "Four Pillars of birth" },
  八字: { pinyin: "BaZi", gloss: "Four Pillars of Destiny" },
  卦: { pinyin: "Gua", gloss: "hexagram" },
  爻: { pinyin: "Yao", gloss: "line of a hexagram" },
  动爻: { pinyin: "Dong Yao", gloss: "changing line" },
  世爻: { pinyin: "Shi Yao", gloss: "the self line" },
  应爻: { pinyin: "Ying Yao", gloss: "the other-party line" },
  月建: { pinyin: "Yue Jian", gloss: "month ruler" },
  日辰: { pinyin: "Ri Chen", gloss: "day ruler" },
  旬空: { pinyin: "Xun Kong", gloss: "void branches" },
  应期: { pinyin: "Ying Qi", gloss: "expected timing" },
} as const;
