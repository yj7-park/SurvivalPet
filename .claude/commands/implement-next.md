# implement-next

`plan/` 폴더의 설계서를 순서대로 구현하고 GitHub에 배포하는 개발 워크플로우.

## 실행 절차

### 1. 다음 구현 대상 파악
- `git log --oneline -5` 로 마지막 커밋 확인
- 마지막 버전(예: `v0.14.0`)에서 plan 번호 추출 → 다음 번호 = N+1
- `plan/{N+1}-*.md` 파일 읽기

### 2. 설계서 분석
- 설계서 전체를 읽고 구현 범위와 파일 목록 파악
- 관련 기존 코드를 읽어 현재 상태 이해

### 3. 기능 구현
- 설계서의 모든 기능을 빠짐없이 구현
- 신규 파일 생성 및 기존 파일 수정
- `npm run build` 로 빌드 오류 없음 확인

### 4. 버전 업데이트
- `package.json` 의 `version` 을 `"0.{N}.0"` 으로 변경
  - 예: plan 15 → `"0.15.0"`

### 5. 커밋 & 배포
- 변경 파일 스테이징 (`git add` 로 관련 파일만)
- 커밋 메시지 형식:
  ```
  v0.{N}.0 {설계서 제목} (plan {N})
  
  - 구현 내용 bullet points
  
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- `git push origin master`

## 규칙

- 설계서에 명시된 기능만 구현 (추가 개선 금지)
- 빌드 성공 확인 후 커밋
- 구현 완료 후 다음 plan 번호를 안내
