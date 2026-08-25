const PLAN_ID_PATTERN =
  /\b[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\b/i
const PLAN_READY_PATTERN =
  /\b(?:created|prepared) (?:a |the )?.{0,24}\bplan\b|\bplan\b.{0,40}\b(?:is ready|was created|has been created|confirm)\b|(?:已|已经).{0,40}(?:创建|准备).{0,24}计划|计划.{0,32}(?:已创建|已准备|准备好|请.{0,8}确认)/i

export const hasUngroundedPlanClaim = (
  message: string,
  planCount: number,
): boolean =>
  planCount === 0 &&
  PLAN_ID_PATTERN.test(message) &&
  PLAN_READY_PATTERN.test(message)
