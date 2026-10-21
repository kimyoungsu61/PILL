import { createGardenRequests } from './requests';
import type { GardenState } from './types';

async function run() {
const response = { selectedPot: 'cloud', selectedStamp: 'flower' } as GardenState;
const calls: string[] = [];
let finish: (value: GardenState) => void = () => {};
const requests = createGardenRequests(async path => {
  calls.push(path);
  if (path.endsWith('/style')) return new Promise<GardenState>(resolve => { finish = resolve; });
  return response;
});
const saving = requests.save('owner', { pot: 'cloud', stamp: 'flower' });
await Promise.resolve(); await Promise.resolve();
const reopened = requests.read('owner');
await Promise.resolve();
if (calls.length !== 1) throw new Error('Reopened screens must wait for the pending style save');
finish(response);
await saving;
if ((await reopened).selectedPot !== 'cloud' || Number(calls.length) !== 2) throw new Error('Reopened garden must see saved selection');
let attempts = 0;
const failing = createGardenRequests(async () => { if (++attempts === 1) throw new Error('offline'); return response; });
await failing.save('owner', { pot: 'cloud', stamp: 'flower' }).catch(() => undefined);
if ((await failing.read('owner')).selectedStamp !== 'flower') throw new Error('A failed save cannot block later reads');
}
void run().catch(error => { throw error; });
