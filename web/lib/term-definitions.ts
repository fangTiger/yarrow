// web/lib/term-definitions.ts
import type {
  LiuyaoChart,
  LiuyaoChartRow,
  SixRelation,
} from "../../src/oracle/liuyao-chart.js";

// 原文移植自基线 310afdc:web/app.tsx 第 415–740 行。
// 已统一中文间隔号并删除旧产品表述。
export const FIGURE_DEFINITIONS = {
  primary: "本卦由起出的六爻直接组成，用来陈列当前问题的起点。",
  mutual: "互卦抽取本卦二至五爻重新成卦，用来换一个角度看内部结构。",
  derived: "变卦只翻转老阴与老阳，呈现动爻改变后的结构。",
  opposite: "错卦把本卦每爻阴阳全反，作为反面条件的参照。",
  reversed: "综卦把六爻次序上下颠倒，作为位置互换后的参照。",
} as const;

export const TERM_DEFINITIONS = {
  卦宫: "八宫法把六十四卦归入乾坎艮震巽离坤兑，并标记本宫、世数、游魂或归魂。",
  宫序: "宫序记录本卦从本宫卦逐爻变化所得的位置，并据此确定世应。",
  世应: "世爻代表提问者自己，应爻代表与之相对的对象、环境或外部条件。",
  六神: "青龙、朱雀、勾陈、螣蛇、白虎、玄武随日干轮排，是传统象征名。",
  六亲: "父母、子孙、官鬼、妻财、兄弟由爻支五行与卦宫五行的生克关系确定。",
  伏神: "本卦缺少某类六亲时，按本宫首卦相同爻位补出的隐藏六亲。",
  旬空: "六十甲子每旬有两个未配到天干的地支，称旬空；这里只作排盘标记。",
  月建: "月建按太阳节气划月，不按公历每月一日切换，用来判断月令强弱与月破。",
  旺衰: "旺相休囚死是节气月下的五级强弱标签，不单独等于吉凶。",
  冲破: "月建冲爻为月破；日辰冲休囚静爻为日破，冲旺相静爻为暗动。",
  动变: "动爻翻转阴阳形成变爻，并可出现回头生克和固定进退神关系。",
} as const;

export const RELATION_DEFINITIONS: Record<SixRelation, string> = {
  父母: "六亲之一，常用于房产、单位与文书契约。",
  子孙: "六亲之一，常用于技术、医药、解忧与子女。",
  官鬼: "六亲之一，常用于工作、官职、疾病与忧虑。",
  妻财: "六亲之一，常用于钱财、物价、货品与债务。",
  兄弟: "六亲之一，常用于同辈、朋友、同事与竞争者。",
};

export function lineName(position: number): string {
  return position === 1 ? "初爻" : position === 6 ? "上爻" : `${"一二三四五六"[position - 1]}爻`;
}

function positions(rows: readonly LiuyaoChartRow[]): string {
  return rows.length ? rows.map((row) => lineName(row.position)).join("、") : "本卦明爻未出现";
}

export function readingGuide(chart: LiuyaoChart): readonly { title: string; text: string }[] {
  const focus = chart.focus;
  const useRows = chart.rows.filter((row) => row.primary.relation === focus?.useGod);
  const strong = chart.rows.filter((row) => ["旺", "相"].includes(row.primary.strength));
  const role = (relation?: SixRelation) => positions(
    chart.rows.filter((row) => row.primary.relation === relation),
  );
  const movement = chart.rows.filter((row) => row.changing || row.isHiddenMoving).map((row) => {
    const suffix = [row.advanceRetreat, row.returnEffect].filter(Boolean).join("、");
    return `${lineName(row.position)}${row.isHiddenMoving ? "暗动" : "动"}${suffix ? `，${suffix}` : ""}`;
  });
  return [
    {
      title: "用神",
      text: `本题先看${focus?.useGod ?? "未定用神"}：${positions(useRows)}。`,
    },
    {
      title: "旺衰",
      text: `${chart.month.branch}月属${chart.month.element}，旺相爻在${positions(strong)}；强弱不单独等于吉凶。`,
    },
    {
      title: "原神、忌神、仇神",
      text: `原神在${role(focus?.originalGod)}；忌神在${role(focus?.tabooGod)}；仇神在${role(focus?.enemyGod)}。`,
    },
    {
      title: "世应",
      text: `世在${lineName(chart.shiPosition)}，应在${lineName(chart.yingPosition)}，先比较两处再下判断。`,
    },
    {
      title: "动变",
      text: movement.length ? movement.join("；") : "本卦无动爻或暗动爻，按静卦读取。",
    },
  ];
}

export const BAZI_TERM_DEFINITIONS = {
  胎元: "从出生月柱推算的传统辅助字段。",
  命宫: "按出生月份与时辰推算的传统辅助字段，缺时辰不展示。",
  身宫: "按出生月份与时辰推算的传统辅助字段，缺时辰不展示。",
} as const;
