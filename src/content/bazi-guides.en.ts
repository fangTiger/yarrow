import { englishBodyErrors, englishForbiddenErrors } from "../sanyi/english/audit.js";
import { ELEMENTS_EN, STEMS_EN, TEN_GODS_EN } from "../sanyi/i18n/glossary.js";
import { DAY_MASTERS, type DayMasterElement, type DayMasterStem,
  type DayMasterYinYang } from "./day-masters.js";

export interface DayMasterGuideEn {
  stem: DayMasterStem;
  element: DayMasterElement;
  yinYang: DayMasterYinYang;
  slug: string;
  name: string;
  image: string;
  tagline: string;
  guide: string;
  points: readonly [string, string, string];
}

type TenGodKey = Exclude<keyof typeof TEN_GODS_EN, "日主">;
export type TenGodRelationGroup = "peer" | "output" | "wealth" | "officer" | "resource";

export interface TenGodGuideEn {
  key: TenGodKey;
  name: string;
  slug: string;
  relationGroup: TenGodRelationGroup;
  relation: string;
  tagline: string;
  guide: string;
  points: readonly [string, string, string];
}

export const DAY_MASTER_GUIDES_EN: readonly DayMasterGuideEn[] = [
  {
    stem: "甲", element: "木", yinYang: "yang", slug: "jia-wood", name: "Jia Wood",
    image: "a tall, rooted tree", tagline: "A tall tree that grows upward with direction and steady purpose.",
    guide: "Jia Wood uses the image of a tall, rooted tree: upright, growing, and willing to hold a clear direction. People with this Day Master often approach relationships through loyalty and responsibility. At work, they may prefer a sound framework, a long horizon, and progress that can be built step by step. Their direct principles can steady a group, although firmness may become rigidity when plans change. Traditional discussions of what supports or challenges Jia Wood are really questions of balance: does the whole chart need more nourishment, warmth, structure, or room to branch? No element is automatically helpful in every chart. Your Day Master is best treated as a starting metaphor, not a fixed personality verdict. Notice when persistence helps you grow, when it limits adaptation, and how other parts of the chart modify the picture.",
    points: ["Builds patiently toward long goals", "Often offers dependable structure to others", "Benefits from pairing principles with flexibility"],
  },
  {
    stem: "乙", element: "木", yinYang: "yin", slug: "yi-wood", name: "Yi Wood",
    image: "vines and flowering plants", tagline: "A vine or flowering plant that adapts while continuing to grow.",
    guide: "Yi Wood is pictured as vines, grasses, and flowering plants that respond closely to their setting. This Day Master often suggests tact, perception, and the ability to connect people or resources without using force. In relationships, Yi Wood may read subtle signals and preserve cooperation; at work, it can find a path through limited conditions and refine an idea gradually. Adaptability can become hesitation or excessive accommodation when too many viewpoints compete. Traditional ideas about supportive and challenging influences ask what the complete chart needs: perhaps roots, sunlight, space, pruning, or movement. The same element can help in one structure and crowd another. Use Yi Wood as a language for reflection rather than a label. Your choices, experience, and the rest of the chart matter more than any single stem, so keep the image flexible and practical.",
    points: ["Connects people and resources with tact", "Notices small changes in context", "Grows best with clear boundaries"],
  },
  {
    stem: "丙", element: "火", yinYang: "yang", slug: "bing-fire", name: "Bing Fire",
    image: "the bright sun", tagline: "Bright sunlight that makes direction and activity visible.",
    guide: "Bing Fire takes its image from the sun: bright, open, and able to illuminate a wide field. This Day Master often describes enthusiasm, candor, and a wish to give people a shared direction. In relationships, warmth and visible encouragement may come naturally. At work, Bing Fire can explain complex matters clearly, energize a group, and bring projects into public view. Constant output, however, may leave too little time for listening or recovery, while certainty can overlook quieter details. Traditional talk about helpful or difficult elements concerns the balance of the full chart, such as whether its fire needs fuel, moderation, focus, or space. It is never a universal list. Think of Bing Fire as one lens on your style, not a promise about behavior. Observe when visibility serves the situation and when a softer, more selective light would be wiser.",
    points: ["Makes purpose visible and understandable", "Often lifts the energy of a group", "Needs room for listening and recovery"],
  },
  {
    stem: "丁", element: "火", yinYang: "yin", slug: "ding-fire", name: "Ding Fire",
    image: "lamplight and candlelight", tagline: "Focused lamplight that reveals detail and sustains warmth.",
    guide: "Ding Fire is compared with lamplight or a candle: concentrated, attentive, and able to reveal details that broad daylight misses. In relationships, this Day Master may show care through observation, thoughtful timing, and a warm private atmosphere. At work, Ding Fire often suits patient craft, editing, research, or any task that develops through sustained attention. Sensitivity can also turn into repeated worry, perfectionism, or needs left unspoken. Traditional discussions of support and challenge look at the whole chart: a small flame may need fuel and shelter, while an intense pattern may need pacing or clearer limits. These are contextual images, not permanent rules. Treat Ding Fire as an invitation to notice how you focus and care. Other stems, branches, and lived experience can change the expression substantially, so the Day Master should open questions rather than close them.",
    points: ["Sustains careful attention over time", "Reads atmosphere and unspoken needs", "Works better when concerns are voiced early"],
  },
  {
    stem: "戊", element: "土", yinYang: "yang", slug: "wu-earth", name: "Wu Earth",
    image: "mountains and solid ground", tagline: "A mountain that offers scale, stability, and dependable ground.",
    guide: "Wu Earth uses the image of mountains and solid ground. It often points to steadiness, perspective, and a willingness to carry responsibility. In relationships, people may experience this style as dependable and protective, though also slow to reveal change. At work, Wu Earth can hold a long process together, assess risk calmly, and create structures others rely on. When stability becomes the only priority, adjustment may feel harder than it needs to be, and duties can accumulate silently. Traditional ideas about supportive or challenging elements ask whether the complete chart needs more consolidation, movement, warmth, moisture, or growth. There is no single element that always benefits Wu Earth. Use the mountain image to examine your pace and commitments, not to define your future. Small experiments, shared responsibility, and the rest of the chart all show how this steady quality can remain responsive.",
    points: ["Provides dependable ground under pressure", "Sees projects in a longer perspective", "Stays responsive through small experiments"],
  },
  {
    stem: "己", element: "土", yinYang: "yin", slug: "ji-earth", name: "Ji Earth",
    image: "cultivated fields", tagline: "Cultivated soil that turns regular care into useful growth.",
    guide: "Ji Earth is represented by cultivated soil: practical, receptive, and shaped through regular care. In relationships, this Day Master may support others through useful details, continuity, and a quiet awareness of what is needed. At work, Ji Earth often organizes scattered material, maintains routines, and helps people or projects develop at a realistic pace. Thoroughness can become overextension when every small task feels personally important, or caution can keep priorities unclear. Traditional support and challenge language refers to the needs of the entire chart, much as soil may need warmth, water, rest, or boundaries depending on its condition. No fixed recipe applies to everyone. Consider Ji Earth a reflective image rather than a narrow type. Pay attention to what you choose to cultivate, what should be delegated, and how the other chart components alter your natural preference for patient improvement.",
    points: ["Organizes details into workable systems", "Supports gradual development with patience", "Needs priorities that protect time and energy"],
  },
  {
    stem: "庚", element: "金", yinYang: "yang", slug: "geng-metal", name: "Geng Metal",
    image: "ore and a tempered blade", tagline: "Strong metal shaped into a tool for decisive, useful action.",
    guide: "Geng Metal is imagined as ore, strong tools, or a tempered blade. It often conveys decisiveness, endurance, and readiness to address a difficult issue directly. In relationships, this can appear as honest protection and clear action, while hurried words may sound sharper than intended. At work, Geng Metal tends to identify the central problem, remove obstacles, and move a necessary decision forward. Strength without enough context can become bluntness, impatience, or change pursued for its own sake. Traditional views of supportive and challenging influences examine the complete chart: metal may need shaping, cooling, warmth, or a productive task depending on the pattern. Such images are conditional, not commands. Use Geng Metal to study how you apply resolve. Listening fully, explaining purpose, and considering other chart factors give decisive energy greater precision and trust.",
    points: ["Faces difficult issues without avoiding them", "Turns decisions into concrete action", "Gains precision by listening before cutting through"],
  },
  {
    stem: "辛", element: "金", yinYang: "yin", slug: "xin-metal", name: "Xin Metal",
    image: "polished metal and fine jewelry", tagline: "Polished metal that values exact form, quality, and clear edges.",
    guide: "Xin Metal is associated with polished metal, fine instruments, and jewelry whose value appears through careful finishing. This Day Master often suggests discernment, precision, and respect for clear boundaries. In relationships, Xin Metal may notice tone and quality quickly, providing thoughtful refinement but sometimes holding standards too tightly. At work, it can edit, compare, design, and present complex material with elegance and accuracy. Exactness may become self-criticism or excessive attention to minor flaws. Traditional ideas of support and challenge depend on the entire chart: refinement can require pressure, warmth, cleansing, or protection in different combinations. None is automatically best. Think of Xin Metal as a vocabulary for examining your standards rather than a fixed identity. Distinguishing essential quality from optional polish allows this careful perception to remain humane, useful, and open to the chart's wider context.",
    points: ["Recognizes fine differences in quality", "Refines ideas into clear presentation", "Thrives when standards remain proportionate"],
  },
  {
    stem: "壬", element: "水", yinYang: "yang", slug: "ren-water", name: "Ren Water",
    image: "rivers and the open sea", tagline: "A broad river that connects places and keeps moving through change.",
    guide: "Ren Water takes the image of rivers and the open sea: broad, mobile, and able to connect distant places. In relationships, this Day Master may bring curiosity, spaciousness, and an ease with different kinds of people. At work, Ren Water often gathers information across fields, explores unfamiliar routes, and adapts quickly when conditions shift. Too many open channels can scatter attention, while freedom without banks may make completion difficult. Traditional interpretations of support and challenge consider the chart as a whole, asking whether the water needs a source, boundaries, warmth, direction, or release. The answer changes with the structure. Use Ren Water as a metaphor for your movement, not a forecast. Clear destinations and chosen limits can help wide perspective become concrete work, while other parts of the chart show where flow is naturally concentrated or moderated.",
    points: ["Connects ideas across different fields", "Finds alternate routes when conditions shift", "Turns breadth into results through chosen boundaries"],
  },
  {
    stem: "癸", element: "水", yinYang: "yin", slug: "gui-water", name: "Gui Water",
    image: "rain and dew", tagline: "Fine rain and dew that reach quietly into subtle places.",
    guide: "Gui Water is pictured as rain, dew, mist, or a clear spring: subtle forms of water that reach places a stronger current may pass by. In relationships, this Day Master often suggests sensitivity to small changes and a gentle way of supporting growth. At work, Gui Water can gather quiet clues, think flexibly, and adapt without demanding attention. When signals multiply, perception may become hesitation, private worry, or difficulty choosing one next step. Traditional language about supportive and challenging elements describes the balance of the whole chart, asking whether this water needs a source, warmth, containment, movement, or time to settle. There is no universal answer. Regard Gui Water as a reflective image, not a hidden verdict about you. Sorting impressions into clear priorities lets sensitivity become practical insight, while the rest of the chart supplies important context and contrast.",
    points: ["Finds meaning in subtle details", "Adapts gently to changing conditions", "Benefits from turning impressions into one next step"],
  },
];

