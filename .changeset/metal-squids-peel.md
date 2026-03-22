---
'create-rn-miniapp': patch
---

직접 구현하던 generic plumbing을 표준 라이브러리 기준으로 정리했어요.

- skill frontmatter 파싱을 `gray-matter`로 교체했어요.
- JSONC와 root `package.json` patching을 `jsonc-parser` edit API 기반으로 바꿔 comment와 순서를 보존해요.
- 명령 실행을 `execa`로 교체해서 오류 메시지와 실행기 호환성을 표준화했어요.
- Cloudflare provisioning의 직접 `fetch`/envelope 처리를 공식 Cloudflare SDK 기반으로 줄였어요.
