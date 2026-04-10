# 설계 27 — Cloudflare Pages 배포 & 빌드 설정

> **전제 조건**: 01~26 단계 완료 상태.
> TypeScript + Phaser.js 프로젝트가 구성되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **빌드 도구 설정** — Vite 기반 번들링, TypeScript 컴파일
2. **Cloudflare Pages 배포** — GitHub 연동 자동 배포
3. **Firebase 환경 변수** — 개발/프로덕션 분리
4. **성능 최적화** — 코드 스플리팅, 캐시 전략
5. **배포 체크리스트** — 릴리스 전 확인 항목

---

## 2. 프로젝트 구조

```
ws1/
├── src/
│   ├── scenes/          GameScene, TitleScene, LoadingScene
│   ├── systems/         모든 게임 시스템
│   ├── ui/              HUD, 패널, 오버레이
│   ├── world/           MapGenerator, SpriteGenerator
│   ├── config/          recipes, dropTables, equipment 등
│   └── main.ts          Phaser.Game 진입점
├── public/
│   └── index.html
├── .env.development     Firebase 개발 설정
├── .env.production      Firebase 프로덕션 설정
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. 빌드 도구 — Vite

### 3-1. package.json

```json
{
  "name": "survival-sim",
  "version": "0.1.0",
  "scripts": {
    "dev":     "vite",
    "build":   "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "phaser":      "^3.70.0",
    "firebase":    "^10.0.0",
    "seedrandom":  "^3.0.5",
    "simplex-noise": "^4.0.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite":       "^5.2.0"
  }
}
```

### 3-2. vite.config.ts

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // 대형 라이브러리 별도 청크 분리 → 초기 로딩 속도 향상
          'phaser':   ['phaser'],
          'firebase': ['firebase/app', 'firebase/database'],
        },
      },
    },
    // 청크 크기 경고 임계값 완화 (Phaser 자체가 크므로)
    chunkSizeWarningLimit: 3000,
  },
  // 개발 서버
  server: {
    port: 3000,
    open: true,
  },
});
```

### 3-3. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"]
}
```

---

## 4. 환경 변수 — Firebase 설정 분리

### 4-1. .env.development

```
VITE_FIREBASE_API_KEY=dev-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-dev-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-dev-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-dev-project
```

### 4-2. .env.production

```
VITE_FIREBASE_API_KEY=prod-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-prod-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-prod-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-prod-project
```

### 4-3. Firebase 초기화 코드

```typescript
// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
```

> `.env.*` 파일은 `.gitignore`에 추가 — 키 노출 방지.
> Cloudflare Pages 환경 변수 설정에서 별도 입력.

---

## 5. public/index.html

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="2D 실시간 멀티플레이 생존 시뮬레이션" />
  <title>생존 시뮬레이터</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; }
    #game-container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

---

## 6. src/main.ts — Phaser 진입점

```typescript
import Phaser from 'phaser';
import { TitleScene }   from './scenes/TitleScene';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene }    from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scene: [TitleScene, LoadingScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,        // 픽셀 아트 안티앨리어싱 비활성
    antialias: false,
  },
};

