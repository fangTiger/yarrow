const HAN = /\p{Script=Han}/gu;
const LATIN = /\p{Script=Latin}/gu;

/** 汉字占全部汉字与拉丁字母的比例；标点、数字和用户问题不进入分母。 */
export function hanCharacterRatio(text: string): number {
  const han = text.match(HAN)?.length ?? 0;
  const latin = text.match(LATIN)?.length ?? 0;
  return han + latin === 0 ? 1 : han / (han + latin);
}

/** 模型正文低于五成汉字时触发完整中文重写。 */
export function chineseBodyErrors(texts: readonly string[]): string[] {
  return hanCharacterRatio(texts.join("\n")) < 0.5
    ? ["正文汉字占比低于 50%，请用中文作答"]
    : [];
}
