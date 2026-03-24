# Skill: Provider Factory with Graceful Fallback

## Pattern

When building a pluggable provider system (AI, auth, storage, etc.), the factory function should **never throw** to callers. Instead, it should catch initialization failures and return a working fallback implementation.

## Structure

```typescript
async function createProvider(type?: ProviderType): Promise<Provider> {
  if (type === 'real-service') {
    try {
      const provider = new RealProvider();
      await provider.initialize();
      return provider;
    } catch (err) {
      console.warn(`[Provider] Real service failed, falling back: ${err.message}`);
      return new MockProvider();
    }
  }
  return new MockProvider();
}
```

## Key Principles

1. **Factory absorbs errors** — callers always get a working provider
2. **Log the fallback** — `console.warn` so devs know the real service isn't connected
3. **Mock is fully functional** — not just stubs, but contextually useful responses
4. **Feature flag in .env** — `PROVIDER_TYPE=real|mock` so switching is trivial

## Where Used

- `apps/api/src/services/ai/copilot-provider.ts` — `createAIProvider()` falls back from copilot-sdk to MockAIProvider
