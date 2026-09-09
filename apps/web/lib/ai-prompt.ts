/**
 * 운영자가 외부 AI(ChatGPT·Claude 등)에 붙여넣어 리드마그넷 HTML을 만들 때 쓰는 프롬프트 템플릿.
 * `docs/ai-generation-guide.md` §2와 내용을 동일하게 유지한다. 이 시스템은 AI를 직접 호출하지 않는다(ADR 0012).
 */
export const AI_PROMPT_TEMPLATE = `다음 조건으로 리드마그넷 신청 페이지를 완전한 HTML 파일 하나로 만들어 줘.

[캠페인] {캠페인 이름과 한 줄 설명}
[제공물] {무료 체크리스트 / 뉴스레터 / 전자책 등}
[수집 항목] 이름(name, 필수), 이메일(email, 필수), {추가 항목: 예 관심 분야 select}

규칙:
- <!doctype html>부터 </html>까지 파일 하나. 외부 JS 없음. CSS는 <style> 안에.
- <form> 하나. 모든 input/select/textarea에 name 속성. 제출 버튼은 <button type="submit">.
- action, method, onsubmit, fetch는 쓰지 마. 제출은 시스템이 처리해.
- 폼 아래에 개인정보 수집 동의 체크박스(name="consent", required).
- 제출 성공 시 폼이 <p data-lead-success>로 바뀌니 그 클래스의 스타일도 넣어 줘. 오류는 <p data-lead-error>.
- 모바일 우선, 한국어.`;
