import { charInfo } from "./lexicon.js";
import { nameWorthyChars } from "./pool.js";
import type { NamingContext, NamingFamilyKey } from "./schema.js";

export type { NamingContext } from "./schema.js";

const COMMON_BOUNDARIES = `共同要求：
- 问题可能是英文，请仍用中文作答。
- 每个字须从程序认可的可用起名字中取，不用表外字或不宜入名的字。
- 人名须按性别取字；性别为「不限」时只取中性字，避免明显偏男或偏女。
- 取字须好读好写、寓意积极，避免谐音不雅，尽量不用三级生僻字。
- 不用五格、三才、数理，也不用笔画吉凶之说，不承诺名字能够改运。
- 说明中不出现开光、法器、符咒、转运、化煞、风水物件、放生、供奉等内容。
- 商号只写字号，不含行政区划、行业词与组织形式词；字号要易记易读并契合行业。
- 每个名字都要写 chars 逐字字义，顺序须与 given 一致。字义按这个名字里的取意来写，
  如「泽：恩泽」，不要照抄字典古义；gloss 不超过 12 字。
- chars 里每个字还要写 sense，格式为「用作名字意指……」，不超过 30 字。
- 每个名字写 tags 作为 3 至 5 个性格寓意词，每项 2 至 4 字，只写正面词，不写负面词。
- given 只写名或字号；meaning 写整体寓意；why 写本家取名理由；note 概括本家思路。
- 一次给出三个互不相同的名字。输出必须严格符合给定 JSON Schema。`;

const COMMON_BOUNDARIES_EN = `Shared requirements:
- Write for an international reader who does not know Chinese, using plain English.
- given remains the Chinese-character given name or business name. chars[].char must match given in order and also remains Chinese.
- Choose every character from the program-approved naming characters. Do not use out-of-list or unsuitable characters.
- For a person, respect the requested gender. When gender is any, use only neutral characters and avoid strongly masculine or feminine choices.
- Prefer names that are easy to read and write, have positive meanings, avoid awkward homophones, and generally avoid rare level-three characters.
- Do not use Five Grids, Three Talents, stroke numerology, or claims that a name can change luck.
- Do not mention consecrated objects, ritual implements, talismans, luck-changing objects, feng shui items, releasing animals, donations, offerings, or incense.
- A business result is only the distinctive name, without an administrative place, industry term, or organization suffix. It should be memorable, readable, and suitable for the business.
- For every character, chars[].gloss gives its English meaning in a form such as “Ze: grace, blessing”, at most 48 characters.
- Every chars[].sense is English, begins exactly with “As a name, it suggests”, and explains the character's sense in this name, at most 120 characters.
- tags contains three to five positive English labels. Each tag has one to three words and no more than 24 characters. Do not use negative personality words.
- given contains only the name. meaning gives the overall meaning in English; why gives this family's reason in English; note summarizes this family's method in English.
- Be concise: every maxLength in the JSON Schema counts characters, not words. Do not add fields the schema does not define.
- Give exactly three distinct names. Output must strictly follow the provided JSON Schema.`;

const WUXING_SYSTEM_PROMPT = `你是「三易」起名三家中的五行补益家。
本家起法：依据程序给出的喜用五行，从喜用用字中取至少一个字，再兼顾字义、读音和书写。
若商号未能按行业确定五行，就结合行业与期望自选一个最贴切的五行，写入 element，
并保证每个字号至少有一个字属于该五行。已有喜用五行时不要填写 element。
${COMMON_BOUNDARIES}`;

const WUXING_SYSTEM_PROMPT_EN = `You are Yarrow's Five Elements naming specialist.
Method: use the favorable elements supplied by the program, choose at least one character from those element lists for every name, and then balance meaning, sound, and written form.
If a business has no program-matched industry element, select the single most fitting element from the business and desired qualities, write it in element, and ensure every business name contains at least one character of that element. Omit element when favorable elements are already supplied.
Refer to yourself only as the Five Elements specialist.
${COMMON_BOUNDARIES_EN}`;

const SHIWEN_SYSTEM_PROMPT = `你是「三易」起名三家中的诗文出处家。
本家起法：只从用户提示所列候选句取名；一个名字的每个字必须都出现在同一条所引原句中。
每个名字必须填写该候选句开头的编号到 sourceId，不得改写编号、杜撰出处或转述原句。
取字时既要保留诗文意境，也要结合字在名字里的现代正面含义。
名字须自成词意、读来通顺，不得机械截取原句里相邻的几个字凑成名字（如从「春桃小」截取）。
why 不写候选编号，直接引用原句或书名篇名说明取名理由。
${COMMON_BOUNDARIES}`;

const SHIWEN_SYSTEM_PROMPT_EN = `You are Yarrow's Classical Poetry naming specialist.
Method: choose characters only from the candidate lines in the user prompt. Every character in one name must appear in the same cited original line.
Every name must use that line's leading ID in sourceId. Do not change the ID, invent a source, or paraphrase the original as though it were a quotation.
Preserve the literary image while explaining each character through a positive modern naming sense. The result must read as a coherent name rather than a mechanical slice of adjacent text.
why must not expose the candidate ID. It may quote the supplied Chinese original line and book or title exactly, but it must also include a substantive English explanation of the image and naming choice. No other Chinese text is allowed.
Refer to yourself only as the Classical Poetry specialist.
${COMMON_BOUNDARIES_EN}`;

