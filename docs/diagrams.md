# 다이어그램 (Mermaid)

설계 스펙 `superpowers/specs/2026-09-09-leadmagnet-crm-design.md`와 ADR을 그림으로 옮긴 참고 문서다. 계약의 최종 권위는 스펙이며, 이 문서는 그 요약이다.

## 1. DB 스키마 (ER)

마이그레이션 `apps/api/src/migrations/1757400000000-init.ts` 기준. 컬럼명은 snake_case, PK는 모두 uuid.

```mermaid
erDiagram
    operators ||--o{ sessions : "operator_id"
    html_templates ||--o{ forms : "template_id"
    campaigns ||--o{ forms : "campaign_id"
    forms ||--o{ distribution_links : "form_id"
    forms ||--o{ visits : "form_id"
    forms ||--o{ submissions : "form_id"
    visitors ||--o{ visits : "visitor_id"
    visitors ||--o{ submissions : "visitor_id"
    visits ||--o{ submissions : "visit_id"
    distribution_links o|--o{ visits : "link_id (nullable)"
    distribution_links o|--o{ submissions : "link_id (nullable)"

    operators {
        uuid id PK
        varchar email UK
        varchar password_hash
        timestamptz created_at
    }
    sessions {
        uuid id PK "쿠키 sid 값"
        uuid operator_id FK
        timestamptz expires_at
        timestamptz created_at
    }
    html_templates {
        uuid id PK
        varchar name
        varchar original_filename
        text html "등록 원본, 무가공"
        int size_bytes
        timestamptz created_at
    }
    campaigns {
        uuid id PK
        varchar name
        text description "nullable"
        campaign_status status "active | archived"
        timestamptz created_at
        timestamptz updated_at
    }
    forms {
        uuid id PK
        uuid campaign_id FK
        uuid template_id FK
        varchar name
        varchar slug UK "공개 URL /p/:slug"
        varchar success_message
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    distribution_links {
        uuid id PK
        uuid form_id FK
        channel channel "instagram | x | youtube | threads"
        varchar code UK "8자 base62, ?src=code"
        timestamptz created_at
    }
    visitors {
        uuid id PK "쿠키 vid 값"
        timestamptz first_seen_at
        timestamptz last_seen_at
    }
    visits {
        uuid id PK "visitToken"
        uuid form_id FK
        uuid visitor_id FK
        uuid link_id FK "nullable, direct면 NULL"
        varchar channel "direct | instagram | x | youtube | threads"
        text user_agent "nullable"
        timestamptz created_at
    }
    submissions {
        uuid id PK
        uuid form_id FK
        uuid visit_id FK
        uuid visitor_id FK
        uuid link_id FK "nullable"
        varchar channel
        jsonb payload "폼 필드 원본, 정규화 없음"
        timestamptz created_at
    }
```

제약: `distribution_links UNIQUE(form_id, channel)` (채널당 링크 1개), `forms.slug UNIQUE`, `operators.email UNIQUE`. 인덱스: `visits(form_id)`, `visits(link_id)`, `submissions(form_id)`, `submissions(created_at)`.

## 2. 운영자 흐름 (관리자 화면 → 관리자 API)

```mermaid
flowchart LR
    A[로그인 /login] -->|POST /api/admin/auth/login| B[세션 쿠키 sid<br/>Path=/api/admin]
    B --> C[HTML 등록 /templates<br/>POST /api/admin/templates]
    C -->|.html, ≤512KB, form 포함| D[html_templates]
    B --> E[캠페인 생성 /<br/>POST /api/admin/campaigns]
    E --> F[캠페인 상세 /campaigns/:id]
    F -->|POST /api/admin/forms<br/>templateId + campaignId| G[폼 생성<br/>slug 자동, publicUrl]
    G -->|POST /api/admin/forms/:id/links<br/>channel| H[배포 링크<br/>/p/:slug?src=code]
    H --> I[인스타그램 · X · 유튜브 · 스레드에 게시]
    F -->|GET /api/admin/campaigns/:id/stats| J[방문 · 방문자 · 신청 · 전환율<br/>채널별 5행]
    F -->|GET /api/admin/submissions?campaignId| K[신청 명단 payload]
```

## 3. 방문자 흐름 (공개 페이지 → 공개 API)

