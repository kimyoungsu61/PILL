import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(process.argv[2] || 'dist/web');const file=path.join(root,'index.html');
let html=fs.readFileSync(file,'utf8').replace('<html lang="en">','<html lang="ko">');
const head='<link rel="manifest" href="/manifest.webmanifest" />\n<meta name="theme-color" content="#3657D6" />\n<meta name="apple-mobile-web-app-capable" content="yes" />\n<meta name="apple-mobile-web-app-title" content="PILL" />\n<link rel="apple-touch-icon" href="/icons/pill-192.png" />';
if(!html.includes('rel="manifest"'))html=html.replace('</head>',head+'\n</head>');
fs.writeFileSync(file,html);console.log('PILL home-screen metadata prepared.');
