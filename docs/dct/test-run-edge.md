# QuickBite — edge test capture

Captured: 2026-09-30T19:03:19.747Z
Command: npm run test:edge
Exit code: 0

```
> quickbite@0.1.0 test:edge
> node scripts/test-edge.mjs

[0m[38;5;245mrunning 2 tests from ./supabase/functions/_shared/embeddings.test.ts[0m
retrieveContext maps rpc rows to chunks ... [0m[32mok[0m [0m[38;5;245m(2ms)[0m
retrieveContext returns empty for blank query ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
[0m[38;5;245mrunning 5 tests from ./supabase/functions/_shared/llm.test.ts[0m
resolveProviderEndpoint groq uses api key header ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
resolveProviderEndpoint ollama uses host ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
readActiveLlmConfig falls back when empty ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
callLLM routes to groq from config without network ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
resolveProviderEndpoint groq missing key throws ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
[0m[38;5;245mrunning 3 tests from ./supabase/functions/_shared/rules.test.ts[0m
ticketUrgency high for missing order ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
nextRiderStatus advances delivery steps ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m
validateAuthForm checks email and password ... [0m[32mok[0m [0m[38;5;245m(0ms)[0m

[0m[32mok[0m | 10 passed | 0 failed [0m[38;5;245m(48ms)[0m


Local deno not found — using npx deno@2.1.4
[0m[32mCheck[0m file:///home/sanket-rotangar/Desktop/SJ Innovation/QuickBite/supabase/functions/_shared/embeddings.test.ts
[0m[32mCheck[0m file:///home/sanket-rotangar/Desktop/SJ Innovation/QuickBite/supabase/functions/_shared/llm.test.ts
[0m[32mCheck[0m file:///home/sanket-rotangar/Desktop/SJ Innovation/QuickBite/supabase/functions/_shared/rules.test.ts
```
