const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?<!\d)(?:(?:\+|00)[1-9]\d{0,2}(?:[ .()-]*\d){7,12}|\(?0\d{1,3}\)?[ .-]?\d{3,4}[ .-]?\d{4})(?!\d)/g;

export function redactPersonalContactInfo(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[이메일 비공개]")
    .replace(PHONE_PATTERN, "[전화번호 비공개]");
}
