// web/lib/api.ts
import type { SanyiFeeProof } from "../../src/sanyi/fee.js";
import type { SanyiApi } from "../../src/sanyi/api.js";
import type { QuestionSchoolKey } from "../../src/sanyi/schools/index.js";
import type { NamingFamilyKey } from "../../src/sanyi/naming/schema.js";
import type { TFunction } from "./i18n.js";
export type PaymentConfiguration = Awaited<ReturnType<SanyiApi["payment"]>>;
export type NowResponse = Awaited<ReturnType<SanyiApi["now"]>>;
export type Classification = Awaited<ReturnType<SanyiApi["classify"]>>;
export type AnyPublicReading = Awaited<ReturnType<SanyiApi["getReading"]>>;
export type PublicReading = Extract<AnyPublicReading, { kind: "question" }>;
export type ThrowResult = PublicReading["throws"][number];
export interface CreateReadingInput {
  question: string;
  kind: Classification["kind"];
  subjectKey?: string;
  horizon?: string;
  birth?: import("./birth-profile.js").BirthProfileInput;
  sect?: 1 | 2;
  target?: "person" | "business";
  surname?: string;
  gender?: "male" | "female" | "any";
  length?: 1 | 2 | 3 | 4;
  unborn?: boolean;
  feeProof: SanyiFeeProof;
}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly readingId?: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
async function decode<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  let payload: { error?: unknown; code?: unknown; readingId?: unknown } = {};
  try { payload = await response.json() as typeof payload; } catch {}
  const message = typeof payload.error === "string" ? payload.error : "请求未能完成";
  const readingId = typeof payload.readingId === "string" ? payload.readingId : undefined;
  const code = typeof payload.code === "string" ? payload.code : undefined;
  throw new ApiError(message, response.status, readingId, code);
}

const ERROR_KEYS = {
  "birth-required": "errors.birthRequired",
  "birth-invalid": "errors.birthInvalid",
  "payment-already-used": "errors.paymentAlreadyUsed",
  "payment-invalid": "errors.paymentInvalid",
  "payment-proof-required": "errors.paymentInvalid",
  "payment-proof-invalid": "errors.paymentInvalid",
  "invalid-subject": "errors.invalidSubject",
  "invalid-question": "errors.invalidQuestion",
  "invalid-question-kind": "errors.invalidQuestion",
  "invalid-input": "errors.invalidInput",
  "invalid-body": "errors.invalidInput",
} as const;

export function apiErrorMessage(error: unknown, t: TFunction): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : t("errors.generic");
  const key = error.code ? ERROR_KEYS[error.code as keyof typeof ERROR_KEYS] : undefined;
  if (key) return t(key);
  return error.status >= 500 ? t("errors.serviceUnavailable") : t("errors.generic");
}
export function createApiClient(fetcher: typeof fetch = fetch) {
  const request = async <T>(path: string, body?: unknown): Promise<T> => decode<T>(await fetcher(path, {
    ...(body === undefined ? {} : {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  }));
  return {
    getPayment: () => request<PaymentConfiguration>("/api/payment"),
    getNow: () => request<NowResponse>("/api/now"),
    classify: (question: string) => request<Classification>("/api/classify", { question }),
    createReading: (input: CreateReadingInput) => request<AnyPublicReading>("/api/readings", input),
    continueCasting: (id: string) => request<AnyPublicReading>(`/api/readings/${id}/cast`, {}),
    retrySummary: (id: string) => request<AnyPublicReading>(`/api/readings/${id}/summary/retry`, {}),
    getReading: (id: string, lang?: "zh" | "en") => request<AnyPublicReading>(
      `/api/readings/${id}${lang === "en" ? "?lang=en" : ""}`,
    ),
    translateReading: (id: string) => request<import("../../src/sanyi/translation/store.js").StoredTranslation>(
      `/api/readings/${id}/translate`, { lang: "en" },
    ),
    retrySchool: (
      id: string,
      key: QuestionSchoolKey
        | import("../../src/sanyi/schools/bazi-shared.js").BaziSchoolKey
        | NamingFamilyKey,
    ) => request<AnyPublicReading>(`/api/readings/${id}/schools/${key}/retry`, {}),
    changeDayBoundary: (id: string, birth: import("./birth-profile.js").BirthProfileInput, sect: 1 | 2) =>
      request<AnyPublicReading>(`/api/readings/${id}/day-boundary`, { birth, sect }),
    changeSubject: (id: string, subjectKey: string) => request<PublicReading>(
      `/api/readings/${id}/subject`,
      { subjectKey },
    ),
  };
}
export const api = createApiClient();
