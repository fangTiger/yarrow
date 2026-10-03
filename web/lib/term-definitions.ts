// web/lib/term-definitions.ts
// 原文移植自基线 310afdc:web/app.tsx 第 415–740 行。
// 已统一中文间隔号并删除旧产品表述。
export const FIGURE_DEFINITIONS = {
  primary: "本卦由起出的六爻直接组成，用来陈列当前问题的起点。",
  mutual: "互卦抽取本卦二至五爻重新成卦，用来换一个角度看内部结构。",
  derived: "变卦只翻转老阴与老阳，呈现动爻改变后的结构。",
  opposite: "错卦把本卦每爻阴阳全反，作为反面条件的参照。",
  reversed: "综卦把六爻次序上下颠倒，作为位置互换后的参照。",
} as const;