new Phaser.Game(config);
```

---

## 7. Cloudflare Pages 배포

### 7-1. GitHub 연동 설정

Cloudflare Pages 대시보드:
```
프레임워크 프리셋: None (직접 설정)
빌드 명령:        npm run build
빌드 출력 디렉터리: dist
루트 디렉터리:    /  (기본값)
Node.js 버전:    20
```

### 7-2. 환경 변수 설정 (Cloudflare Pages 대시보드)

Settings → Environment variables → Production:
```
VITE_FIREBASE_API_KEY        = [실제 값]
VITE_FIREBASE_AUTH_DOMAIN    = [실제 값]
VITE_FIREBASE_DATABASE_URL   = [실제 값]
VITE_FIREBASE_PROJECT_ID     = [실제 값]
```

Preview(브랜치 배포)에도 별도 값 설정 가능.

### 7-3. _redirects 파일 (SPA 라우팅)

```
# public/_redirects
/*  /index.html  200
```

SPA에서 새로고침 시 404 방지.

### 7-4. 배포 흐름

```
git push → GitHub → Cloudflare Pages 자동 빌드 트리거
  → npm install
  → npm run build  (tsc + vite build)
  → dist/ → Cloudflare CDN 배포
  → 브랜치 배포 URL 생성 (PR 미리보기)
  → main 브랜치 → 프로덕션 URL 반영
```

빌드 예상 시간: 1~2분.

---

## 8. 성능 최적화

### 8-1. 번들 크기 예상

| 청크 | 예상 크기 |
|------|---------|
| phaser (별도 청크) | ~1.2MB (gzip ~400KB) |
| firebase (별도 청크) | ~150KB (gzip ~50KB) |
| 게임 코드 | ~200KB (gzip ~60KB) |
| **합계 (gzip)** | **~510KB** |

### 8-2. 캐시 전략

Cloudflare Pages 기본 캐시 정책 활용:
```
# public/_headers
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/*.html
  Cache-Control: no-cache
```

Vite는 빌드 시 파일명에 해시 포함 (`phaser.abc123.js`) → 영구 캐시 안전.

### 8-3. 초기 로딩 최적화

- Phaser 청크는 `<link rel="preload">` 로 브라우저가 미리 다운로드
- `LoadingScene` 진입 전 Phaser 초기화 완료 → 게임 화면 즉시 표시

```html
<!-- index.html에 자동 삽입 (vite build) -->
<link rel="preload" href="/assets/phaser.abc123.js" as="script" />
```

---

## 9. .gitignore

```
node_modules/
dist/
.env.development
.env.production
.env.local
*.local
```

---

## 10. 배포 체크리스트

### 10-1. 빌드 전 확인

- [ ] `npm run build` 로컬 성공 확인
- [ ] TypeScript 타입 에러 없음 (`tsc --noEmit`)
- [ ] `.env.production` 값 Cloudflare 환경 변수에 입력 완료
- [ ] Firebase Database Rules 프로덕션용으로 검토
- [ ] `console.log` 디버그 출력 제거 (또는 `import.meta.env.DEV` 가드)

### 10-2. 배포 후 확인

- [ ] 타이틀 화면 정상 표시
- [ ] 새 게임 → 캐릭터 생성 → 게임 진입 흐름
- [ ] Firebase 멀티플레이 연결 확인 (두 탭으로 테스트)
- [ ] 자동 저장 / 불러오기 동작
- [ ] 모바일 브라우저 기본 동작 확인 (레이아웃 깨짐 여부)

### 10-3. 프로덕션 URL 구조

```
https://<project>.pages.dev          → 프로덕션 (main 브랜치)
https://<branch>.<project>.pages.dev → 브랜치 미리보기
```

---

## 11. 수정 파일 목록

| 파일 | 내용 |
|------|------|
| `vite.config.ts` | 신규: 빌드 설정 |
| `tsconfig.json` | 신규: TypeScript 설정 |
| `package.json` | 신규: 의존성 및 스크립트 |
| `public/index.html` | 신규: HTML 진입점 |
| `public/_redirects` | 신규: SPA 라우팅 |
| `public/_headers` | 신규: 캐시 헤더 |
| `src/main.ts` | 신규: Phaser.Game 설정 |
| `src/config/firebase.ts` | 신규: Firebase 초기화 |
| `.env.development` | 신규: 개발 환경 변수 |
| `.env.production` | 신규: 프로덕션 환경 변수 |
| `.gitignore` | 신규: 빌드 산출물·env 제외 |

---

## 12. 확정 규칙

- `main` 브랜치 push = 즉시 프로덕션 배포 (별도 승인 없음)
- 개발 중 `npm run dev` 로 로컬 3000 포트에서 핫 리로드
- Firebase 무료 플랜 한도 초과 시 새 멀티플레이 접속만 차단 — 싱글플레이는 영향 없음
- 빌드 실패 시 이전 배포 유지 (Cloudflare Pages 자동 롤백)
- `VITE_` 접두사 없는 환경 변수는 클라이언트에 노출되지 않음 (Vite 규칙)
