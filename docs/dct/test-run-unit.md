# QuickBite — unit test capture

Captured: 2026-09-30T19:03:10.723Z
Command: npm run test:unit
Exit code: 0

## stdout

```
> quickbite@0.1.0 test:unit
> npm run test --workspace=@quickbite/shared && npm run test --workspace=client && npm run test --workspace=dashboard


> @quickbite/shared@0.0.1 test
> vitest run


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/home/sanket-rotangar/Desktop/SJ Innovation/QuickBite/packages/shared[39m

 [32m✓[39m src/rules.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 5[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m13 passed[39m[22m[90m (13)[39m
[2m   Start at [22m 00:33:11
[2m   Duration [22m 139ms[2m (transform 28ms, setup 0ms, import 40ms, tests 5ms, environment 0ms)[22m


> client@1.0.0 test
> vitest run --pool=threads


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/home/sanket-rotangar/Desktop/SJ Innovation/QuickBite/apps/client[39m

 [32m✓[39m src/notifications/routes.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m src/features/rider/tracking-policy.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/lib/customer-orders.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 3[2mms[22m[39m
 [32m✓[39m src/lib/auth-form.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m src/constants/orderStatus.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m src/lib/rio-status-hint.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/lib/addresses.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m

[2m Test Files [22m [1m[32m7 passed[39m[22m[90m (7)[39m
[2m      Tests [22m [1m[32m27 passed[39m[22m[90m (27)[39m
[2m   Start at [22m 00:33:11
[2m   Duration [22m 230ms[2m (transform 232ms, setup 0ms, import 358ms, tests 30ms, environment 1ms)[22m


> test
> vitest run


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/home/sanket-rotangar/Desktop/SJ Innovation/QuickBite/apps/manager[39m

 [32m✓[39m src/api/orders.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m   Start at [22m 00:33:12
[2m   Duration [22m 269ms[2m (transform 55ms, setup 0ms, import 168ms, tests 2ms, environment 0ms)[22m
```

## stderr

```
The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.
[90mstderr[2m | src/api/orders.test.ts
[22m[39m⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 22 or later. For more information, visit: https://github.com/orgs/supabase/discussions/45715
```
