import { isWebDesignPreview } from './designPreview';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

expectEqual(
  isWebDesignPreview('web', true),
  true,
  'Web development should enable design preview',
);
expectEqual(
  isWebDesignPreview('ios', true),
  false,
  'Native development should keep normal authentication',
);
expectEqual(
  isWebDesignPreview('web', false),
  false,
  'Production web should keep normal authentication',
);
expectEqual(isWebDesignPreview('web', true, true), false, 'Live web must require real authentication');
expectEqual(isWebDesignPreview('android', true, true), false, 'Native authentication must remain enabled');