export const TEN_GOD_GUIDES_EN: readonly TenGodGuideEn[] = [
  {
    key: "比肩", name: "Friend", slug: "friend", relationGroup: "peer",
    relation: "Same element and same polarity as the Day Master",
    tagline: "The peer relationship of shared element and matching polarity.",
    guide: "Friend is the same element and the same yin or yang polarity as the Day Master. It represents peers, siblings, colleagues, self-direction, and the part of a person that meets the world on equal terms. In a chart, Friend can describe independence, solidarity, healthy comparison, or competition for the same space and resources. A strong concentration may emphasize autonomy and firm opinions, but it can also make cooperation or compromise require more attention. Very little Friend may be read as less reliance on peers or a weaker emphasis on asserting sameness, not as a defect. The useful question is how this relationship works with the rest of the chart. Ten Gods are relative roles produced from element and polarity; they describe patterns to examine rather than people or events that must appear.",
    points: ["Peers and equal relationships", "Independence and self-definition", "Cooperation versus competition"],
  },
  {
    key: "劫财", name: "Rob Wealth", slug: "rob-wealth", relationGroup: "peer",
    relation: "Same element and opposite polarity to the Day Master",
    tagline: "The peer relationship of shared element and complementary polarity.",
    guide: "Rob Wealth shares the Day Master's element but has the opposite yin or yang polarity. The traditional name is vivid, yet the role is broader than loss: it concerns peers, networks, initiative, shared resources, rivalry, and the pressure to act among equals. In a chart, it can show social drive, bold collaboration, or willingness to take a chance with others. When heavily emphasized, boundaries around time, credit, or resources may need care; when scarce, collective momentum or competitive engagement may be less central. Neither condition has one automatic outcome. Interpretation depends on the full pattern and on actual choices. Rob Wealth is best understood as a relationship category created by element and polarity, not as a prediction that someone will take money or that a particular event must occur.",
    points: ["Networks and active peers", "Shared resources and clear boundaries", "Bold cooperation without automatic loss"],
  },
  {
    key: "食神", name: "Eating God", slug: "eating-god", relationGroup: "output",
    relation: "Produced by the Day Master with the same polarity",
    tagline: "Steady output created through matching polarity.",
    guide: "Eating God is an element produced by the Day Master with the same yin or yang polarity. It belongs to the output group and commonly represents expression, craft, teaching, enjoyment, creativity, and the ability to turn inner capacity into something others can use. In a chart, it may describe a measured, sustained style of producing, explaining, or caring for quality. Too much emphasis can diffuse effort into comfort, many interests, or output without enough structure. Very little may suggest that visible expression is not the chart's main route, rather than an absence of creativity. The complete chart shows whether output supports balance or consumes too much energy. Eating God is a technical relationship name; it is not a deity or a promise of ease, talent, or any fixed life result.",
    points: ["Creative and practical output", "Teaching, craft, and enjoyment", "Expression balanced with structure"],
  },
  {
    key: "伤官", name: "Hurting Officer", slug: "hurting-officer", relationGroup: "output",
    relation: "Produced by the Day Master with opposite polarity",
    tagline: "Expressive output created through complementary polarity.",
    guide: "Hurting Officer is an element produced by the Day Master with the opposite yin or yang polarity. It represents a more contrasting form of output: critique, performance, invention, persuasive speech, and the urge to question established standards. In a chart, it can describe sharp observation and an ability to expose what is inefficient or unconvincing. When overemphasized, expression may outrun tact, patience, or respect for necessary structure. When limited, open challenge and public self-expression may simply play a smaller role. Its traditional name does not mean that authority will literally be harmed. Meaning comes from the full chart, including how output relates to resource and officer roles. Treat Hurting Officer as a pattern of expressive tension and originality, not a sentence about conflict, status, or character.",
    points: ["Critique and original expression", "Performance and persuasive speech", "Candor balanced with timing and structure"],
  },
  {
    key: "偏财", name: "Indirect Wealth", slug: "indirect-wealth", relationGroup: "wealth",
    relation: "Controlled by the Day Master with the same polarity",
    tagline: "Resources managed through matching polarity and wider opportunity.",
    guide: "Indirect Wealth is an element controlled by the Day Master with the same yin or yang polarity. The wealth group concerns resources, exchange, practical responsibility, and what a person can organize or direct. The indirect form is often associated with wider networks, opportunities, responsiveness, generosity, and resources that move beyond a fixed routine. Strong emphasis can bring active engagement with people and possibilities, while also requiring clear limits so attention and resources are not spread too widely. A small presence may mean this flexible resource role is less central, not that prosperity is absent. The full chart determines whether control is easy, demanding, supportive, or distracting. Indirect Wealth does not guarantee money or recommend financial action; it is a symbolic relationship used to discuss how effort meets movable resources.",
    points: ["Flexible resources and wider networks", "Opportunity joined to practical judgment", "Generosity supported by clear limits"],
  },
  {
    key: "正财", name: "Direct Wealth", slug: "direct-wealth", relationGroup: "wealth",
    relation: "Controlled by the Day Master with opposite polarity",
    tagline: "Resources managed through complementary polarity and steady responsibility.",
    guide: "Direct Wealth is an element controlled by the Day Master with the opposite yin or yang polarity. It commonly represents tangible resources, routine responsibilities, budgeting, consistency, and attention to what can be maintained over time. In a chart, this role may favor practical follow-through and a clear exchange between effort and result. If heavily emphasized, security and measurable duties can crowd out rest, experimentation, or less visible values. If scarce, fixed routines and direct resource management may be less prominent, without implying irresponsibility or lack. The whole chart shows whether this role stabilizes the pattern or adds pressure. Direct Wealth is not a forecast of income and does not provide financial guidance. It is a relative BaZi category for examining how the Day Master handles concrete obligations and usable resources.",
    points: ["Tangible resources and routine duties", "Consistency between effort and result", "Security balanced with flexibility"],
  },
  {
    key: "七杀", name: "Seven Killings", slug: "seven-killings", relationGroup: "officer",
    relation: "Controls the Day Master with the same polarity",
    tagline: "Direct pressure and challenge formed by matching polarity.",
    guide: "Seven Killings is an element that controls the Day Master with the same yin or yang polarity. Despite its dramatic traditional name, it represents concentrated pressure, challenge, competition, urgency, and encounters with demanding standards. In a chart, it can describe courage under pressure, fast decisions, disciplined response, or situations that require clear boundaries. Too much may feel relentless or reactive unless other parts of the chart provide support and direction. Very little may mean forceful challenge is not a dominant organizing theme. It does not predict violence, danger, or an enemy. Interpretation depends on the entire structure and on how the person responds in real life. Seven Killings is most useful as a symbol for the relationship between agency and pressure, including the possibility of turning intensity into focused responsibility.",
    points: ["Pressure, challenge, and fast response", "Courage supported by discipline", "Intensity directed through clear boundaries"],
  },
  {
    key: "正官", name: "Direct Officer", slug: "direct-officer", relationGroup: "officer",
    relation: "Controls the Day Master with opposite polarity",
    tagline: "Order and accountability formed by complementary polarity.",
    guide: "Direct Officer is an element that controls the Day Master with the opposite yin or yang polarity. It represents rules, accountability, role clarity, public standards, and the kind of structure that coordinates individual action with a larger system. In a chart, it may describe reliability, respect for process, or comfort with defined responsibility. When strongly emphasized, duty and approval can become restrictive, perfectionistic, or overly dependent on external standards. When limited, formal hierarchy may be less central to motivation, not automatically rejected. The surrounding chart shows whether structure protects, guides, or presses too hard. Direct Officer does not guarantee rank or a particular career. It is a relational symbol for how a person meets order and expectation, always interpreted alongside lived circumstances and the other Nine Gods.",
    points: ["Rules, roles, and public standards", "Reliability through defined responsibility", "Duty balanced with independent judgment"],
  },
  {
    key: "偏印", name: "Indirect Resource", slug: "indirect-resource", relationGroup: "resource",
    relation: "Produces the Day Master with the same polarity",
    tagline: "Support and learning received through matching polarity.",
    guide: "Indirect Resource is an element that produces the Day Master with the same yin or yang polarity. Resource roles concern support, learning, memory, interpretation, and what replenishes the self. The indirect form often points to unconventional study, intuition, private research, specialized interests, or help that arrives through less standard channels. Strong emphasis can deepen insight and originality, while also encouraging withdrawal, overthinking, or learning that never becomes action. A small presence may simply mean that this inward and specialized mode is not the chart's main source of support. The whole pattern shows whether resource nourishes the Day Master or slows its output. Indirect Resource does not certify intuition or hidden knowledge; it names a symbolic relationship between receiving, understanding, and becoming ready to act.",
    points: ["Unconventional learning and private research", "Interpretation, memory, and inward support", "Insight completed through practical action"],
  },
  {
    key: "正印", name: "Direct Resource", slug: "direct-resource", relationGroup: "resource",
    relation: "Produces the Day Master with opposite polarity",
    tagline: "Support and learning received through complementary polarity.",
    guide: "Direct Resource is an element that produces the Day Master with the opposite yin or yang polarity. It commonly represents education, care, reliable support, memory, tradition, and the ability to absorb a framework before acting. In a chart, it may show patience with study, trust in established knowledge, or a need for secure foundations. If heavily emphasized, preparation can become dependence, caution, or continued study without expression. If scarce, formal support and conventional learning may be less prominent, not unavailable. Meaning changes according to the complete chart and the balance between receiving and producing. Direct Resource does not promise protection or credentials. It is a relative role that helps describe how a person takes in guidance, restores capacity, and turns inherited or learned material into their own understanding.",
    points: ["Education, care, and reliable support", "Learning through established frameworks", "Preparation balanced with expression"],
  },
];

