# e2e 픽스처

- `valid-form.html`: `<form>` 안에 `name`(필수), `email`(email 타입), `interest`(multiple select), `consent`(체크박스), 제출 버튼을 포함한 완전한 HTML 문서. 템플릿 업로드 성공 케이스, 공개 폼 제출 흐름에 쓰인다. ADR 0018 점검 규칙을 모두 만족해 등록 시 `warnings: []`다.
- `no-form.html`: `<form` 태그가 없는 완전한 HTML 문서. 템플릿 업로드 400(폼 없음) 케이스에 쓰인다.
- `warn-form.html`: `name` 없는 input과 외부 `<script src>`를 포함해 ADR 0018 점검 경고가 발생하는 HTML 문서. 등록 자체는 201로 성공하고 `warnings`에 두 경고가 담기는 케이스에 쓰인다.

세 파일 모두 `.html` 확장자이며 524288 bytes(512KB)보다 훨씬 작다. 512KB 초과 케이스는 테스트 코드가 메모리 버퍼로 즉석에서 생성한다(고정 픽스처 파일로 두지 않음).
