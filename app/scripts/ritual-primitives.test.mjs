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

test('DoseCheckRow keeps detail navigation separate from recording and clearing', async () => {
  const DoseCheckRow = await loadComponent('src/components/DoseCheckRow.tsx');
  let recorded;
  let opened = 0;
  const element = DoseCheckRow({
    dose: { supplementId: 1, productName: '테스트 영양제', confirmedTime: '10:00' },
    onRecord(status) { recorded = status; }, onClear() {}, onOpen() { opened += 1; },
  });
  const [heading, actions] = element.props.children;
  const [, detail, clear] = heading.props.children;
  assert.equal(clear, null);
  assert.equal(actions.props.status, undefined);
  assert.equal(actions.props.name, '테스트 영양제');
  actions.props.onRecord('UNKNOWN');
  detail.props.onPress();
  assert.equal(recorded, 'UNKNOWN');
  assert.equal(opened, 1);
});

test('DoseCheckRow exposes clearing for any recorded answer and blocks it while saving', async () => {
  const DoseCheckRow = await loadComponent('src/components/DoseCheckRow.tsx');
  let cleared = 0;
  const element = DoseCheckRow({
    dose: { supplementId: 1, productName: '테스트 영양제', status: 'UNKNOWN' },
    disabled: true, onRecord() {}, onClear() { cleared += 1; }, onOpen() {},
  });
  const [heading, actions] = element.props.children;
  const [time, , clear] = heading.props.children;
  assert.equal(time.props.children, '미설정');
  assert.equal(clear.props.disabled, true);
  assert.equal(actions.props.disabled, true);
  assert.match(clear.props.accessibilityLabel, /기록 지우기/);
  clear.props.onPress();
  assert.equal(cleared, 0);
});

test('All three record answers have equal targets and emphasis with no default selection', async () => {
  const DoseRecordActions = await loadComponent('src/components/DoseRecordActions.tsx');
  const saved = [];
  const row = DoseRecordActions({ name: '비타민', onRecord(status) { saved.push(status); } });
  const actions = row.props.children;
  assert.equal(actions.length, 3);
  const targets = actions.map(action => StyleSheet.flatten(action.props.style({ pressed: false })));
  assert.ok(targets.every(style => style.minHeight >= 48 && style.minWidth >= 48));
  assert.deepEqual(targets[0], targets[1]);
  assert.deepEqual(targets[1], targets[2]);
  for (const action of actions) {
    assert.equal(action.props.accessibilityState.selected, false);
    assert.equal(action.props.disabled, false);
    action.props.onPress();
  }
  assert.deepEqual(saved, ['TAKEN', 'SKIPPED', 'UNKNOWN']);
});

test('Every record answer can be corrected in one tap and saving blocks all answers', async () => {
  const DoseRecordActions = await loadComponent('src/components/DoseRecordActions.tsx');
  const selectedStyles = [];
  for (const current of ['TAKEN', 'SKIPPED', 'UNKNOWN']) {
    const saved = [];
    const actions = DoseRecordActions({ status: current, onRecord(status) { saved.push(status); } }).props.children;
    const selected = actions.find(action => action.props.accessibilityState.selected);
    selectedStyles.push(StyleSheet.flatten(selected.props.style({ pressed: false })));
    for (const action of actions) action.props.onPress();
    assert.deepEqual(saved, ['TAKEN', 'SKIPPED', 'UNKNOWN'].filter(status => status !== current));
    const blocked = DoseRecordActions({ status: current, disabled: true, onRecord() { throw new Error('saving must block actions'); } }).props.children;
    for (const action of blocked) { assert.equal(action.props.disabled, true); action.props.onPress(); }
  }
  assert.deepEqual(selectedStyles[0], selectedStyles[1]);
  assert.deepEqual(selectedStyles[1], selectedStyles[2]);
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