const EXPECTED_TEN_GODS = Object.keys(TEN_GODS_EN)
  .filter((key): key is TenGodKey => key !== "日主");

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function validateEnglish(label: string, values: readonly string[]): string[] {
  const text = values.join("\n");
  return [
    ...englishBodyErrors([text]).map((error) => `${label}：${error}`),
    ...englishForbiddenErrors(text).map((error) => `${label}：${error}`),
  ];
}

export function validateBaziGuides(
  dayMasters: readonly DayMasterGuideEn[],
  tenGods: readonly TenGodGuideEn[],
): string[] {
  const errors: string[] = [];
  if (dayMasters.length !== 10) errors.push(`英文导读应有 10 条日主，实际 ${dayMasters.length} 条`);
  if (tenGods.length !== 10) errors.push(`英文导读应有 10 条十神，实际 ${tenGods.length} 条`);

  const profilesByStem = new Map(DAY_MASTERS.map((item) => [item.stem, item]));
  for (const item of dayMasters) {
    const label = `${item.stem}日主导读`;
    const profile = profilesByStem.get(item.stem);
    const expectedName = `${STEMS_EN[item.stem]} ${ELEMENTS_EN[item.element]}`;
    if (!profile || item.element !== profile.element || item.yinYang !== profile.yinYang
      || item.slug !== profile.slug || item.name !== expectedName) {
      errors.push(`${label}名称、五行、阴阳或 slug 须使用统一术语`);
    }
    const count = wordCount(item.guide);
    if (count < 120 || count > 180) errors.push(`${label}正文须为 120–180 词，实际 ${count} 词`);
    if (item.points.length !== 3) errors.push(`${label}须有 3 条要点`);
    errors.push(...validateEnglish(label,
      [item.name, item.image, item.tagline, item.guide, ...item.points]));
  }
  if (new Set(dayMasters.map((item) => item.stem)).size !== 10
    || new Set(dayMasters.map((item) => item.slug)).size !== 10) {
    errors.push("日主导读的天干与 slug 不得缺失或重复");
  }

  for (const item of tenGods) {
    const label = `${item.key}十神导读`;
    const expectedName = TEN_GODS_EN[item.key];
    const expectedSlug = expectedName.toLowerCase().replaceAll(" ", "-");
    if (item.name !== expectedName || item.slug !== expectedSlug) {
      errors.push(`${label}名称或 slug 须使用统一术语`);
    }
    const count = wordCount(item.guide);
    if (count < 100 || count > 160) errors.push(`${label}正文须为 100–160 词，实际 ${count} 词`);
    if (item.points.length !== 3) errors.push(`${label}须有 3 条要点`);
    errors.push(...validateEnglish(label,
      [item.name, item.relation, item.tagline, item.guide, ...item.points]));
  }
  const tenGodKeys = new Set(tenGods.map((item) => item.key));
  if (EXPECTED_TEN_GODS.some((key) => !tenGodKeys.has(key))
    || new Set(tenGods.map((item) => item.slug)).size !== 10) {
    errors.push("十神导读的类型与 slug 不得缺失或重复");
  }
  return errors;
}
