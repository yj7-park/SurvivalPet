# Bug 5 — MoonSystem: Canvas 2D context non-null assertion 크래시

## 심각도
중간

## 파일
`src/systems/MoonSystem.ts`

## 현상
`canvas.getContext('2d')!` 로 non-null assertion을 사용하고 있어,
일부 환경(WebGL only 브라우저, 특정 모바일 환경)에서 `getContext('2d')`가 `null`을 반환할 경우
즉시 런타임 크래시가 발생한다. 달이 렌더링되지 않아 야간 비주얼이 깨진다.

## 재현 시나리오
1. WebGL 컨텍스트를 이미 많이 사용한 모바일 기기에서 접속
2. 브라우저가 추가 2D context 생성을 거부
3. `ctx.drawImage()` 호출 → `null.drawImage(...)` → TypeError 크래시

## 원인
```typescript
// MoonSystem.ts ~라인 15
const ctx = canvas.getContext('2d')!;
// ctx가 null이어도 컴파일러는 통과, 런타임에 크래시
```

## 수정 방향
```typescript
const ctx = canvas.getContext('2d');
if (!ctx) {
  console.warn('[MoonSystem] Canvas 2D context unavailable, skipping moon render');
  return;
}
```
