// web/lib/api.ts
import type { SanyiFeeProof } from "../../src/sanyi/fee.js";
import type { SanyiApi } from "../../src/sanyi/api.js";
import type { QuestionSchoolKey } from "../../src/sanyi/schools/index.js";
export type PaymentConfiguration = Awaited<ReturnType<SanyiApi["payment"]>>;
export type NowResponse = Awaited<ReturnType<SanyiApi["now"]>>;
export type Classification = Awaited<ReturnType<SanyiApi["classify"]>>;
export type AnyPublicReading = Awaited<ReturnType<SanyiApi["getReading"]>>;
export type PublicReading = Extract<AnyPublicReading, { kind: "question" }>;
export type ThrowResult = Awaited<ReturnType<SanyiApi["throwCoin"]>>;
export interface CreateReadingInput {
  question: string;
  kind: Classification["kind"];
  subjectKey?: string;
  horizon?: string;
  feeProof: SanyiFeeProof;
}
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly readingId?: string) {
    super(message);
    this.name = "ApiError";
  }
}
async function decode<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  let payload: { error?: unknown; readingId?: unknown } = {};
  try { payload = await response.json() as typeof payload; } catch {}
  const message = typeof payload.error === "string" ? payload.error : "请求未能完成";
  const readingId = typeof payload.readingId === "string" ? payload.readingId : undefined;
  throw new ApiError(message, response.status, readingId);
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
    createReading: (input: CreateReadingInput) => request<PublicReading>("/api/readings", input),
    throwCoin: (id: string, index: number) => request<ThrowResult>(`/api/readings/${id}/throws`, { index }),
    getReading: (id: string) => request<PublicReading>(`/api/readings/${id}`),
    retrySchool: (id: string, key: QuestionSchoolKey) => request<PublicReading>(
      `/api/readings/${id}/schools/${key}/retry`,
      {},
    ),
    changeSubject: (id: string, subjectKey: string) => request<PublicReading>(
      `/api/readings/${id}/subject`,
      { subjectKey },
    ),
  };
}
export const api = createApiClient();
