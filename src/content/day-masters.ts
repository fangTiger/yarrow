import { englishBodyErrors, englishForbiddenErrors } from "../sanyi/english/audit.js";
import { ELEMENTS_EN, STEMS_EN } from "../sanyi/i18n/glossary.js";

export type DayMasterStem = keyof typeof STEMS_EN;
export type DayMasterElement = keyof typeof ELEMENTS_EN;
export type DayMasterYinYang = "yin" | "yang";

export interface DayMasterCopy {
  name: string;
  yinYang: string;
  image: string;
  summary: string;
  keywords: readonly [string, string, string];
  strengths: readonly [string, string];
  watch: readonly [string, string];
}

export interface DayMasterProfile {
  stem: DayMasterStem;
  element: DayMasterElement;
  yinYang: DayMasterYinYang;
  slug: string;
  zh: DayMasterCopy;
  en: DayMasterCopy;
}

export const DAY_MASTERS: readonly DayMasterProfile[] = [
  {
    stem: "甲", element: "木", yinYang: "yang", slug: "jia-wood",
    zh: {
      name: "甲木", yinYang: "阳", image: "挺拔的大树",
      summary: "甲木像向上生长的大树，重视方向、原则与长期积累。你往往愿意先立框架再行动，对伙伴有担当，也能在压力下保持主心骨；若目标太紧，偶尔会显得固执，不妨给变化和他人意见留些空间。",
      keywords: ["正直", "成长", "担当"],
      strengths: ["能为长期目标持续投入", "面对复杂局面敢于承担"],
      watch: ["别把坚持变成僵硬", "适时听取不同做法"],
    },
    en: {
      name: "Jia Wood", yinYang: "Yang", image: "a tall, rooted tree",
      summary: "Jia Wood resembles a tall tree growing toward the light. You may value direction, principles, and steady progress, often creating a framework before taking action. Others can experience you as dependable and willing to carry responsibility. When a goal becomes too fixed, leaving room for change and different viewpoints can keep that strength flexible.",
      keywords: ["upright", "growing", "responsible"],
      strengths: ["Sustains effort toward long goals", "Takes responsibility in complex situations"],
      watch: ["Keep persistence from becoming rigidity", "Make room for different approaches"],
    },
  },
  {
    stem: "乙", element: "木", yinYang: "yin", slug: "yi-wood",
    zh: {
      name: "乙木", yinYang: "阴", image: "藤蔓与花草",
      summary: "乙木像藤蔓与花草，善于观察环境，也懂得借力生长。你通常细腻、有弹性，能把人与资源柔和地连接起来；面对选择时可能顾虑较多，或为了维持和气绕得太远，清楚表达自己的边界会更从容。",
      keywords: ["灵活", "细腻", "连接"],
      strengths: ["能察觉细微变化与关系", "善用有限条件找到路径"],
      watch: ["避免因顾虑过多而迟疑", "温和表达也要保留边界"],
    },
    en: {
      name: "Yi Wood", yinYang: "Yin", image: "vines and flowering plants",
      summary: "Yi Wood is like a vine or flowering plant that responds closely to its surroundings. You may notice subtle shifts, adapt with tact, and connect people or resources without forcing the process. Too many considerations can sometimes delay a choice. Clear boundaries and direct words help your natural flexibility remain purposeful rather than overly accommodating.",
      keywords: ["adaptable", "perceptive", "connecting"],
      strengths: ["Notices subtle changes in people and context", "Finds workable paths with limited resources"],
      watch: ["Do not let caution delay every choice", "Pair tact with clear boundaries"],
    },
  },
  {
    stem: "丙", element: "火", yinYang: "yang", slug: "bing-fire",
    zh: {
      name: "丙火", yinYang: "阳", image: "明亮的太阳",
      summary: "丙火像照亮四方的太阳，重视坦率、热情与共同方向。你常能主动带动气氛，把复杂事情讲得清楚，也愿意让成果被大家看见；忙起来可能过度投入或忽略细节，留出停顿能让光与热更持久。",
      keywords: ["热情", "坦率", "带动"],
      strengths: ["能鼓舞团队并明确方向", "表达直接而富有感染力"],
      watch: ["热情之外也照顾细节", "避免一直处在高强度状态"],
    },
    en: {
      name: "Bing Fire", yinYang: "Yang", image: "the bright sun",
      summary: "Bing Fire resembles the sun, visible, warm, and generous with its light. You may bring energy to a group, explain complicated matters clearly, and help others see a shared direction. Strong enthusiasm can also lead to overextension or missed details. Regular pauses allow your warmth to stay useful without consuming all of your attention.",
      keywords: ["warm", "direct", "energizing"],
      strengths: ["Builds momentum around a shared direction", "Communicates with clarity and warmth"],
      watch: ["Balance enthusiasm with attention to detail", "Leave recovery time between intense efforts"],
    },
  },
  {
    stem: "丁", element: "火", yinYang: "yin", slug: "ding-fire",
    zh: {
      name: "丁火", yinYang: "阴", image: "灯火与烛光",
      summary: "丁火像夜里的灯火，光线集中，重视细节、感受与持续照料。你常能看见别人忽略之处，用耐心让想法逐渐成形，也擅长营造温暖氛围；情绪紧绷时容易反复思量，适度说出需求会更轻松。",
      keywords: ["专注", "体察", "温暖"],
      strengths: ["能长期照料细致工作", "敏锐捕捉氛围与需求"],
      watch: ["避免把担心留在心里反复", "别因追求完善而消耗过多"],
    },
    en: {
      name: "Ding Fire", yinYang: "Yin", image: "lamplight and candlelight",
      summary: "Ding Fire is like a lamp in the evening, focused enough to reveal what broad daylight may miss. You may work patiently with detail, sense the mood around you, and give an idea sustained care. Under pressure, thoughtfulness can turn into repeated worry. Naming your needs early helps preserve both concentration and warmth.",
      keywords: ["focused", "attentive", "warm"],
      strengths: ["Gives patient care to detailed work", "Reads atmosphere and unspoken needs"],
      watch: ["Speak before concerns begin to circle", "Do not spend all your energy on perfection"],
    },
  },
  {
    stem: "戊", element: "土", yinYang: "yang", slug: "wu-earth",
    zh: {
      name: "戊土", yinYang: "阳", image: "山岭与厚土",
      summary: "戊土像稳固的山岭，重视可靠、秩序与承诺。你往往能承接压力，为团队提供稳定基础，也习惯先评估再推进；变化突然时可能需要较久适应，若能把大目标拆成小步，稳健就不会变成停滞。",
      keywords: ["稳重", "可靠", "承载"],
      strengths: ["在压力下保持稳定节奏", "善于建立可依靠的结构"],
      watch: ["给新变化一个试行机会", "别独自承担所有责任"],
    },
    en: {
      name: "Wu Earth", yinYang: "Yang", image: "mountains and solid ground",
      summary: "Wu Earth resembles a mountain, steady enough to support people through changing weather. You may value reliability, order, and commitments, preferring to assess conditions before moving. Sudden change can take time to absorb, and responsibility may collect around you. Breaking a large goal into smaller experiments keeps steadiness from becoming immobility.",
      keywords: ["steady", "reliable", "supportive"],
      strengths: ["Maintains a dependable pace under pressure", "Builds structures others can rely on"],
      watch: ["Give unfamiliar changes a fair trial", "Share responsibility before it becomes too heavy"],
    },
  },
  {
    stem: "己", element: "土", yinYang: "yin", slug: "ji-earth",
    zh: {
      name: "己土", yinYang: "阴", image: "耕作的田园",
      summary: "己土像经过耕作的田园，讲究实际、养护与细水长流。你常能整理零散信息，照顾流程，让人和事情各得其所；因为在意周全，偶尔会接下太多琐事，分清优先级并及时求助会更有效率。",
      keywords: ["务实", "养成", "周全"],
      strengths: ["能把零散内容整理成系统", "耐心支持人与计划成长"],
      watch: ["不要把每件琐事都揽下", "先确定优先级再投入"],
    },
    en: {
      name: "Ji Earth", yinYang: "Yin", image: "cultivated fields",
      summary: "Ji Earth is like cultivated soil, practical, responsive, and improved through regular care. You may organize scattered information, maintain useful routines, and help people or projects develop at a realistic pace. Because completeness matters to you, small duties can accumulate quietly. Clear priorities and timely requests for help protect your patient, constructive approach.",
      keywords: ["practical", "nurturing", "thorough"],
      strengths: ["Organizes scattered details into a useful system", "Supports gradual development with patience"],
      watch: ["Do not absorb every small duty", "Set priorities before giving time away"],
    },
  },
  {
    stem: "庚", element: "金", yinYang: "yang", slug: "geng-metal",
    zh: {
      name: "庚金", yinYang: "阳", image: "矿石与利器",
      summary: "庚金像未经打磨的矿石与利器，重视效率、判断与行动。你通常敢于面对难题，能迅速抓住关键，也愿意推动必要的改变；表达过快时可能显得锋利，先说明目的并听完回应，会让果断更有分寸。",
      keywords: ["果断", "坚毅", "革新"],
      strengths: ["遇到难题能够直面核心", "推动决定落地而不拖延"],
      watch: ["直接表达时照顾他人节奏", "行动前确认信息是否完整"],
    },
    en: {
      name: "Geng Metal", yinYang: "Yang", image: "ore and a tempered blade",
      summary: "Geng Metal resembles ore shaped into a strong tool. You may approach difficult matters directly, identify the central issue quickly, and push necessary change into action. Speed and firmness are useful, though they can sound sharper than intended. Explaining your purpose and hearing the full response gives decisiveness greater precision and trust.",
      keywords: ["decisive", "resilient", "reforming"],
      strengths: ["Faces difficult issues at their core", "Turns necessary decisions into action"],
      watch: ["Match direct words to another person's pace", "Check that key information is complete"],
    },
  },
  {
    stem: "辛", element: "金", yinYang: "yin", slug: "xin-metal",
    zh: {
      name: "辛金", yinYang: "阴", image: "珠玉与精工",
      summary: "辛金像经过琢磨的珠玉，重视品质、边界与准确表达。你常有细致判断，能发现差异，并把成果修整得清楚得体；标准较高时容易对自己或他人挑剔，区分关键品质与无关细节会更自在。",
      keywords: ["精确", "审美", "分寸"],
      strengths: ["能辨别细微差异与品质", "善于把表达修整得清楚"],
      watch: ["避免用过高标准苛责自己", "分清重要品质和次要细节"],
    },
    en: {
      name: "Xin Metal", yinYang: "Yin", image: "polished metal and fine jewelry",
      summary: "Xin Metal is like a carefully polished object, defined by precision, finish, and clear edges. You may notice fine distinctions, refine how something is presented, and protect standards that matter. High expectations can sometimes become exacting toward yourself or others. Separating essential quality from minor detail makes discernment easier to share.",
      keywords: ["precise", "refined", "discerning"],
      strengths: ["Recognizes fine differences in quality", "Refines ideas into clear presentation"],
      watch: ["Keep high standards humane and proportionate", "Separate essential quality from minor detail"],
    },
  },
  {
    stem: "壬", element: "水", yinYang: "yang", slug: "ren-water",
    zh: {
      name: "壬水", yinYang: "阳", image: "江河与海洋",
      summary: "壬水像奔流的江河与海洋，重视空间、见识与自由流动。你往往好奇心强，能连接不同领域，在变化中迅速寻找新路线；选择太多时容易分散，给阶段目标设定岸线，能让广阔视野真正形成成果。",
      keywords: ["开阔", "机动", "探索"],
      strengths: ["能跨领域连接信息与资源", "面对变化快速寻找出口"],
      watch: ["别让太多可能分散精力", "为每个阶段设定清楚边界"],
    },
    en: {
      name: "Ren Water", yinYang: "Yang", image: "rivers and the open sea",
      summary: "Ren Water resembles a river moving toward the sea, broad, curious, and responsive to changing terrain. You may connect ideas across fields, explore unfamiliar routes, and recover momentum when conditions shift. Many possibilities can also scatter attention. Giving each stage a clear bank or destination helps your wide perspective produce concrete results.",
      keywords: ["expansive", "mobile", "exploratory"],
      strengths: ["Connects information across different fields", "Finds new routes when conditions change"],
      watch: ["Do not let possibilities fragment attention", "Give each phase a defined destination"],
    },
  },
  {
    stem: "癸", element: "水", yinYang: "yin", slug: "gui-water",
    zh: {
      name: "癸水", yinYang: "阴", image: "雨露与清泉",
      summary: "癸水像细雨、露珠与清泉，善于感受细微变化，也愿意安静地滋养事物。你通常思路灵活，观察入微，能在不显眼处找到线索；信息过多时可能犹豫或内耗，及时整理重点会更安心。",
      keywords: ["敏锐", "灵动", "滋养"],
      strengths: ["能从细节中发现重要线索", "以柔和方式适应环境变化"],
      watch: ["避免在过多信息里反复", "把感受整理成明确下一步"],
    },
    en: {
      name: "Gui Water", yinYang: "Yin", image: "rain and dew",
      summary: "Gui Water is like rain, dew, or a clear spring, subtle enough to reach places that stronger currents pass by. You may observe fine changes, think flexibly, and support growth without demanding attention. When too much information gathers, sensitivity can become hesitation. Sorting signals into one practical next step brings calm and direction.",
      keywords: ["perceptive", "fluid", "nurturing"],
      strengths: ["Finds meaningful clues in small details", "Adapts gently as the environment changes"],
      watch: ["Avoid circling through too many signals", "Turn impressions into one clear next step"],
    },
  },
];