const YINYI_SYSTEM_PROMPT = `你是「三易」起名三家中的音形字义家。
本家起法：先看姓与名的声调、声母、韵母是否顺口，再看字形繁简搭配与名字整体含义。
人名要把姓与名连起来读，避免全名声调完全相同，也避免连续同声母或同韵母造成拗口；
叠字名字可以不受声调全同这一条限制。商号重视响亮、清楚和便于记忆。
${COMMON_BOUNDARIES}`;

const YINYI_SYSTEM_PROMPT_EN = `You are Yarrow's Sound, Form, and Meaning naming specialist.
Method: first assess how surname and given name work across tones, initials, and finals; then assess visual balance and the overall meaning.
For a person, read surname and given name together. Avoid an entirely identical tone pattern and avoid consecutive matching initials or finals that sound awkward. A repeated-character name is exempt from the identical-tone rule. For a business, prioritize clarity, energy, and memorability.
Refer to yourself only as the Sound, Form, and Meaning specialist.
${COMMON_BOUNDARIES_EN}`;

function targetLine(ctx: NamingContext): string {
  if (ctx.target === "business") {
    return `起名对象：商号 · 字号 ${ctx.length} 字`;
  }
  const length = ctx.length === 1 ? "单名" : ctx.length === 2 ? "双名" : `${ctx.length} 字名`;
  const gender = { male: "男", female: "女", any: "不限" }[ctx.gender];
  return `起名对象：人名 · 姓${ctx.surname ?? ""} · ${length} · 性别${gender}`;
}

function commonPrompt(ctx: NamingContext): string[] {
  return [
    targetLine(ctx),
    `期望原文：${ctx.question || "未填写"}`,
    `名字字数：${ctx.length} 字`,
  ];
}

function buildWuxingPrompt(ctx: NamingContext): string {
  const lines = commonPrompt(ctx);
  const favorable = [...new Set(ctx.favorable ?? [])].slice(0, 2);
  if (favorable.length > 0) {
    const groups = favorable.map((element) => {
      const usable = nameWorthyChars((info) => info.wuxing === element)
        .slice(0, 150)
        .map(({ char }) => char);
      return `${element}：${usable.join("、")}`;
    });
    lines.push(
      `喜用五行：${favorable.join("、")}`,
      `喜用来源：${ctx.favorableNote}`,
      "喜用用字（按诗文常用度排序，靠前的更常用）：",
      ...groups,
      "每个名字至少选一个喜用用字，其余字也须可入名。",
    );
  } else {
    lines.push(
      `五行来源：${ctx.favorableNote}`,
      "行业关键词未能确定五行，请结合行业与期望自选一个五行。",
      "请在 element 填写所选五行，并让每个字号至少有一个字属于它。",
    );
  }
  lines.push("输出必须严格符合给定 JSON Schema。");
  return lines.join("\n");
}

function buildShiwenPrompt(ctx: NamingContext): string {
  const lines = [
    ...commonPrompt(ctx),
    "候选诗文（每行格式为「编号｜书名 · 题名｜原句」，只可从下列原句取字）：",
    ...ctx.candidates.map((line, index) => (
      `S${String(index + 1).padStart(2, "0")}｜${line.book} · ${line.title}｜${line.text}`
    )),
    "每个名字的 sourceId 须填写所引行首编号，如 S01；名字各字须都在该行原句中。",
    "输出必须严格符合给定 JSON Schema。",
  ];
  return lines.join("\n");
}

function surnamePronunciation(surname: string | undefined): string {
  if (!surname) return "姓氏读音：未提供";
  const readings = [...surname].map((char) => {
    const info = charInfo(char);
    return info ? `${char} ${info.pinyin}（${info.tone} 声）` : `${char}（读音未知）`;
  });
  return `姓氏读音：${readings.join("；")}`;
}

function buildYinyiPrompt(ctx: NamingContext): string {
  const lines = commonPrompt(ctx);
  if (ctx.target === "person") {
    lines.push(surnamePronunciation(ctx.surname));
  }
  lines.push(
    "请重点说明全名或字号的音律、字形搭配与逐字取意。",
    "输出必须严格符合给定 JSON Schema。",
  );
  return lines.join("\n");
}

export const NAMING_FAMILIES: ReadonlyArray<{
  key: NamingFamilyKey;
  name: string;
  seal: string;
  systemPrompt: string;
  systemPromptEn: string;
  buildUserPrompt(ctx: NamingContext): string;
}> = [
  {
    key: "wuxing", name: "五行补益", seal: "五",
    systemPrompt: WUXING_SYSTEM_PROMPT, systemPromptEn: WUXING_SYSTEM_PROMPT_EN,
    buildUserPrompt: buildWuxingPrompt,
  },
  {
    key: "shiwen", name: "诗文出处", seal: "诗",
    systemPrompt: SHIWEN_SYSTEM_PROMPT, systemPromptEn: SHIWEN_SYSTEM_PROMPT_EN,
    buildUserPrompt: buildShiwenPrompt,
  },
  {
    key: "yinyi", name: "音形字义", seal: "音",
    systemPrompt: YINYI_SYSTEM_PROMPT, systemPromptEn: YINYI_SYSTEM_PROMPT_EN,
    buildUserPrompt: buildYinyiPrompt,
  },
];
