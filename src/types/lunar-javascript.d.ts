// src/types/lunar-javascript.d.ts
declare module "lunar-javascript" {
  interface SolarValue {
    nextYear(years: number): SolarValue;
    toYmd(): string;
    toYmdHms(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
    getLunar(): LunarValue;
  }
  interface JieQiValue {
    getName(): string;
    getSolar(): SolarValue;
  }
  interface NineStarValue {
    toString(): string;
  }
  interface LiuYueValue {
    getMonthInChinese(): string;
    getGanZhi(): string;
  }
  interface LiuNianValue {
    getYear(): number;
    getGanZhi(): string;
    getAge(): number;
    getLiuYue(): LiuYueValue[];
  }
  interface DaYunValue {
    getIndex(): number;
    getGanZhi(): string;
    getStartAge(): number;
    getEndAge(): number;
    getStartYear(): number;
    getEndYear(): number;
    getLiuNian(count?: number): LiuNianValue[];
  }
  interface YunValue {
    isForward(): boolean;
    getStartYear(): number;
    getStartMonth(): number;
    getStartDay(): number;
    getStartSolar(): SolarValue;
    getDaYun(count?: number): DaYunValue[];
  }
  interface EightCharValue {
    setSect(sect: 1 | 2): void;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearNaYin(): string;
    getMonthNaYin(): string;
    getDayNaYin(): string;
    getTimeNaYin(): string;
    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getTimeShiShenGan(): string;
    getYearHideGan(): string[];
    getMonthHideGan(): string[];
    getDayHideGan(): string[];
    getTimeHideGan(): string[];
    getYearShiShenZhi(): string[];
    getMonthShiShenZhi(): string[];
    getDayShiShenZhi(): string[];
    getTimeShiShenZhi(): string[];
    getYearDiShi(): string;
    getMonthDiShi(): string;
    getDayDiShi(): string;
    getTimeDiShi(): string;
    getTaiYuan(): string;
    getMingGong(): string;
    getShenGong(): string;
    getYun(gender: 0 | 1, startSect?: 1 | 2): YunValue;
  }
  interface LunarValue {
    toString(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getSolar(): SolarValue;
    getTimeZhi(): string;
    getYueXiang(): string;
    getEightChar(): EightCharValue;
    getDayXun(): string;
    getDayXunKong(): string;
    getCurrentJie(): JieQiValue | null;
    getPrevJieQi(): JieQiValue;
    getNextJieQi(): JieQiValue;
    getJieQiTable(): Record<string, SolarValue>;
    getWuHou(): string;
    getHou(): string;
    getXiu(): string;
    getZheng(): string;
    getAnimal(): string;
    getGong(): string;
    getShou(): string;
    getZhiXing(): string;
    getDayTianShen(): string;
    getDayTianShenType(): string;
    getDayChongDesc(): string;
    getDaySha(): string;
    getDayYi(): string[];
    getDayJi(): string[];
    getPengZuGan(): string;
    getPengZuZhi(): string;
    getDayNineStar(): NineStarValue;
    getDayPositionXiDesc(): string;
    getDayPositionCaiDesc(): string;
    getDayPositionFuDesc(): string;
  }
  interface SolarFactory {
    fromYmd(year: number, month: number, day: number): SolarValue;
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): SolarValue;
  }
  const lunarPkg: {
    Solar: SolarFactory;
    Lunar: { fromYmd(year: number, month: number, day: number): LunarValue };
    LunarYear: { fromYear(year: number): { getLeapMonth(): number } };
    LunarMonth: {
      fromYm(year: number, month: number): { getDayCount(): number } | null;
    };
    LunarUtil: {
      SHI_SHEN: Record<string, string>;
      ZHI_HIDE_GAN: Record<string, string[]>;
    };
  };
  export default lunarPkg;
}
