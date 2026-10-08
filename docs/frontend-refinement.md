# PILL frontend refinement

Keep the original blue (#385BCE) as the accent. Use neutral surfaces and a readable hierarchy instead of repeated dark banners, decorative English headings, and excessive bold text.

- Today groups doses by time with a compact daily summary and clear completion state.
- Supplements emphasize brand, product name, and schedule. Search describes its actual product/brand scope.
- Product detail presents identity, directions, guidance, and ingredients before logging controls. Compact phones give long names the full content width.
- Label results, authentication screens, settings, history, forms, and the install guide use the same palette and typography.
- Existing AI verification rules, uncertainty markers, source links, and label warnings retain their behavior. No dosing advice was added.
- Authentication storage, API requests, reminders, deletion, and server behavior remain unchanged.

References inspected: [Apple Health](https://www.apple.com/health/), [MyTherapy](https://www.mytherapyapp.com/), [Toss typography](https://tossmini-docs.toss.im/tds-react-native/foundation/typography/). Reference imagery was inspected only and is not included in the product.

Validation: existing frontend unit and contract tests, TypeScript checks, production web export, and local browser checks for completion/undo, search, deletion, login/signup, notification settings, empty states, label capture/results, scan failure history, and 320/390/768/1440 layouts. Preview records are synthetic and separate from real accounts.

Prepared locally on feat/frontend-refinement. Railway deployment is deferred at the user's request.
