// src/types/lunar-javascript.d.ts
declare module "lunar-javascript" {
  interface SolarValue { toYmdHms(): string; }
  interface JieQiValue { getName(): string; getSolar(): SolarValue; }
  interface NineStarValue { toString(): string; }
  interface EightCharValue {
    setSect(sect: 1 | 2): void;
    getYear(): string; getMonth(): string; getDay(): string; getTime(): string;
    getYearNaYin(): string; getMonthNaYin(): string; getDayNaYin(): string; getTimeNaYin(): string;
  }
  interface LunarValue {
    toString(): string; getTimeZhi(): string; getYueXiang(): string;
    getEightChar(): EightCharValue; getDayXun(): string; getDayXunKong(): string;
    getPrevJieQi(): JieQiValue; getNextJieQi(): JieQiValue;
    getWuHou(): string; getHou(): string; getXiu(): string; getZheng(): string;
    getAnimal(): string; getGong(): string; getShou(): string;
    getZhiXing(): string; getDayTianShen(): string; getDayTianShenType(): string;
    getDayChongDesc(): string; getDaySha(): string; getDayYi(): string[]; getDayJi(): string[];
    getPengZuGan(): string; getPengZuZhi(): string; getDayNineStar(): NineStarValue;
    getDayPositionXiDesc(): string; getDayPositionCaiDesc(): string; getDayPositionFuDesc(): string;
  }
  interface SolarFactory {
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): { getLunar(): LunarValue };
  }
  const lunarPkg: { Solar: SolarFactory };
  export default lunarPkg;
}