const EXPECTED_STEMS = [..."甲乙丙丁戊己庚辛壬癸"] as DayMasterStem[];

export function validateDayMasters(values: readonly DayMasterProfile[]): string[] {
  const errors: string[] = [];
  if (values.length !== 10) errors.push(`日主短介绍应有 10 条，实际 ${values.length} 条`);
  const stems = new Set(values.map((item) => item.stem));
  for (const stem of EXPECTED_STEMS) {
    if (!stems.has(stem)) errors.push(`缺少 ${stem} 日主短介绍`);
  }
  if (new Set(values.map((item) => item.slug)).size !== values.length) errors.push("日主 slug 不得重复");
  for (const item of values) {
    const label = `${item.stem}日主`;
    const stemIndex = EXPECTED_STEMS.indexOf(item.stem);
    const expectedEnglishName = `${STEMS_EN[item.stem]} ${ELEMENTS_EN[item.element]}`;
    const expectedYinYang = stemIndex % 2 === 0 ? "yang" : "yin";
    if (item.zh.name !== `${item.stem}${item.element}` || item.en.name !== expectedEnglishName) {
      errors.push(`${label}名称须使用统一天干与五行术语`);
    }
    if (stemIndex >= 0 && item.yinYang !== expectedYinYang) errors.push(`${label}阴阳属性不正确`);
    if (item.en.yinYang.toLowerCase() !== item.yinYang) errors.push(`${label}英文阴阳名称不正确`);
    const chineseCount = [...item.zh.summary].length;
    const englishCount = item.en.summary.trim().split(/\s+/u).filter(Boolean).length;
    if (chineseCount < 60 || chineseCount > 90) errors.push(`${label}中文概述须为 60–90 字`);
    if (englishCount < 40 || englishCount > 70) errors.push(`${label}英文概述须为 40–70 词`);
    if (item.zh.keywords.length !== 3 || item.en.keywords.length !== 3) errors.push(`${label}须有 3 个关键词`);
    if (item.zh.strengths.length !== 2 || item.en.strengths.length !== 2
      || item.zh.watch.length !== 2 || item.en.watch.length !== 2) {
      errors.push(`${label}优势与留意各须有 2 条`);
    }
    const english = [item.en.name, item.en.yinYang, item.en.image, item.en.summary,
      ...item.en.keywords, ...item.en.strengths, ...item.en.watch].join("\n");
    errors.push(...englishBodyErrors([english]).map((error) => `${label}：${error}`));
    errors.push(...englishForbiddenErrors(english).map((error) => `${label}：${error}`));
  }
  return errors;
}

const BY_STEM = new Map(DAY_MASTERS.map((item) => [item.stem, item]));
const BY_SLUG = new Map(DAY_MASTERS.map((item) => [item.slug, item]));

export function dayMasterByStem(stem: string): DayMasterProfile {
  const value = BY_STEM.get(stem as DayMasterStem);
  if (!value) throw new Error(`未知日主天干：${stem}`);
  return value;
}

export function dayMasterBySlug(slug: string): DayMasterProfile {
  const value = BY_SLUG.get(slug);
  if (!value) throw new Error(`未知日主 slug：${slug}`);
  return value;
}
