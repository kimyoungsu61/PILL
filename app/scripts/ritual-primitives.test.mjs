import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { StyleSheet } from 'react-native-web';

const appRoot = fileURLToPath(new URL('../', import.meta.url));

async function loadModule(entryPoint) {
  const result = await build({
    absWorkingDir: appRoot,
    alias: {
      'react-native': 'react-native-web',
    },
    bundle: true,
    entryPoints: [entryPoint],
    external: ['react', 'react-dom', 'react-native-web'],
    format: 'cjs',
    platform: 'node',
    // Test row semantics independently of the icon package's native renderer.
    plugins: [{
      name: 'test-icon',
      setup(builder) {
        builder.onResolve({ filter: /^lucide-react-native$/ }, () => ({ path: 'icons', namespace: 'test-icons' }));
        builder.onLoad({ filter: /.*/, namespace: 'test-icons' }, () => ({ contents: 'export const Check = () => null;', loader: 'js' }));
      },
    }],
    write: false,
  });

  const bundlePath = path.join(appRoot, `.test-${path.basename(entryPoint)}.cjs`);
  const componentModule = new Module(bundlePath);
  componentModule.filename = bundlePath;
  componentModule.paths = Module._nodeModulePaths(appRoot);

  const originalWarn = console.warn;
  console.warn = (message, ...args) => {
    if (message === '"shadow*" style props are deprecated. Use "boxShadow".') return;
    originalWarn(message, ...args);
  };
  try {
    componentModule._compile(result.outputFiles[0].text, bundlePath);
  } finally {
    console.warn = originalWarn;
  }

  return componentModule.exports;
}

async function loadComponent(entryPoint) {
  const componentModule = await loadModule(entryPoint);
  return componentModule.default;
}

test('RitualAction enforces a 48px minimum target in both dimensions', async () => {
  const RitualAction = await loadComponent('src/components/RitualAction.tsx');
  const element = RitualAction({ label: '', onPress() {} });
  const resolvedStyle = StyleSheet.flatten(element.props.style({ pressed: false }));

  assert.ok(resolvedStyle.minHeight >= 48);
  assert.ok(resolvedStyle.minWidth >= 48);
});

test('RitualAction renders its label with the semantic action typography token', async () => {
  const RitualAction = await loadComponent('src/components/RitualAction.tsx');
  const { type } = await loadModule('src/theme.ts');
  const element = RitualAction({ label: 'Save', onPress() {} });
  const content = element.props.children;
  const label = content.props.children[1];
  const resolvedStyle = StyleSheet.flatten(label.props.style);

  assert.deepEqual(
    {
      fontSize: resolvedStyle.fontSize,
      fontWeight: resolvedStyle.fontWeight,
    },
    type.actionLabel,
  );
  assert.ok(type.actionLabel.fontSize >= 14);
  assert.ok(Number(type.actionLabel.fontWeight) >= 700);
});

test('DoseCheckRow exposes an accessible 48px checkbox and separate detail action', async () => {
  const DoseCheckRow = await loadComponent('src/components/DoseCheckRow.tsx');
  let taken = 0;
  let opened = 0;
  const element = DoseCheckRow({
    dose: { supplementId: 1, productName: '테스트 영양제', confirmedTime: '10:00' },
    onTaken() { taken += 1; }, onClear() {}, onOpen() { opened += 1; },
  });
  const [, detail, checkbox] = element.props.children;
  assert.equal(checkbox.props.accessibilityRole, 'checkbox');
  assert.equal(checkbox.props.accessibilityState.checked, false);
  assert.equal(checkbox.props['aria-checked'], false);
  const target = StyleSheet.flatten(checkbox.props.style({ pressed: false }));
  assert.ok(target.width >= 48 && target.height >= 48);
  checkbox.props.onPress();
  detail.props.onPress();
  assert.equal(taken, 1);
  assert.equal(opened, 1);
});

test('DoseCheckRow keeps completion reversible and blocks taps while saving', async () => {
  const DoseCheckRow = await loadComponent('src/components/DoseCheckRow.tsx');
  let cleared = 0;
  const element = DoseCheckRow({
    dose: { supplementId: 1, productName: '테스트 영양제', status: 'TAKEN' },
    disabled: true, onTaken() {}, onClear() { cleared += 1; }, onOpen() {},
  });
  const [time, , checkbox] = element.props.children;
  assert.equal(time.props.children, '미설정');
  assert.equal(checkbox.props.accessibilityState.checked, true);
  assert.equal(checkbox.props['aria-checked'], true);
  assert.equal(checkbox.props.disabled, true);
  assert.match(checkbox.props.accessibilityLabel, /완료 취소/);
  checkbox.props.onPress();
  assert.equal(cleared, 1);
});

test('RitualSurface variants forward accessibility props and caller styles', async () => {
  const RitualSurface = await loadComponent('src/components/RitualSurface.tsx');
  const defaultSurface = RitualSurface({ children: null });
  const activeSurface = RitualSurface({ children: null, variant: 'active', style: { borderStartWidth: 4 } });
  const warningSurface = RitualSurface({
    accessibilityHint: 'Review this warning before continuing.',
    accessibilityLabel: 'Dose warning',
    accessibilityRole: 'summary',
    children: null,
    variant: 'warning',
    style: { borderStartWidth: 4, borderStyle: 'dashed' },
  });

  const defaultStyle = StyleSheet.flatten(defaultSurface.props.style);
  const activeStyle = StyleSheet.flatten(activeSurface.props.style);
  const warningStyle = StyleSheet.flatten(warningSurface.props.style);

  assert.equal(defaultStyle.borderStartWidth, undefined);
  assert.equal(activeStyle.borderStartWidth, 4);
  assert.equal(warningStyle.borderStartWidth, 4);
  assert.equal(warningStyle.borderStyle, 'dashed');
  assert.equal(warningSurface.props.accessibilityLabel, 'Dose warning');
  assert.equal(warningSurface.props.accessibilityHint, 'Review this warning before continuing.');
  assert.equal(warningSurface.props.accessibilityRole, 'summary');
});
