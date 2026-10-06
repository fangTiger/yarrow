// src/calendar/cities.ts
import cities from "./data/cities.json" with { type: "json" };

export interface BirthCity {
  name: string;
  province: string;
  longitude: number;
  latitude: number;
}
// 来源：GeoNames 城市中心代表坐标，https://download.geonames.org/export/dump/ 。
// 经度与纬度四舍五入至两位小数；非精确出生点，可由用户手填经度替代。
export const CITY_DATA_SOURCE = "GeoNames 地名坐标数据（城市中心，两位小数）";
export function readCities(): readonly BirthCity[] {
  return cities.map((city) => ({ ...city }));
}
