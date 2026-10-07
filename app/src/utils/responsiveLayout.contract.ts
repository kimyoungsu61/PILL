import { contentRailWidth, layoutModeForWidth, supportsSupportingColumn } from './responsiveLayout';

if (layoutModeForWidth(767) !== 'phone') throw new Error('767px must remain phone layout.');
if (layoutModeForWidth(768) !== 'tablet') throw new Error('768px must enter tablet layout.');
if (layoutModeForWidth(1024) !== 'wideTablet') throw new Error('1024px must enter wide-tablet layout.');
if (supportsSupportingColumn(1023)) throw new Error('Narrow tablet must not split content.');
if (!supportsSupportingColumn(1024)) throw new Error('Wide tablet must allow supporting content.');
if (contentRailWidth(1440) !== 980) throw new Error('Wide tablet content rail must cap at 980px.');
