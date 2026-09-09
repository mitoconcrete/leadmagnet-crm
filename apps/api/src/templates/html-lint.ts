/**
 * 템플릿 등록 점검 경고(ADR 0018 "점검은 안내, 격리는 방어").
 *
 * 등록을 막지 않는다. 프롬프트 템플릿(docs/ai-generation-guide.md) 규칙을 벗어난
 * 요소를 정규식으로 찾아 한국어 경고 문자열로 안내할 뿐이다. 보안은 격리
 * (sandbox iframe, CSP)가 담당하며 이 검사는 "왜 동작하지 않는지"를 운영자에게
 * 알려 주는 층이다. HTML 파서 의존성을 추가하지 않는다.
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

function hasNavigationEscape(html: string): boolean {
  const metaRefresh = extractTags(html, 'meta').some(
    (tag) => (attrValue(tag, 'http-equiv') ?? '').toLowerCase() === 'refresh',
  );
  const targetTags = [...extractTags(html, 'a'), ...extractTags(html, 'form'), ...extractTags(html, 'base')];
  const topOrParentTarget = targetTags.some((tag) => {
    const target = (attrValue(tag, 'target') ?? '').toLowerCase();
    return target === '_top' || target === '_parent';
  });
  return metaRefresh || topOrParentTarget;
}

function hasAdminApiCall(html: string): boolean {
  const hrefMatch = /<a\b[^>]*\bhref\s*=\s*(?:"[^"]*\/api\/admin[^"]*"|'[^']*\/api\/admin[^']*')/i.test(html);
  const fetchMatch = /fetch\s*\(\s*[`'"][^`'"]*\/api\/admin/i.test(html);
  const xhrMatch = /XMLHttpRequest[\s\S]{0,300}\/api\/admin/i.test(html);
  return hrefMatch || fetchMatch || xhrMatch;
}

function hasConsentCheckbox(html: string): boolean {
  return extractTags(html, 'input').some(
    (tag) => (attrValue(tag, 'type') ?? '').toLowerCase() === 'checkbox' && attrValue(tag, 'name') === 'consent',
  );
}

/**
 * 순수 함수. 등록을 차단하지 않고 한국어 경고 문자열 배열을 고정된 순서로 돌려준다.
 * 각 규칙은 최대 1건의 경고만 만든다.
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

  if (hasNavigationEscape(html)) {
    warnings.push('페이지 이동 시도(meta refresh, target=_top)는 sandbox로 차단됩니다');
  }

  if (hasAdminApiCall(html)) {
    warnings.push('관리자 API 호출은 격리 정책으로 차단됩니다');
  }

  if (!hasConsentCheckbox(html)) {
    warnings.push('개인정보 수집 동의 체크박스(name="consent")가 없습니다');
  }

  return warnings;
}
