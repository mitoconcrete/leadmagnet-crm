/**
 * 템플릿 등록 점검(ADR 0018 "점검은 안내, 격리는 방어" + 2026-09-10 차단 규칙 개정).
 *
 * lintHtmlTemplate: 등록을 막지 않는 경고. 프롬프트 템플릿(docs/ai-generation-guide.md)
 * 규칙을 벗어난 요소를 정규식으로 찾아 한국어 경고 문자열로 안내할 뿐이다.
 *
 * findBlockedPatterns: 등록 자체를 거부하는 고신뢰 패턴(스펙 §4.2 400, ADR 0018 차단 규칙
 * 문단). 관리자 API 참조·쿠키 접근·부모/최상위 창 접근·저장소 접근·리다이렉트·target 탈출·
 * 중첩 프레임은 실수를 등록 단계에서 되돌려 준다. 문자열 조립·인코딩으로 우회되며, 보안
 * 경계는 여전히 격리(sandbox iframe, CSP)가 담당한다(samples/isolation-check.html이 그 증명).
 *
 * 두 검사 모두 HTML 파서 의존성을 추가하지 않는다.
 */

function extractTags(html: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  return html.match(re) ?? [];
}

function hasAttr(tag: string, attrName: string): boolean {
  const re = new RegExp(`(^|[\\s<])${attrName}\\s*=`, 'i');
  return re.test(tag);
}