```mermaid
sequenceDiagram
    autonumber
    participant V as 방문자 브라우저
    participant P as API /p/:slug (래퍼)
    participant DB as PostgreSQL
    participant I as sandbox iframe (등록 HTML)
    participant S as API /api/public/forms/:slug/submissions

    V->>P: GET /p/:slug?src=CODE (쿠키 vid 있으면 전송)
    P->>DB: forms(slug, is_active) 조회
    alt 폼 없음 / 비활성
        P-->>V: 404
    end
    P->>DB: visitors upsert (vid 없으면 신규)
    P->>DB: distribution_links(code) → link_id, channel (없으면 direct)
    P->>DB: visits INSERT → visit.id = visitToken
    P-->>V: 200 text/html + Set-Cookie vid (Path=/p, 1년)<br/>CSP · X-Frame-Options · 래퍼 안에 srcdoc iframe
    V->>I: srcdoc 렌더 (sandbox="allow-scripts allow-forms", same-origin 없음)
    Note over I: 서버가 </body> 앞에 주입한 스크립트가<br/>모든 <form> submit을 가로챔
    I->>S: POST {visitToken, fields} (JSON, CORS *)
    S->>DB: visits(visitToken) 검증 → form 일치 확인
    alt fields 비었음 / 토큰 불일치
        S-->>I: 400
    end
    S->>DB: submissions INSERT (payload jsonb, channel, link_id)
    S-->>I: 201 {id, message}
    I->>I: form을 <p data-lead-success>message</p>로 교체
```

## 4. 격리 3겹 (ADR 0003)

```mermaid
flowchart TB
    subgraph web["관리자 화면 오리진 :3000"]
        W[Next.js 관리자 화면]
    end
    subgraph api["API 오리진 :3001"]
        AD["/api/admin/*<br/>세션 쿠키 sid (Path=/api/admin)<br/>CORS 없음"]
        PU["/api/public/*<br/>CORS *"]
        PP["/p/:slug 래퍼<br/>CSP default-src 'none'<br/>connect-src PUBLIC_BASE_URL/api/public/"]
    end
    subgraph frame["sandbox iframe (opaque origin)"]
        H[등록 HTML + 주입 스크립트]
    end
    W -->|rewrite /api/:path*| AD
    PP --> H
    H -->|허용: POST submissions| PU
    H -.->|차단: 쿠키 sid는 Path 불일치로 미전송<br/>같은 오리진 아님 → 401| AD
    H -.->|차단: CSP form-action 'none', frame-src 'self'| X[외부 전송]
```

세 겹은 서로 독립적으로 동작한다. (1) 관리자 화면과 API의 오리진 분리, (2) 세션 쿠키의 `Path=/api/admin` 한정, (3) `allow-same-origin` 없는 sandbox iframe과 CSP. 하나가 뚫려도 등록 HTML이 관리자 자격 증명이나 관리자 API에 닿지 못한다.

## 5. 성과 집계 (ADR 0005 · 0006)

```mermaid
flowchart LR
    subgraph src["원천"]
        VI[visits]
        SU[submissions]
    end
    VI -->|"COUNT(*)"| visits[방문]
    VI -->|"COUNT(DISTINCT visitor_id)"| visitors[방문자]
    SU -->|"COUNT(*)"| subs[신청]
    visitors --> rate["전환율 = visitors == 0 ? 0 : round(신청 / 방문자, 4)"]
    subs --> rate
    VI -->|"GROUP BY channel"| ch[채널별 breakdown]
    SU -->|"GROUP BY channel"| ch
    ch --> five["항상 5행 고정 순서<br/>direct · instagram · x · youtube · threads (없는 채널은 0)"]
```

- 방문 = `GET /p/:slug` 1회 = visits 1행. 방문자 = 1년짜리 `vid` 쿠키 1개. 새로고침은 방문만 늘고 방문자는 그대로다.
- 채널 귀속은 마지막 클릭(`?src=code`) 기준이며, 폼에 속한 유효한 코드가 아니면 `direct`.
- 캠페인 집계는 `forms.campaign_id`로 JOIN한 뒤 위 식을 적용한다.

## 6. 개발·검증 파이프라인 (ADR 0008 · 0010 · 0011)

```mermaid
flowchart LR
    T["test: 커밋<br/>(실패 테스트)"] --> F["feat: 커밋<br/>(구현)"]
    F --> L["로컬<br/>pnpm --filter api test:cov<br/>pnpm --filter web test:cov"]
    L --> C["docker compose --profile test<br/>run --rm api-test"]
    C --> G["GitHub Actions<br/>api · web · integration"]
    G --> I["integration: compose up --wait<br/>→ api-test → Bruno → curl 스모크"]
    L -.->|"lines/statements/functions 90%<br/>branches 80% 미달 시 실패"| L
```
