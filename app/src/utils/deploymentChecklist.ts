export type DeviceVerificationStep = {
  id: string;
  title: string;
  expected: string;
};

export const deviceVerificationSteps: readonly DeviceVerificationStep[] = [
  {
    id: 'tablet-orientation',
    title: 'Tablet orientation and responsive layout',
    expected: 'At 768px portrait and 1024px landscape, content remains readable, reachable, and free of overlapping actions.',
  },
  {
    id: 'login-navigation',
    title: 'Login and navigation',
    expected: 'Keyboard, validation errors, primary submit, and navigation between Today, Cabinet, Scan, and Review remain usable.',
  },
  {
    id: 'dose-update-rollback',
    title: 'Dose update and rollback',
    expected: 'Updating a dose changes the visible Today state, and recovery or rollback returns the previous state without hiding the next action.',
  },
  {
    id: 'camera-permission',
    title: 'Native camera and media permissions',
    expected: 'The permission rationale matches the app purpose; allow, deny, and retry paths are understandable without blocked controls.',
  },
  {
    id: 'front-and-back-capture',
    title: 'Front/back capture, retake, and upload',
    expected: 'Both label sides can be captured or selected, reviewed, retaken, and uploaded in order without timing or layout conflicts.',
  },
  {
    id: 'scan-upload',
    title: 'Non-sensitive label scan and upload recovery',
    expected: 'A non-sensitive test label reaches the scan upload flow, and selected-image, upload-error, and retry states remain readable.',
  },
  {
    id: 'llm-review',
    title: 'AI result review',
    expected: 'The existing server result renders, remains editable, distinguishes warnings from ordinary text, and exposes response-error recovery.',
  },
  {
    id: 'manual-fallback',
    title: 'Manual fallback',
    expected: 'Manual product entry is reachable from scan recovery and can continue without camera or upload success.',
  },
  {
    id: 'save-reminder',
    title: 'Save and reminder',
    expected: 'Saving preserves the reviewed product, and the native reminder/TimePicker flow handles permission, confirmation, and cancellation clearly.',
  },
];