function attrValue(tag: string, attrName: string): string | null {
  const re = new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = re.exec(tag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

const EXCLUDED_INPUT_TYPES = new Set(['submit', 'button', 'reset']);

function countMissingName(html: string): number {
  const tags = [...extractTags(html, 'input'), ...extractTags(html, 'select'), ...extractTags(html, 'textarea')];
  let count = 0;
  for (const tag of tags) {
    const isInput = /^<input\b/i.test(tag);
    if (isInput) {
      const type = (attrValue(tag, 'type') ?? '').toLowerCase();
      if (EXCLUDED_INPUT_TYPES.has(type)) continue;
    }
    if (!hasAttr(tag, 'name')) count++;
  }
  return count;
}

function countExternalScripts(html: string): number {
  return extractTags(html, 'script').filter((tag) => hasAttr(tag, 'src')).length;
}

function formHasIgnoredAttrs(html: string): boolean {
  return extractTags(html, 'form').some(
    (tag) => hasAttr(tag, 'action') || hasAttr(tag, 'method') || hasAttr(tag, 'onsubmit'),
  );
}

function hasSubmitButton(html: string): boolean {
  const hasSubmitInput = extractTags(html, 'input').some(
    (tag) => (attrValue(tag, 'type') ?? '').toLowerCase() === 'submit',
  );
  if (hasSubmitInput) return true;

  return extractTags(html, 'button').some((tag) => {
    const type = attrValue(tag, 'type');
    if (type === null) return true; // type 없는 button의 기본값은 submit
    return type.toLowerCase() === 'submit';
  });
}

function hasConsentCheckbox(html: string): boolean {
  return extractTags(html, 'input').some(
    (tag) => (attrValue(tag, 'type') ?? '').toLowerCase() === 'checkbox' && attrValue(tag, 'name') === 'consent',
  );
}

/**
 * 순수 함수. 등록을 차단하지 않고 한국어 경고 문자열 배열을 고정된 순서로 돌려준다.
 * 각 규칙은 최대 1건의 경고만 만든다. meta refresh·target=_top/_parent·관리자 API 호출은
 * 2026-09-10 개정으로 차단 규칙(findBlockedPatterns)으로 승격되어 더 이상 여기서 다루지 않는다.
 */
export function lintHtmlTemplate(html: string): string[] {
  const warnings: string[] = [];

  const missingNameCount = countMissingName(html);
  if (missingNameCount > 0) {
    warnings.push(
      `name 속성이 없는 입력 요소가 ${missingNameCount}개 있습니다. 이 값은 신청 데이터에 저장되지 않습니다`,
    );
  }

  const externalScriptCount = countExternalScripts(html);
  if (externalScriptCount > 0) {
    warnings.push(`외부 스크립트 ${externalScriptCount}개는 격리 정책(CSP)으로 실행되지 않습니다`);
  }

  if (formHasIgnoredAttrs(html)) {
    warnings.push('form의 action/method/onsubmit은 무시됩니다. 제출은 시스템이 처리합니다');
  }

  if (!hasSubmitButton(html)) {
    warnings.push('제출 버튼(type="submit")이 없습니다');
  }

  if (!hasConsentCheckbox(html)) {
    warnings.push('개인정보 수집 동의 체크박스(name="consent")가 없습니다');
  }

  return warnings;
}

/** 주석(<!-- --> ) 안의 텍스트는 차단 검사 대상에서 제외한다(설명 글에 이유가 있어도 차단되지 않게). */
function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function hasAdminApiReference(html: string): boolean {
  return /\/api\/admin/i.test(html);
}

function hasCookieAccess(html: string): boolean {
  return /document\s*\.\s*cookie/i.test(html);
}

/**
 * window.parent, window.top, 식별자 경계의 parent.(예: parent.document — parentElement는
 * 제외), top.location, top.document만 잡는다. top.style처럼 다른 top.* 프로퍼티는 잡지 않는다.
 */
function hasParentOrTopAccess(html: string): boolean {
  return (
    /\bwindow\s*\.\s*parent\b/i.test(html) ||
    /\bwindow\s*\.\s*top\b/i.test(html) ||
    /\bparent\s*\./i.test(html) ||
    /\btop\s*\.\s*location\b/i.test(html) ||
    /\btop\s*\.\s*document\b/i.test(html)
  );
}

function hasStorageAccess(html: string): boolean {
  return /\b(localStorage|sessionStorage)\b/i.test(html);
}

function hasMetaRefreshTag(html: string): boolean {
  return extractTags(html, 'meta').some((tag) => (attrValue(tag, 'http-equiv') ?? '').toLowerCase() === 'refresh');
}

function hasBlockedTargetAttr(html: string): boolean {
  const tags = [...extractTags(html, 'a'), ...extractTags(html, 'form'), ...extractTags(html, 'base')];
  return tags.some((tag) => {
    const target = (attrValue(tag, 'target') ?? '').toLowerCase();
    return target === '_top' || target === '_parent';
  });
}

function hasNestedFrameTag(html: string): boolean {
  return /<iframe\b/i.test(html) || /<object\b/i.test(html) || /<embed\b/i.test(html);
}

/**
 * 순수 함수. 고신뢰 공격 패턴을 찾아 등록 거부 이유 문자열 배열을 고정된 순서로 돌려준다
 * (빈 배열이면 통과). 각 규칙은 최대 1건만 담는다. 대소문자를 구분하지 않는다.
 */
export function findBlockedPatterns(html: string): string[] {
  const stripped = stripComments(html);
  const blocked: string[] = [];

  if (hasAdminApiReference(stripped)) {
    blocked.push('관리자 API 참조(/api/admin)가 포함되어 있습니다');
  }

  if (hasCookieAccess(stripped)) {
    blocked.push('쿠키 접근(document.cookie)이 포함되어 있습니다');
  }

  if (hasParentOrTopAccess(stripped)) {
    blocked.push('부모·최상위 창 접근이 포함되어 있습니다');
  }

  if (hasStorageAccess(stripped)) {
    blocked.push('브라우저 저장소 접근이 포함되어 있습니다');
  }

  if (hasMetaRefreshTag(stripped)) {
    blocked.push('meta refresh 리다이렉트가 포함되어 있습니다');
  }

  if (hasBlockedTargetAttr(stripped)) {
    blocked.push('target=_top/_parent가 포함되어 있습니다');
  }

  if (hasNestedFrameTag(stripped)) {
    blocked.push('중첩 프레임(iframe/object/embed)이 포함되어 있습니다');
  }

  return blocked;
}
